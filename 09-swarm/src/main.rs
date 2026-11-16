//! swarm: one orchestrator plans, N tool-less stateless workers each build one component, code assembles and checks.
//!
//!   brief.toml ─▶ orchestrator (1 call, JSON plan, re-asked once if invalid) ─▶ out/<run>/plan.json
//!                      │  agent_spawn × N
//!          governor: max parallel + retry/backoff on HTTP 429
//!        ┌──────────┬──┴───────┬──────────┐
//!     agent-1    agent-2    agent-3  …  agent-N      swarms-rs SwarmsAgent, no tools, sees only contract + own spec
//!        └──── components/<id>.html|md ───┘
//!                      │
//!     assemble (code) ─▶ index.html | PRD.md ─▶ mechanical checks ─▶ report.json  (failed components redone once)
//!
//!   swarm --agents 3|6 [--model gpt-oss-120b] [--via cerebras] [--brief briefs/status-page.toml] [--parallel 4] [--no-redo] [--quiet]
use anyhow::{Context, Result, anyhow, bail};
use futures::future::BoxFuture;
use rig_agent_demo::{cut, registry, root, slug, stamp, trace::Trace};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use swarms_rs::agent::{SwarmsAgent, SwarmsAgentBuilder};
use swarms_rs::llm::completion::AssistantContent;
use swarms_rs::llm::provider::openai::OpenAI;
use swarms_rs::llm::request::{CompletionRequest, CompletionResponse};
use swarms_rs::llm::{CompletionError, Model};
use tokio::sync::Semaphore;

// ---------------------------------------------------------------- brief and plan ----------------------------------

#[derive(Deserialize, Serialize, Clone)]
struct Brief {
    name: String,
    kind: String,
    title: String,
    goal: String,
    audience: String,
    tone: String,
    class_prefix: String,
    must_show: Vec<String>,
    constraints: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
struct Component {
    id: String,
    owner: String,
    purpose: String,
    spec: String,
    #[serde(default)]
    interfaces: Vec<String>,
    #[serde(default)]
    acceptance: Vec<String>,
    #[serde(default)]
    budget_bytes: u64,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
struct Shared {
    #[serde(default)]
    style_guide: String,
    #[serde(default)]
    css_variables: serde_json::Map<String, Value>,
    #[serde(default)]
    heading_levels: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
struct Plan {
    #[serde(default)]
    summary: String,
    shared: Shared,
    components: Vec<Component>,
}

fn validate(p: &mut Plan, n: usize, kind: &str) -> Result<()> {
    if p.components.len() != n {
        bail!("plan has {} components, need exactly {n}", p.components.len());
    }
    let mut ids = std::collections::HashSet::new();
    let mut owners = std::collections::HashSet::new();
    for (i, c) in p.components.iter_mut().enumerate() {
        c.id = slug(c.id.trim()).trim_matches('_').to_lowercase().replace('_', "-");
        c.owner = slug(c.owner.trim()).trim_matches('_').to_lowercase().replace('_', "-");
        if c.owner.is_empty() || !owners.insert(c.owner.clone()) {
            c.owner = format!("agent-{}", i + 1); // owner names are cosmetic: repair instead of re-asking
            owners.insert(c.owner.clone());
        }
        for (f, v) in [("id", &c.id), ("purpose", &c.purpose), ("spec", &c.spec)] {
            if v.trim().is_empty() {
                bail!("component {} has an empty {f}", i + 1);
            }
        }
        if c.acceptance.is_empty() || c.acceptance.iter().any(|a| a.trim().is_empty()) {
            bail!("component {} has no acceptance sentences", c.id);
        }
        if c.interfaces.is_empty() {
            bail!("component {} lists no interfaces", c.id);
        }
        if !ids.insert(c.id.clone()) {
            bail!("duplicate component id {}", c.id);
        }
        if c.budget_bytes == 0 {
            c.budget_bytes = if kind == "prd" { 3000 } else { 4000 };
        }
        c.budget_bytes = c.budget_bytes.clamp(800, 12000);
    }
    if kind == "ui" && p.shared.css_variables.is_empty() {
        bail!("shared.css_variables is empty");
    }
    Ok(())
}

/// Pull the JSON object out of a reply that may carry ``` fences or prose around it.
fn extract_json(s: &str) -> Option<&str> {
    let a = s.find('{')?;
    let b = s.rfind('}')?;
    (b > a).then(|| &s[a..=b])
}

// ---------------------------------------------------------------- traced swarms-rs model ------------------------------

#[derive(Default)]
struct Totals {
    calls: u64,
    tokens_in: u64,
    tokens_out: u64,
}

/// A swarms-rs Model wrapping the OpenAI-compatible provider: writes llm_start/llm_end for its agent.
#[derive(Clone)]
struct Traced {
    inner: OpenAI,
    trace: Trace,
    step: Arc<Mutex<u64>>,
    totals: Arc<Mutex<Totals>>,
}

impl Model for Traced {
    type RawCompletionResponse = async_openai::types::CreateChatCompletionResponse;

