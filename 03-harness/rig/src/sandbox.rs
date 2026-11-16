//! The same bubblewrap sandbox as `sh()` in 03-harness/common.py:
//! read-only filesystem except ./scratch, secret directories and key files hidden, environment cleared.
use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};

pub const HIDE: &[&str] = &[
    "01-System", ".config/icm-agent-demo", ".config/atlas-organizer", ".ssh", ".gnupg", ".hermes", ".pi", ".codex",
    ".claude", ".config/Claude", ".config/telegram-user", "02-Agents", ".aws", ".config/gh",
];
const OUT_CAP: usize = 3000;

pub struct ShOut {
    /// What the model sees: output + "\n[exit N]" (or the timeout marker).
    pub text: String,
    pub exit: Option<i32>,
    pub ms: u64,
}

pub fn bwrap_args(root: &Path) -> Vec<String> {
    let home = crate::home();
    let scratch = root.join("scratch");
    let _ = std::fs::create_dir_all(&scratch);
    let s = |p: &Path| p.to_string_lossy().to_string();
    let mut a: Vec<String> = ["--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp", "--bind"].iter().map(|s| s.to_string()).collect();
    a.push(s(&scratch));
    a.push(s(&scratch));
    for h in HIDE {
        let p = home.join(h);
        if p.is_dir() {
            a.push("--tmpfs".into());
            a.push(s(&p));
        }
    }
    for f in crate::registry::key_files() {
        if f.exists() {
            a.extend(["--ro-bind".to_string(), "/dev/null".to_string(), s(&f)]);
        }
    }
    let path = format!("{}/02-agent/tools:{}/.local/bin:/usr/local/bin:/usr/bin:/bin", s(root), s(&home));
    for x in ["--clearenv", "--setenv", "PATH", &path, "--setenv", "HOME", &s(&home), "--setenv", "LANG", "C.UTF-8",
        "--chdir", &s(root), "--die-with-parent", "bash", "-c"] {
        a.push(x.to_string());
    }
    a
}

pub async fn sh(cmd: &str, root: &Path) -> ShOut {
    let t0 = Instant::now();
    let mut args = bwrap_args(root);
    args.push(cmd.to_string());
    let child = tokio::process::Command::new("bwrap").args(&args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true).spawn();
    let ms = |t: Instant| t.elapsed().as_millis() as u64;
    let child = match child {
        Ok(c) => c,
        Err(e) => return ShOut { text: format!("[error: cannot start sandbox (is bubblewrap installed?): {e}]"), exit: None, ms: ms(t0) },
    };
    match tokio::time::timeout(Duration::from_secs(60), child.wait_with_output()).await {
        Ok(Ok(o)) => {
            let mut out = String::from_utf8_lossy(&o.stdout).to_string();
            out.push_str(&String::from_utf8_lossy(&o.stderr));
            let out = out.trim().to_string();
            let n = out.chars().count();
            let out = if n <= OUT_CAP {
                out
            } else {
                let head: String = out.chars().take(OUT_CAP - 600).collect();
                let tail: String = out.chars().skip(n - 500).collect();
                format!("{head}\n...[{} chars cut; bound your output]...\n{tail}", n - OUT_CAP)
            };
            let code = o.status.code().unwrap_or(-1);
            ShOut { text: format!("{out}\n[exit {code}]"), exit: Some(code), ms: ms(t0) }
        }
        Ok(Err(e)) => ShOut { text: format!("[error: {e}]"), exit: None, ms: ms(t0) },
        Err(_) => ShOut { text: "[timeout after 60s]".into(), exit: None, ms: ms(t0) },
    }
}
