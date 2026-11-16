//! Rust port of 01-config/registry.py: resolve(alias, provider) -> base URL, key, model id.
use anyhow::{Context, Result, anyhow};
use std::collections::HashMap;

pub struct Route {
    pub base_url: String,
    pub key: String,
    pub key_env: String,
    pub model: String,
    pub provider: String,
    pub max_tokens: u64,
}

pub fn key_files() -> Vec<std::path::PathBuf> {
    vec![crate::home().join(".config/icm-agent-demo/keys.env"), crate::root().join(".env")]
}

pub fn keys() -> HashMap<String, String> {
    // same order as the Python registry: keys.env, then ./.env, then the shell environment wins
    let mut d: HashMap<String, String> = HashMap::new();
    for p in key_files() {
        if let Ok(text) = std::fs::read_to_string(p) {
            for l in text.lines() {
                let l = l.split(" #").next().unwrap_or("").trim();
                if l.starts_with('#') {
                    continue;
                }
                if let Some((k, v)) = l.split_once('=') {
                    let v = v.trim().trim_matches(|c| c == '"' || c == '\'');
                    if !v.is_empty() && !v.starts_with("your-") {
                        d.insert(k.trim().to_string(), v.to_string());
                    }
                }
            }
        }
    }
    d.extend(std::env::vars().filter(|(_, v)| !v.is_empty()));
    d
}

pub fn resolve(alias: &str, via: Option<&str>) -> Result<Route> {
    let text = std::fs::read_to_string(crate::root().join("01-config/models.toml")).context("01-config/models.toml")?;
    let cfg: toml::Value = toml::from_str(&text)?;
    let m = cfg.get("models").and_then(|m| m.get(alias)).ok_or_else(|| anyhow!("unknown model alias {alias}"))?;
    let k = keys();
    for r in m.get("routes").and_then(|r| r.as_array()).ok_or_else(|| anyhow!("no routes for {alias}"))? {
        let prov = r.get(0).and_then(|v| v.as_str()).unwrap_or_default();
        let mid = r.get(1).and_then(|v| v.as_str()).unwrap_or_default();
        if via.is_some_and(|v| v != prov) {
            continue;
        }
        let p = cfg.get("providers").and_then(|p| p.get(prov)).ok_or_else(|| anyhow!("unknown provider {prov}"))?;
        let key_env = p.get("key_env").and_then(|v| v.as_str()).unwrap_or_default();
        if let Some(key) = k.get(key_env).filter(|v| !v.is_empty()) {
            let base = p.get("base_url").and_then(|v| v.as_str()).unwrap_or_default().replace("{model}", mid);
            return Ok(Route {
                base_url: base,
                key: key.clone(),
                key_env: key_env.to_string(),
                model: mid.to_string(),
                provider: prov.to_string(),
                max_tokens: p.get("max_tokens").and_then(|v| v.as_integer()).unwrap_or(2000) as u64,
            });
        }
    }
    Err(anyhow!("no usable route for {alias}{}", via.map(|v| format!(" via {v}")).unwrap_or_default()))
}
