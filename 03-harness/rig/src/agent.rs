//! rig pieces: model construction for any OpenAI-compatible route, the two tools (`bash`, `card`),
//! a timing HTTP transport and the hook that turns rig's dispatch/outcome events into trace events.
use crate::{registry::Route, sandbox, trace::Trace};
use rig_agent::agent::{AgentHook, DispatchAction, DispatchEvent, HookContext, InvalidToolCallContext, OutcomeAction, OutcomeEvent};
use rig_agent::run::policy::InvalidToolCallAction;
use rig_agent::tool::{Tool, ToolContext};
use rig_core::DynModel;
use rig_core::effect::EffectKind;
use rig_core::http_client::{self, HttpClientExt, LazyBody, MultipartForm, Request, Response, StreamingResponse};
use rig_core::operation::Completion;
use rig_core::providers::openai::OpenAIConfig;
use rig_core::providers::openai::wire::{Dialect, OPENROUTER};
use serde::Deserialize;
use serde_json::{Value, json};
use std::convert::Infallible;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;

fn leak(s: &str) -> &'static str {
    Box::leak(s.to_string().into_boxed_str())
}

/// Counters and clocks shared by the hook, the tool and the HTTP transport of one agent.
#[derive(Default)]
pub struct Stats {
    pub step: u64,
    pub api_calls: u64,
    pub tool_calls: u64,
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub errors: Vec<String>,
    llm_t0: Option<Instant>,
    tool_t0: Option<Instant>,
    cur_tool: String,
    headers_ms: f64,
    http_span: f64,
    /// (ok, text) left by the tool that just ran, for the trace
    last_tool: Option<(bool, String)>,
}
pub type Shared = Arc<Mutex<Stats>>;

pub fn shared() -> Shared {
    Arc::new(Mutex::new(Stats::default()))
}

// ---------------------------------------------------------------- transport
/// Wraps rig's reqwest client and measures the pure HTTP span (request handed over -> last body byte),
/// so the trace can separate provider time from rig's own encode/decode work.
#[derive(Clone)]
pub struct TimedHttp {
    inner: http_client::DynHttpClient,
    stats: Shared,
}

impl HttpClientExt for TimedHttp {
    fn send<T, U>(&self, req: Request<T>) -> impl Future<Output = http_client::Result<Response<LazyBody<U>>>> + Send + 'static
    where
        T: Into<bytes::Bytes> + Send,
        U: From<bytes::Bytes> + Send + 'static,
    {
        let st = self.stats.clone();
        let t0 = Instant::now();
        let fut = self.inner.send::<T, U>(req);
        async move {
            let r = fut.await?;
            st.lock().unwrap().headers_ms = t0.elapsed().as_secs_f64() * 1000.0;
            // The body is read lazily by rig; close the HTTP span only when the last byte is in.
            Ok(r.map(|body| {
                Box::pin(async move {
                    let b = body.await;
                    st.lock().unwrap().http_span += t0.elapsed().as_secs_f64() * 1000.0;
                    b
                }) as LazyBody<U>
            }))
        }
    }

    fn send_multipart<U>(&self, req: Request<MultipartForm>) -> impl Future<Output = http_client::Result<Response<LazyBody<U>>>> + Send + 'static
    where
        U: From<bytes::Bytes> + Send + 'static,
    {
        self.inner.send_multipart::<U>(req)
    }

    fn send_streaming<T>(&self, req: Request<T>) -> impl Future<Output = http_client::Result<StreamingResponse>> + Send
    where
        T: Into<bytes::Bytes> + Send,
    {
        self.inner.send_streaming::<T>(req)
    }
}

/// A rig completion model for any route of config/models.toml (all are OpenAI chat-completions).
pub fn model(route: &Route, stats: &Shared) -> DynModel<Completion> {
    let dialect = if route.provider == "openrouter" {
        OPENROUTER
    } else {
        Dialect::gateway(leak(&route.provider), leak(&route.base_url), leak(&route.key_env))
    };
    let http = TimedHttp { inner: rig_reqwest::shared(), stats: stats.clone() };
    OpenAIConfig::with_key(&dialect, route.key.clone())
        .with_base_url(route.base_url.clone())
        .connect(http)
        .chat(route.model.clone())
        .into()
}

// ---------------------------------------------------------------- tools
#[derive(Deserialize)]
pub struct BashArgs {
    #[serde(default)]
    pub cmd: String,
}

#[derive(Clone)]
pub struct Bash {
    pub root: PathBuf,
    pub stats: Shared,
}

impl Tool for Bash {
    const NAME: &'static str = "bash";
    type Args = BashArgs;
    type Output = String;
    type Error = Infallible;

    fn description(&self) -> String {
        "Run one shell command and return its output (cut at 3000 characters).".to_owned()
    }

    fn parameters(&self) -> Value {
        json!({"type": "object", "properties": {"cmd": {"type": "string"}}, "required": ["cmd"]})
    }

    async fn call(&self, _context: &mut ToolContext, args: Self::Args) -> Result<String, Infallible> {
        let (ok, text) = if args.cmd.is_empty() {
            (false, "[error: arguments must be JSON with a \"cmd\" string]".to_string())
        } else {
            let o = sandbox::sh(&args.cmd, &self.root).await;
            (o.exit == Some(0), o.text)
        };
        self.stats.lock().unwrap().last_tool = Some((ok, text.clone()));
        Ok(text)
    }
}

#[derive(Deserialize)]
pub struct CardArgs {
    #[serde(default)]
    pub name: String,
}

/// Reads one card of the CLI index (02-agent/cli-index/cards/<name>.md).
#[derive(Clone)]
pub struct Card {
    pub root: PathBuf,
    pub stats: Shared,
}

