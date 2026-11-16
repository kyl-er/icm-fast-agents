//! Emitter for 04-traces/SCHEMA.md v2. One file per run in 04-traces/live/, shared by every agent of the run.
use serde_json::{Map, Value, json};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::{Arc, Mutex};

const CUT: usize = 1500;

struct Inner {
    f: File,
    scrub: Vec<String>,
}

#[derive(Clone)]
pub struct Trace {
    pub run: String,
    pub agent: String,
    pub parent: Option<String>,
    pub model: String,
    pub echo: bool,
    inner: Arc<Mutex<Inner>>,
}

fn one(v: Option<&Value>, n: usize) -> String {
    let s = match v {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Null) | None => String::new(),
        Some(o) => o.to_string(),
    };
    s.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(n).collect()
}

impl Trace {
    pub fn new(run: &str, model: &str, scrub: Vec<String>, echo: bool) -> anyhow::Result<Self> {
        let d = std::env::var("TRACE_DIR").map(std::path::PathBuf::from).unwrap_or_else(|_| crate::root().join("04-traces/live"));
        std::fs::create_dir_all(&d)?;
        let f = OpenOptions::new().create(true).append(true).open(d.join(format!("{run}.jsonl")))?;
        let scrub = scrub.into_iter().filter(|s| !s.is_empty()).collect();
        Ok(Self { run: run.into(), agent: "main".into(), parent: None, model: model.into(), echo, inner: Arc::new(Mutex::new(Inner { f, scrub })) })
    }

    /// Same file, a sub-agent.
    pub fn child(&self, agent: &str, model: Option<&str>) -> Self {
        Self { agent: agent.into(), parent: Some(self.agent.clone()), model: model.unwrap_or(&self.model).into(), ..self.clone() }
    }

    pub fn scrub(&self, s: &str) -> String {
        let g = self.inner.lock().unwrap();
        g.scrub.iter().fold(s.to_string(), |s, k| s.replace(k, "<key>"))
    }

    pub fn ev(&self, kind: &str, step: u64, extra: Value) {
        let ts = (crate::now() * 10000.0).round() / 10000.0;
        let mut m = Map::new();
        m.insert("v".into(), json!(2));
        m.insert("ts".into(), json!(ts));
        m.insert("run".into(), json!(self.run));
        m.insert("agent".into(), json!(self.agent));
        m.insert("parent".into(), json!(self.parent));
        m.insert("step".into(), json!(step));
        m.insert("kind".into(), json!(kind));
        m.insert("model".into(), json!(self.model));
        if let Value::Object(e) = extra {
            for (k, mut v) in e {
                if matches!(k.as_str(), "input" | "output") {
                    if let Value::String(s) = &v {
                        let n = s.chars().count();
                        if n > CUT {
                            v = Value::String(format!("{}…[+{}]", crate::cut(s, CUT), n - CUT));
                        }
                    }
                }
                m.insert(k, v);
            }
        }
        let mut g = self.inner.lock().unwrap();
        let mut line = Value::Object(m.clone()).to_string();
        for k in &g.scrub {
            line = line.replace(k, "<key>");
        }
        let _ = writeln!(g.f, "{line}");
        let _ = g.f.flush();
        drop(g);
        if self.echo {
            eprintln!("{}", self.scrub(&pretty(&m, ts)));
        }
    }
}

/// One terminal line per event; the same shape as pretty() in 03-harness/trace.py.
fn pretty(e: &Map<String, Value>, ts: f64) -> String {
    let t = chrono::DateTime::from_timestamp(ts as i64, 0).map(|d| d.with_timezone(&chrono::Local).format("%H:%M:%S").to_string()).unwrap_or_default();
    let g = |k: &str| e.get(k);
    let head = format!("{t} {:<10} {:>2} ", one(g("agent"), 10), one(g("step"), 3));
    let body = match one(g("kind"), 20).as_str() {
        "run_start" => format!("▶ RUN  {} · {} · {}/{}: {}", one(g("harness"), 20), one(g("model"), 40), one(g("category"), 12), one(g("task"), 20), one(g("input"), 90)),
        "llm_start" => "… thinking".to_string(),
        "llm_end" => format!("◆ LLM  {} ms · {}→{} tok · {}", one(g("ms"), 9), one(g("tokens_in"), 9), one(g("tokens_out"), 9), one(g("output"), 110)),
        "tool_start" => format!("→ {}  {}", one(g("tool"), 20), one(g("input"), 110)),
        "tool_end" => format!("← {}  {} ms {} · {}", one(g("tool"), 20), one(g("ms"), 9), if g("ok") == Some(&json!(true)) { "ok" } else { "FAIL" }, one(g("output"), 110)),
        "run_end" => format!("■ END  ok={} · {} steps · {}→{} tok · {} ms · ${}\n    {}{}", one(g("ok"), 5), one(g("steps"), 4), one(g("tokens_in"), 9),
            one(g("tokens_out"), 9), one(g("ms"), 9), one(g("cost_usd"), 10), one(g("output"), 400),
            match g("error") { Some(Value::String(s)) => format!("\n    error: {s}"), _ => String::new() }),
        k => format!("{k} {}", one(g("output"), 110)),
    };
    head + &body
}
