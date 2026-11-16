//! rig-agent: the fast agent on rig. Two tools (bash, card), context from 02-agent/, any model in 01-config/models.toml.
//!
//!   rig-agent --task web-1 [--model mercury-3] [--via inception] [--max-steps 12] [--record] [--quiet]
//!   rig-agent "free text request" --category files
use anyhow::{Result, anyhow};
use rig_agent::prelude::*;
use rig_agent_demo::agent::{self, Bash, Card, TraceHook};
use rig_agent_demo::{cut, registry, root, slug, stamp, trace::Trace};
use serde_json::{Value, json};
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Instant;

struct Args { prompt: Option<String>, task: Option<String>, model: String, via: Option<String>, category: String, max_steps: usize, record: bool, quiet: bool }

fn parse() -> Result<Args> {
    let mut a = Args { prompt: None, task: None, model: "mercury-3".into(), via: None, category: "adhoc".into(), max_steps: 12, record: false, quiet: false };
    let mut it = std::env::args().skip(1);
    while let Some(k) = it.next() {
        let mut v = || it.next().ok_or_else(|| anyhow!("missing value for {k}"));
        match k.as_str() {
            "--task" => a.task = Some(v()?),
            "--model" => a.model = v()?,
            "--via" => a.via = Some(v()?),
            "--category" => a.category = v()?,
            "--max-steps" => a.max_steps = v()?.parse()?,
            "--record" => a.record = true,
            "--quiet" => a.quiet = true,
            "-h" | "--help" => { println!("rig-agent (--task ID | \"prompt\" [--category C]) [--model ALIAS] [--via PROVIDER] [--max-steps 12] [--record] [--quiet]"); std::process::exit(0) }
            s if s.starts_with("--") => return Err(anyhow!("unknown argument {k}")),
            _ => a.prompt = Some(k),
        }
    }
    Ok(a)
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut a = parse()?;
    let root = root();
    if let Some(id) = &a.task {
        let cfg: toml::Value = toml::from_str(&std::fs::read_to_string(root.join("02-agent/tasks/tasks.toml"))?)?;
        let t = cfg.get("task").and_then(|t| t.as_array()).and_then(|ts| ts.iter().find(|t| t.get("id").and_then(|i| i.as_str()) == Some(id)))
            .ok_or_else(|| anyhow!("unknown task {id}"))?;
        a.prompt = t.get("prompt").and_then(|p| p.as_str()).map(str::to_owned);
        a.category = t.get("category").and_then(|p| p.as_str()).unwrap_or("adhoc").to_owned();
    }
    let prompt = a.prompt.clone().ok_or_else(|| anyhow!("give a prompt or --task ID"))?;
    let task_id = a.task.clone().unwrap_or_else(|| "adhoc".into());
    let route = registry::resolve(&a.model, a.via.as_deref())?;
    let rid = format!("{}-{}", stamp(), slug(&format!("rig-{task_id}-{}", a.model)));
    let system = format!("{}\n\n{}", std::fs::read_to_string(root.join("02-agent/AGENTS.md"))?, std::fs::read_to_string(root.join("02-agent/cli-index/INDEX.md"))?);

    let tr = Trace::new(&rid, &a.model, vec![route.key.clone()], !a.quiet)?;
    tr.ev("run_start", 0, json!({"harness": "rig", "lang": "rust", "provider": route.provider, "category": a.category, "task": task_id, "input": prompt}));

    let stats = agent::shared();
    let rig_agent = AgentBuilder::new(agent::model(&route, &stats))
        .preamble(system)
        .max_tokens(route.max_tokens)
        .temperature(0.0)
        .tool(Bash { root: root.clone(), stats: stats.clone() })
        .tool(Card { root: root.clone(), stats: stats.clone() })
        .add_hook(TraceHook { trace: tr.clone(), stats: stats.clone() })
        .build();

    let t0 = Instant::now();
    let mut tries = 0;
    let (answer, err) = loop {
        match rig_agent.prompt(prompt.clone()).max_turns(a.max_steps).max_invalid_tool_call_retries(3).tool_concurrency(1).await {
            Ok(resp) => break (resp.to_string(), None),
            Err(PromptError::MaxTurns { .. }) => break (String::new(), Some(format!("stopped at the {}-step limit", a.max_steps))),
            Err(e) => {
                let msg = tr.scrub(&cut(&e.to_string(), 300));
                // a provider rate limit (HTTP 429): wait and start the task again, at most twice
                if msg.contains("429") && tries < 2 {
                    tries += 1;
                    tr.ev("message", 0, json!({"to": "main", "output": format!("harness: provider rate limit, waiting {}s then retrying", 4 * tries)}));
                    tokio::time::sleep(std::time::Duration::from_secs(4 * tries)).await;
                    continue;
                }
                break (String::new(), Some(msg));
            }
        }
    };
    let ms = t0.elapsed().as_millis() as u64;

    // grading, cost and the results row live in one place for every harness: 03-harness/check.py
    let (steps, tools, tin, tout) = { let s = stats.lock().unwrap(); (s.step, s.tool_calls, s.tokens_in, s.tokens_out) };
    let row = json!({"run": rid, "harness": "rig", "model": a.model, "provider": route.provider, "category": a.category, "task": task_id,
        "latency_ms": ms, "steps": steps, "tool_calls": tools, "tokens_in": tin, "tokens_out": tout, "error": err, "answer": answer});
    let mut cmd = Command::new("python3");
    cmd.arg(root.join("03-harness/check.py")).current_dir(root.join("03-harness")).stdin(Stdio::piped()).stdout(Stdio::piped());
    if a.record { cmd.arg("--record"); }
    let mut child = cmd.spawn()?;
    child.stdin.take().unwrap().write_all(row.to_string().as_bytes())?;
    let graded: Value = serde_json::from_slice(&child.wait_with_output()?.stdout).unwrap_or(row);

    tr.ev("run_end", steps, json!({"ok": graded.get("success"), "steps": steps, "tokens_in": tin, "tokens_out": tout, "ms": ms,
        "cost_usd": graded.get("cost_usd").cloned().unwrap_or(json!(0)), "output": answer, "error": err}));
    println!("{answer}");
    eprintln!("{graded}");
    Ok(())
}