    fn completion(&self, request: CompletionRequest) -> BoxFuture<'_, Result<CompletionResponse<Self::RawCompletionResponse>, CompletionError>> {
        Box::pin(async move {
            let step = {
                let mut s = self.step.lock().unwrap();
                *s += 1;
                *s
            };
            self.trace.ev("llm_start", step, json!({}));
            let t = Instant::now();
            let r = self.inner.completion(request).await;
            let ms = t.elapsed().as_millis() as u64;
            match &r {
                Ok(resp) => {
                    let (tin, tout) = resp.raw_response.usage.as_ref().map(|u| (u.prompt_tokens as u64, u.completion_tokens as u64)).unwrap_or((0, 0));
                    let mut tot = self.totals.lock().unwrap();
                    tot.calls += 1;
                    tot.tokens_in += tin;
                    tot.tokens_out += tout;
                    drop(tot);
                    let text: String = resp.choice.iter().filter_map(|c| if let AssistantContent::Text(t) = c { Some(t.text.as_str()) } else { None }).collect();
                    self.trace.ev("llm_end", step, json!({"ms": ms, "tokens_in": tin, "tokens_out": tout, "output": cut(&text, 300)}));
                }
                Err(e) => {
                    let msg = self.trace.scrub(&cut(&e.to_string(), 300));
                    self.trace.ev("llm_end", step, json!({"ms": ms, "tokens_in": 0, "tokens_out": 0, "output": "", "error": msg}));
                }
            }
            r
        })
    }
}

fn is_rate_limit(e: &str) -> bool {
    let l = e.to_lowercase();
    l.contains("429") || l.contains("rate limit") || l.contains("too many requests") || l.contains("rate_limit")
}

// ---------------------------------------------------------------- prompts ------------------------------------------

fn planner_system(b: &Brief, n: usize) -> String {
    let unit = if b.kind == "prd" { "section of the document (Markdown)" } else { "component of the page (one HTML fragment)" };
    format!(
        "You are the orchestrator of a swarm of {n} worker agents. Each worker is stateless and has no tools: it sees ONLY the shared contract \
and its own component entry from your plan, never the brief and never the other components. So every spec must be complete on its own.\n\n\
Split the brief into EXACTLY {n} components; each component is one {unit} owned by one agent. Cover every item of must_show across the {n} components \
(merge items when {n} is small, split them when {n} is large). Order components in reading order.\n\n\
Reply with ONE JSON object and nothing else, in this shape:\n\
{{\"summary\": \"one sentence: how you split the work\",\n \"shared\": {{\"style_guide\": \"rules every worker follows (tone, fonts, spacing, wording)\",\n   \
\"css_variables\": {{\"--{p}fg\": \"#000\", \"--{p}bg\": \"#fff\", \"...\": \"...\"}},\n   \"heading_levels\": \"which heading level each part uses\"}},\n \
\"components\": [{{\"id\": \"kebab-case-id\", \"owner\": \"agent name, kebab-case, unique\", \"purpose\": \"one sentence\",\n   \
\"spec\": \"precise: exact content and numbers to show, element structure, class names (all start with {p}), layout\",\n   \
\"interfaces\": [\"what this component relies on or provides to others: CSS variables, heading levels, ids, numbering prefixes\"],\n   \
\"acceptance\": [\"checkable sentences; put exact required strings in double quotes, e.g. Contains the text \\\"9 of 9\\\"\"],\n   \
\"budget_bytes\": 2500}}]}}\n\n\
Rules: a spec DESCRIBES the component in words (content, structure, class names); it does not contain the finished markup or text, and it never uses \
placeholders such as \"one-line description\": write the real wording the worker must use. ids unique; budget_bytes between 1200 and 6000; 3 to 5 acceptance sentences each; never nest quotes inside a quoted string; a quoted string must appear as one run of visible text (for a table, quote single cells or whole rows written as their cell texts separated by spaces); quote only strings that must appear verbatim in that \
component's output.",
        p = b.class_prefix
    )
}

fn contract(b: &Brief, plan: &Plan) -> String {
    let vars: Vec<String> = plan.shared.css_variables.iter().map(|(k, v)| format!("{k}: {}", v.as_str().map(str::to_owned).unwrap_or(v.to_string()))).collect();
    let mut s = format!("Shared contract for every agent in this swarm\nTone: {}\nConstraints:\n", b.tone);
    for c in &b.constraints {
        s += &format!("- {c}\n");
    }
    s += &format!("Style guide: {}\nHeading levels: {}\n", plan.shared.style_guide, plan.shared.heading_levels);
    if b.kind == "ui" {
        s += &format!("CSS variables (already defined on :root by the page shell; use var(...)): {}\nClass prefix: {}\n", vars.join("; "), b.class_prefix);
    }
    s
}

fn worker_system(b: &Brief, shared: &str) -> String {
    let out = if b.kind == "prd" {
        "Reply with the Markdown for your section only: no preamble, no code fences, no closing remarks."
    } else {
        "Reply with the HTML fragment only: no preamble, no code fences, no closing remarks."
    };
    format!("You are one worker in a swarm. You build exactly one component of a larger {} and nothing else.\n\n{shared}\n{out}",
        if b.kind == "prd" { "document" } else { "page" })
}

fn worker_task(c: &Component, b: &Brief, failed: &[String]) -> String {
    let mut s = format!(
        "Your component\nid: {}\npurpose: {}\nspec: {}\ninterfaces: {}\nacceptance:\n{}\nsize budget: at most {} bytes.\n",
        c.id, c.purpose, c.spec, c.interfaces.join("; "),
        c.acceptance.iter().map(|a| format!("- {a}")).collect::<Vec<_>>().join("\n"), c.budget_bytes
    );
    if b.kind == "ui" {
        s += &format!("Root element: <section class=\"fa-component\" data-component=\"{}\">.\n", c.id);
    }
    if !failed.is_empty() {
        s += &format!("\nYour previous attempt failed these checks; fix them:\n- {}\n", failed.join("\n- "));
    }
    s
}

/// Strip ``` fences a model may add anyway.
fn clean(s: &str) -> String {
    let t = s.trim();
    let t = t.strip_prefix("```html").or_else(|| t.strip_prefix("```markdown")).or_else(|| t.strip_prefix("```md")).or_else(|| t.strip_prefix("```")).unwrap_or(t);
    let t = t.strip_suffix("```").unwrap_or(t);
    t.trim().to_string() + "\n"
}

// ---------------------------------------------------------------- checks -------------------------------------------

#[derive(Serialize, Clone)]
struct Check {
    name: String,
    pass: Option<bool>, // None = not mechanically checkable
    detail: String,
}

fn ck(name: &str, pass: bool, detail: impl Into<String>) -> Check {
    Check { name: name.into(), pass: Some(pass), detail: detail.into() }
}

fn quoted(s: &str) -> Vec<String> {
    let mut v = vec![];
    // models sometimes nest quotes (\"FR-1: \\\"text\\\"\"): unescape, split, keep pieces of 3+ chars
    let norm = s.replace(['\u{201c}', '\u{201d}'], "\"").replace("\\\"", "\"");
    let parts: Vec<&str> = norm.split('"').collect();
    for (i, p) in parts.iter().enumerate() {
        let p = p.trim().trim_end_matches(':').trim();
        if i % 2 == 1 && p.chars().count() >= 3 && i + 1 < parts.len() {
            v.push(p.to_string());
        }
    }
    v
}

fn check_component(b: &Brief, c: &Component, text: &str) -> Vec<Check> {
    let mut v = vec![];
    let bytes = text.len() as u64;
    v.push(ck("non_empty", text.trim().len() > 20, format!("{bytes} bytes")));
    // budget: 25% grace, since models count badly
    v.push(ck("size_budget", bytes <= c.budget_bytes + c.budget_bytes / 4, format!("{bytes} of {} bytes (+25% grace)", c.budget_bytes)));
    let low = text.to_lowercase();
    if b.kind == "ui" {
        let p = &b.class_prefix;
        v.push(ck("root_element", text.contains(&format!("data-component=\"{}\"", c.id)), format!("data-component=\"{}\"", c.id)));
        let mut bad = vec![];
        let mut n = 0;
        for chunk in text.split("class=\"").skip(1) {
            for cls in chunk.split('"').next().unwrap_or("").split_whitespace() {
                n += 1;
                if !cls.starts_with(p.as_str()) {
                    bad.push(cls.to_string());
                }
            }
        }
        v.push(ck("class_prefix", n > 0 && bad.is_empty(), if bad.is_empty() { format!("{n} classes, all {p}") } else { format!("not {p}: {}", bad.join(" ")) }));
        v.push(ck("no_script", !low.contains("<script"), "no <script>"));
        // the shell owns .fa-component; a fragment restyling it would change every other agent's section
        let styles: String = low.split("<style").skip(1).map(|x| x.split("</style>").next().unwrap_or("")).collect();
        v.push(ck("no_shared_override", !styles.contains(&format!(".{p}component")), format!("<style> does not target .{p}component")));
        let ext = ["<link", "@import", "src=\"http", "href=\"http", "url(http", "src='http"].iter().filter(|x| low.contains(*x)).count();
        v.push(ck("no_external_assets", ext == 0, "no <link>, @import or http src/href/url"));
        v.push(ck("no_page_tags", !low.contains("<html") && !low.contains("<body") && !low.contains("<head>") && !low.contains("<head "), "fragment, not a page"));
    } else {
        let first = text.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
        v.push(ck("starts_with_h2", first.starts_with("## "), cut(first, 80)));
        let h1 = text.lines().any(|l| l.starts_with("# "));
        let h2 = text.lines().filter(|l| l.starts_with("## ")).count();
        v.push(ck("one_h2_no_h1", !h1 && h2 == 1, format!("h1={h1} h2={h2}")));
        v.push(ck("no_html", !low.contains("<div") && !low.contains("<img") && !low.contains("<script"), "no HTML tags"));
    }
    for a in &c.acceptance {
        let q = quoted(a);
        if q.is_empty() {
            v.push(Check { name: format!("acceptance: {a}"), pass: None, detail: "not mechanically checkable".into() });
        } else {
            let vis = visible(text).to_lowercase();
            let miss: Vec<&String> = q.iter().filter(|s| {
                let s = s.to_lowercase();
                !low.contains(&s) && !vis.contains(&s.split_whitespace().collect::<Vec<_>>().join(" "))
            }).collect();
            v.push(ck(&format!("acceptance: {a}"), miss.is_empty(), if miss.is_empty() { "all quoted strings present".into() } else { format!("missing {:?}", miss) }));
        }
    }
    v
}

/// Visible text of an HTML fragment: <style> dropped, tags become spaces, whitespace collapsed (so a quoted table row matches its cells).
fn visible(html: &str) -> String {
    let mut out = String::new();
    let mut rest = html;
    while let Some(a) = rest.find("<style") {
        out += &rest[..a];
        rest = rest[a..].find("</style>").map(|b| &rest[a + b + 8..]).unwrap_or("");
    }
    out += rest;
    let mut t = String::new();
    let mut in_tag = false;
    for ch in out.chars() {
        match ch {
            '<' => { in_tag = true; t.push(' '); }
            '>' => in_tag = false,
            c if !in_tag => t.push(c),
            _ => {}
        }
    }
    let t = t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&nbsp;", " ").replace('\u{a0}', " ");
    t.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn failed(cs: &[Check]) -> Vec<String> {
    cs.iter().filter(|c| c.pass == Some(false)).map(|c| format!("{} ({})", c.name, c.detail)).collect()
}

// ---------------------------------------------------------------- assembly -----------------------------------------

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

fn assemble(b: &Brief, plan: &Plan, frags: &[(Component, String)], dir: &Path) -> Result<PathBuf> {
    if b.kind == "prd" {
        let mut s = format!("# {}\n\n> {}\n>\n> Written by a swarm of {} agents, one section each. Plan: plan.json. Checks: report.json.\n\n", b.title, b.goal, frags.len());
        for (_, t) in frags {
            s += t.trim();
            s += "\n\n";
        }
        let p = dir.join("PRD.md");
        std::fs::write(&p, s)?;
        return Ok(p);
    }
    let vars: String = plan.shared.css_variables.iter()
        .map(|(k, v)| format!("  {k}: {};\n", v.as_str().map(str::to_owned).unwrap_or(v.to_string()).replace([';', '}', '{'], "")))
        .collect();
    let mut s = format!(
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>{t}</title>\n<style>\n:root {{\n{vars}}}\n\
html {{ background: #fff; color: #000; }}\nbody {{ margin: 0 auto; max-width: 960px; padding: 24px 16px; font: 15px/1.5 system-ui, sans-serif; background: #fff; color: #000; }}\n\
.fa-component {{ border-top: 1px solid #000; padding: 16px 0; }}\ntable {{ border-collapse: collapse; }}\n</style>\n</head>\n<body>\n<!-- assembled from {n} fragments written by {n} agents; see plan.json and report.json -->\n",
        t = esc(&b.title), n = frags.len()
    );
    for (c, t) in frags {
        s += &format!("<!-- {} · owner {} -->\n{}\n", c.id, c.owner, t.trim());
    }
    s += "</body>\n</html>\n";
    let p = dir.join("index.html");
    std::fs::write(&p, s)?;
    Ok(p)
}

// ---------------------------------------------------------------- main -----------------------------------------------

struct Args {
    agents: usize,
    model: String,
    via: Option<String>,
    brief: PathBuf,
    parallel: usize,
    redo: bool,
    quiet: bool,
    out: Option<String>,
}

fn parse() -> Result<Args> {
    let here = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut a = Args { agents: 3, model: "gpt-oss-120b".into(), via: None, brief: here.join("briefs/status-page.toml"), parallel: 4, redo: true, quiet: false, out: None };
    let mut it = std::env::args().skip(1);
    while let Some(k) = it.next() {
        let mut v = || it.next().ok_or_else(|| anyhow!("missing value for {k}"));
        match k.as_str() {
            "--agents" | "-n" => a.agents = v()?.parse()?,
            "--model" => a.model = v()?,
            "--via" => a.via = Some(v()?),
            "--brief" => a.brief = PathBuf::from(v()?),
            "--parallel" => a.parallel = v()?.parse()?,
            "--out" => a.out = Some(v()?),
            "--no-redo" => a.redo = false,
            "--quiet" => a.quiet = true,
            "-h" | "--help" => {
                println!("swarm --agents 3|6 [--model gpt-oss-120b] [--via cerebras] [--brief FILE] [--parallel 4] [--out NAME] [--no-redo] [--quiet]");
                std::process::exit(0)
            }
            _ => bail!("unknown argument {k}"),
        }
    }
    if !(1..=24).contains(&a.agents) {
        bail!("--agents must be 1..24");
    }
    Ok(a)
}

fn price(alias: &str) -> (f64, f64) {
    let text = std::fs::read_to_string(root().join("01-config/models.toml")).unwrap_or_default();
    let cfg: toml::Value = toml::from_str(&text).unwrap_or(toml::Value::Integer(0));
    let p = cfg.get("models").and_then(|m| m.get(alias)).and_then(|m| m.get("price")).and_then(|p| p.as_array());
    let f = |i: usize| p.and_then(|p| p.get(i)).and_then(|v| v.as_float().or(v.as_integer().map(|x| x as f64))).unwrap_or(0.0);
    (f(0), f(1))
}

type Agent = SwarmsAgent<Traced>;

fn build_agent(model: Traced, name: &str, system: String, max_tokens: u64) -> Agent {
    SwarmsAgentBuilder::new_with_model(model)
        .agent_name(name)
        .system_prompt(system)
        .max_loops(1)
        .max_tokens(max_tokens)
        .temperature(0.2)
        .retry_attempts(1) // retries are the governor's job, so they show in the trace
        .disable_task_complete_tool()
        .pretty_print_on(false)
        .verbose(false)
        .build()
}

/// One governed call: wait for a slot, then prompt; on HTTP 429 back off (2 s, 4 s, 8 s) and retry.
async fn governed(gov: &Semaphore, agent: &Agent, tr: &Trace, task: String) -> Result<String> {
    let _slot = gov.acquire().await?;
    let mut wait = 2;
    for attempt in 0..4 {
        match agent.prompt(task.clone()).await {
            Ok(t) => return Ok(t),
            Err(e) => {
                let msg = tr.scrub(&cut(&e.to_string(), 300));
                if is_rate_limit(&msg) && attempt < 3 {
                    tr.ev("message", 0, json!({"to": tr.agent, "output": format!("governor: rate limited (429), waiting {wait}s then retrying")}));
                    tokio::time::sleep(Duration::from_secs(wait)).await;
                    wait *= 2;
                    continue;
                }
                bail!(msg);
            }
        }
    }
    bail!("rate limited 4 times")
}

#[tokio::main]
async fn main() -> Result<()> {
    let a = parse()?;
    let brief: Brief = toml::from_str(&std::fs::read_to_string(&a.brief).with_context(|| format!("{}", a.brief.display()))?)?;
    let n = a.agents;
    let route = registry::resolve(&a.model, a.via.as_deref())?;
    let rid = format!("{}-{}", stamp(), slug(&format!("swarm-{}-{n}-{}", brief.name, a.model)));
    let here = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dir = here.join("out").join(a.out.clone().unwrap_or_else(|| rid.clone()));
    std::fs::create_dir_all(dir.join("components"))?;
    let ext = if brief.kind == "prd" { "md" } else { "html" };
    // gpt-oss reasons before it answers; the provider default (2000) is too small for a plan. Keep a provider cap if it is lower.
    let cap = |want: u64| if route.max_tokens < 2000 { route.max_tokens } else { want };

    let mut tr = Trace::new(&rid, &a.model, vec![route.key.clone()], !a.quiet)?;
    tr.agent = "orchestrator".into();
    tr.ev("run_start", 0, json!({"harness": "swarms-rs", "lang": "rust", "provider": route.provider, "category": "swarm",
        "task": format!("{}-{n}", brief.name), "input": brief.goal, "agents": n, "framework": "swarms-rs 0.3.0", "out": dir.strip_prefix(&here).unwrap_or(&dir).display().to_string()}));
    let totals = Arc::new(Mutex::new(Totals::default()));
    let client = OpenAI::from_url(route.base_url.clone(), route.key.clone()).set_model(route.model.clone());
    let traced = |t: &Trace| Traced { inner: client.clone(), trace: t.clone(), step: Arc::new(Mutex::new(0)), totals: totals.clone() };
    let gov = Arc::new(Semaphore::new(a.parallel.max(1)));
    let t0 = Instant::now();

    // ---- 1. orchestrator: brief -> plan (one call, re-asked once on invalid JSON / failed validation)
    let orch_model = traced(&tr);
    let orch = build_agent(orch_model.clone(), "orchestrator", planner_system(&brief, n), cap(8000));
    let brief_json = serde_json::to_string_pretty(&brief)?;
    let mut ask = format!("Brief:\n{brief_json}\n\nMake the plan for exactly {n} agents.");
    let mut plan: Option<Plan> = None;
    let mut last_err = String::new();
    for attempt in 0..2 {
        let reply = match governed(&gov, &orch, &tr, ask.clone()).await {
            Ok(r) => r,
            Err(e) => { last_err = e.to_string(); continue; }
        };
        std::fs::write(dir.join(format!("plan.raw{}.txt", attempt + 1)), &reply)?;
        let parsed = extract_json(&reply).ok_or_else(|| anyhow!("no JSON object in reply")).and_then(|j| serde_json::from_str::<Plan>(j).map_err(|e| anyhow!("invalid JSON: {e}")));
        match parsed.and_then(|mut p| validate(&mut p, n, &brief.kind).map(|_| p)) {
            Ok(p) => { plan = Some(p); break; }
            Err(e) => {
                last_err = e.to_string();
                tr.ev("message", 0, json!({"to": "orchestrator", "output": format!("plan rejected: {last_err}; re-asking once")}));
                ask = format!("Brief:\n{brief_json}\n\nYour previous plan was rejected: {last_err}. Reply again with ONE valid JSON object with exactly {n} components.");
            }
        }
    }
    let Some(plan) = plan else {
        let ms = t0.elapsed().as_millis() as u64;
        let tot = totals.lock().unwrap();
        tr.ev("run_end", 1, json!({"ok": false, "steps": tot.calls, "tokens_in": tot.tokens_in, "tokens_out": tot.tokens_out, "ms": ms, "cost_usd": 0, "output": "", "error": format!("no valid plan: {last_err}")}));
        bail!("no valid plan: {last_err}");
    };
    std::fs::write(dir.join("plan.json"), serde_json::to_string_pretty(&plan)?)?;
    let orch_steps = *orch_model.step.lock().unwrap();
    tr.ev("message", orch_steps, json!({"to": "swarm", "output": format!("plan: {} · {}", plan.summary,
        plan.components.iter().map(|c| format!("{}→{}", c.owner, c.id)).collect::<Vec<_>>().join(", "))}));

    // ---- 2. workers: one stateless, tool-less swarms-rs agent per component, run concurrently through the governor
    let shared = contract(&brief, &plan);
    let mut workers = vec![];
    for c in &plan.components {
        tr.ev("agent_spawn", orch_steps, json!({"child": c.owner, "role": c.id, "input": format!("{} — {}", c.purpose, c.spec), "output": format!("{} → {}: {}", c.owner, c.id, c.purpose)}));
        let me = tr.child(&c.owner, None);
        let m = traced(&me);
        workers.push((c.clone(), me, build_agent(m, &c.owner, worker_system(&brief, &shared), cap(6000))));
    }
    let run_worker = |c: Component, me: Trace, ag: Arc<Agent>, fails: Vec<String>| {
        let gov = gov.clone();
        let (brief, dir) = (brief.clone(), dir.clone());
        async move {
            let text = match governed(&gov, &ag, &me, worker_task(&c, &brief, &fails)).await {
                Ok(t) => clean(&t),
                Err(e) => { me.ev("message", 1, json!({"to": "orchestrator", "output": format!("worker failed: {e}")})); String::new() }
            };
            let path = dir.join("components").join(format!("{}.{}", c.id, if brief.kind == "prd" { "md" } else { "html" }));
            let step = 1 + fails.len().min(1) as u64;
            me.ev("tool_start", step, json!({"tool": "write_component", "input": path.file_name().unwrap().to_string_lossy()}));
            let t = Instant::now();
            let ok = !text.trim().is_empty() && std::fs::write(&path, &text).is_ok();
            me.ev("tool_end", step, json!({"tool": "write_component", "ms": t.elapsed().as_millis() as u64, "ok": ok, "output": format!("{} bytes · {}", text.len(), cut(&text, 200))}));
            (c, text)
        }
    };
    let agents: Vec<(Component, Trace, Arc<Agent>)> = workers.into_iter().map(|(c, t, ag)| (c, t, Arc::new(ag))).collect();
    let mut frags: Vec<(Component, String)> =
        futures::future::join_all(agents.iter().map(|(c, t, ag)| run_worker(c.clone(), t.clone(), ag.clone(), vec![]))).await;

    // ---- 3. check; redo failed components once (no loop)
    let mut checks: Vec<Vec<Check>> = frags.iter().map(|(c, t)| check_component(&brief, c, t)).collect();
    let mut redone = vec![];
    if a.redo {
        let todo: Vec<usize> = (0..frags.len()).filter(|&i| !failed(&checks[i]).is_empty()).collect();
        if !todo.is_empty() {
            tr.ev("message", orch_steps, json!({"to": "swarm", "output": format!("redo once: {}", todo.iter().map(|&i| frags[i].0.id.clone()).collect::<Vec<_>>().join(", "))}));
            let again = futures::future::join_all(todo.iter().map(|&i| {
                let (c, t, ag) = &agents[i];
                run_worker(c.clone(), t.clone(), ag.clone(), failed(&checks[i]))
            })).await;
            for (&i, r) in todo.iter().zip(again) {
                let cs = check_component(&brief, &r.0, &r.1);
                // keep the better attempt
                if failed(&cs).len() <= failed(&checks[i]).len() && !r.1.trim().is_empty() {
                    frags[i] = r;
                    checks[i] = cs;
                }
                redone.push(frags[i].0.id.clone());
            }
            // the file on disk must be the kept attempt
            for &i in &todo {
                let p = dir.join("components").join(format!("{}.{ext}", frags[i].0.id));
                std::fs::write(p, &frags[i].1)?;
            }
        }
    }

    // ---- 4. assemble (code, no model) and report
    tr.ev("tool_start", orch_steps, json!({"tool": "assemble", "input": format!("{} fragments", frags.len())}));
    let ta = Instant::now();
    let out = assemble(&brief, &plan, &frags, &dir)?;
    let rel = out.strip_prefix(root()).unwrap_or(&out).display().to_string();
    tr.ev("tool_end", orch_steps, json!({"tool": "assemble", "ms": ta.elapsed().as_millis() as u64, "ok": true, "output": rel}));

    let ms = t0.elapsed().as_millis() as u64;
    let (pin, pout) = price(&a.model);
    let tot = totals.lock().unwrap();
    let cost = ((tot.tokens_in as f64 * pin + tot.tokens_out as f64 * pout) / 1e6 * 1e6).round() / 1e6;
    let all: Vec<&Check> = checks.iter().flatten().collect();
    let passed = all.iter().filter(|c| c.pass == Some(true)).count();
    let failed_n = all.iter().filter(|c| c.pass == Some(false)).count();
    let manual = all.iter().filter(|c| c.pass.is_none()).count();
    let ok = failed_n == 0;
    let report = json!({
        "run": rid, "brief": brief.name, "kind": brief.kind, "agents": n, "model": a.model, "provider": route.provider, "harness": "swarms-rs 0.3.0",
        "ok": ok, "wall_ms": ms, "model_calls": tot.calls, "tokens_in": tot.tokens_in, "tokens_out": tot.tokens_out, "cost_usd": cost,
        "checks": {"passed": passed, "failed": failed_n, "not_checkable": manual}, "redone": redone, "output": rel,
        "components": frags.iter().zip(&checks).map(|((c, t), cs)| json!({"id": c.id, "owner": c.owner, "bytes": t.len(), "budget_bytes": c.budget_bytes,
            "ok": failed(cs).is_empty(), "checks": cs})).collect::<Vec<_>>(),
    });
    std::fs::write(dir.join("report.json"), serde_json::to_string_pretty(&report)?)?;
    tr.ev("run_end", orch_steps, json!({"ok": ok, "steps": tot.calls, "tokens_in": tot.tokens_in, "tokens_out": tot.tokens_out, "ms": ms, "cost_usd": cost,
        "output": rel, "error": if ok { Value::Null } else { json!(format!("{failed_n} checks failed")) }}));
    println!("{}", json!({"run": rid, "ok": ok, "agents": n, "wall_ms": ms, "tokens_in": tot.tokens_in, "tokens_out": tot.tokens_out, "cost_usd": cost,
        "checks_passed": passed, "checks_failed": failed_n, "not_checkable": manual, "output": rel, "trace": format!("04-traces/live/{rid}.jsonl")}));
    Ok(())
}