impl Tool for Card {
    const NAME: &'static str = "card";
    type Args = CardArgs;
    type Output = String;
    type Error = Infallible;

    fn description(&self) -> String {
        "Read the card for one CLI command from the CLI index (copy-paste commands and gotchas).".to_owned()
    }

    fn parameters(&self) -> Value {
        json!({"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]})
    }

    async fn call(&self, _context: &mut ToolContext, args: Self::Args) -> Result<String, Infallible> {
        let dir = self.root.join("02-agent/cli-index/cards");
        let name: String = args.name.trim().trim_matches('`').trim_end_matches(".md").chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').collect();
        let (ok, text) = match std::fs::read_to_string(dir.join(format!("{name}.md"))) {
            Ok(t) => (true, t),
            Err(_) => {
                let mut names: Vec<String> = std::fs::read_dir(&dir).map(|d| d.filter_map(|e| e.ok())
                    .filter_map(|e| e.path().file_stem().map(|s| s.to_string_lossy().to_string())).collect()).unwrap_or_default();
                names.sort();
                (false, format!("no card named '{name}'. Cards: {}", names.join(", ")))
            }
        };
        self.stats.lock().unwrap().last_tool = Some((ok, text.clone()));
        Ok(text)
    }
}

// ---------------------------------------------------------------- trace hook
#[derive(Clone)]
pub struct TraceHook {
    pub trace: Trace,
    pub stats: Shared,
}

impl AgentHook for TraceHook {
    /// Small models sometimes call a CLI command (`websearch`, `fd`) as if it were a tool. Tell them once and let them retry.
    async fn on_invalid_tool_call(&self, _ctx: &HookContext, event: &InvalidToolCallContext) -> Option<InvalidToolCallAction> {
        let g = self.stats.lock().unwrap();
        self.trace.ev("message", g.step, json!({"to": "main", "output": format!("harness: `{}` is not a tool, retrying", event.tool_name)}));
        Some(InvalidToolCallAction::retry(format!(
            "`{}` is not a tool. It is a shell command: call the `bash` tool with it in `cmd`. The only tools are `bash` and `card`.", event.tool_name)))
    }

    async fn on_dispatch(&self, _ctx: &HookContext, event: DispatchEvent<'_>) -> DispatchAction {
        let now = Instant::now();
        let mut g = self.stats.lock().unwrap();
        match event.kind {
            EffectKind::Completion { .. } => {
                g.step += 1;
                g.http_span = 0.0;
                g.llm_t0 = Some(now);
                self.trace.ev("llm_start", g.step, json!({}));
            }
            EffectKind::ToolCall { name, args } => {
                g.tool_t0 = Some(now);
                g.last_tool = None;
                g.cur_tool = name.to_string();
                // show the one argument (cmd or name) rather than the JSON wrapper
                let input = serde_json::from_str::<Value>(args).ok()
                    .and_then(|v| v.as_object().and_then(|o| o.values().next().and_then(|c| c.as_str()).map(str::to_owned)))
                    .unwrap_or_else(|| args.clone());
                self.trace.ev("tool_start", g.step, json!({"tool": g.cur_tool, "input": input}));
            }
            _ => {}
        }
        DispatchAction::proceed()
    }

    async fn on_outcome(&self, _ctx: &HookContext, event: OutcomeEvent<'_>) -> OutcomeAction {
        let now = Instant::now();
        let mut g = self.stats.lock().unwrap();
        match event.kind {
            EffectKind::Completion { .. } => {
                let ms = g.llm_t0.take().map(|t| now.duration_since(t).as_secs_f64() * 1000.0).unwrap_or(0.0);
                g.api_calls += 1;
                match event.outcome {
                    Ok(_) => {
                        let (mut tin, mut tout, mut out) = (0, 0, String::new());
                        if let Some(r) = event.completion() {
                            tin = r.usage.input_tokens.unwrap_or(0);
                            tout = r.usage.output_tokens.unwrap_or(0);
                            out = r.text();
                            let calls: Vec<String> = r.tool_calls().map(|c| format!("{}({})", c.function.name, Value::Object(c.function.arguments.clone()))).collect();
                            if !calls.is_empty() {
                                out = format!("{}{}{}", out, if out.is_empty() { "" } else { " " }, calls.join(" ; "));
                            }
                        }
                        g.tokens_in += tin;
                        g.tokens_out += tout;
                        // http_ms is the pure provider span (request handed over -> last body byte); ms is what the agent waited
                        self.trace.ev("llm_end", g.step, json!({"ms": ms.round() as u64, "tokens_in": tin, "tokens_out": tout, "output": out,
                            "http_ms": g.http_span.round() as u64, "headers_ms": g.headers_ms.round() as u64}));
                    }
                    Err(e) => {
                        let msg = self.trace.scrub(&crate::cut(&e.to_string(), 300));
                        self.trace.ev("llm_end", g.step, json!({"ms": ms.round() as u64, "tokens_in": 0, "tokens_out": 0, "output": "", "error": msg}));
                        g.errors.push(msg);
                    }
                }
            }
            EffectKind::ToolCall { .. } => {
                let ms = g.tool_t0.take().map(|t| now.duration_since(t).as_secs_f64() * 1000.0).unwrap_or(0.0);
                g.tool_calls += 1;
                let (ok, out) = match g.last_tool.take() {
                    Some(x) => x,
                    None => (false, match event.outcome { Ok(_) => "[tool did not run]".to_string(), Err(e) => format!("[tool error: {e}]") }),
                };
                self.trace.ev("tool_end", g.step, json!({"tool": g.cur_tool, "ms": ms.round() as u64, "ok": ok, "output": out}));
            }
            _ => {}
        }
        OutcomeAction::proceed()
    }
}
