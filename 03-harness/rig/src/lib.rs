//! The primary harness: a rig (rig-core + rig-agent 0.46) agent with two tools, `bash` and `card`.
//! Same context (02-agent/), same sandbox rules, same tasks and same trace format (04-traces/SCHEMA.md v2)
//! as the LangChain fallback in 03-harness/langchain/agent.py.
pub mod agent;
pub mod registry;
pub mod sandbox;
pub mod trace;

use std::path::PathBuf;

/// Repo root: $ICM_ROOT, else two levels above this crate (03-harness/rig -> repo).
pub fn root() -> PathBuf {
    if let Ok(r) = std::env::var("ICM_ROOT") {
        return PathBuf::from(r);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..").canonicalize().expect("repo root")
}

pub fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").expect("HOME"))
}

pub fn now() -> f64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs_f64()
}

/// time.strftime('%Y%m%d-%H%M%S') in local time.
pub fn stamp() -> String {
    chrono::Local::now().format("%Y%m%d-%H%M%S").to_string()
}

/// re.sub(r'[^A-Za-z0-9.]+', '_', s)
pub fn slug(s: &str) -> String {
    let mut out = String::new();
    let mut last_us = false;
    for c in s.chars() {
        if c.is_ascii_alphanumeric() || c == '.' {
            out.push(c);
            last_us = false;
        } else if !last_us {
            out.push('_');
            last_us = true;
        }
    }
    out
}

pub fn cut(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}
