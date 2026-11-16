"""What every harness shares: the agent's context, the sandboxed bash tool, the card tool, tasks, checks, result rows."""
import json, os, pathlib, re, shutil, subprocess, sys, time, tomllib

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / '01-config'))
import registry  # noqa: E402

HOME = pathlib.Path.home()
AGENT = ROOT / '02-agent'
SCRATCH = ROOT / 'scratch'
# directories hidden from the agent's shell (they hold keys, tokens or other agents' private state)
HIDE = ['01-System', '.config/icm-agent-demo', '.config/atlas-organizer', '.ssh', '.gnupg', '.hermes', '.pi', '.codex',
        '.claude', '.config/Claude', '.config/telegram-user', '02-Agents', '.aws', '.config/gh']
OUT_CAP = 3000


def system_prompt():
    return (AGENT / 'AGENTS.md').read_text() + '\n\n' + (AGENT / 'cli-index/INDEX.md').read_text()


def cards():
    return {p.stem: p.read_text() for p in sorted((AGENT / 'cli-index/cards').glob('*.md'))}


def card(name):
    c = cards()
    name = name.strip().strip('`').removesuffix('.md')
    return c.get(name) or f'no card named {name!r}. Cards: {", ".join(c)}'


def tasks():
    return {t['id']: t for t in tomllib.loads((AGENT / 'tasks/tasks.toml').read_text())['task']}


def sh(cmd, timeout=60):
    """Run one command for the agent. Inside bubblewrap when available: the filesystem is read-only except ./scratch,
    secret directories are hidden, the environment is cleared. Returns (output, ok)."""
    SCRATCH.mkdir(exist_ok=True)
    path = f'{AGENT}/tools:{HOME}/.local/bin:/usr/local/bin:/usr/bin:/bin'
    if shutil.which('bwrap') and not os.environ.get('NO_SANDBOX'):
        args = ['bwrap', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--tmpfs', '/tmp', '--bind', str(SCRATCH), str(SCRATCH)]
        for h in HIDE:
            if (HOME / h).is_dir():
                args += ['--tmpfs', str(HOME / h)]
        for f in registry.KEY_FILES:
            if f.exists():
                args += ['--ro-bind', '/dev/null', str(f)]
        args += ['--clearenv', '--setenv', 'PATH', path, '--setenv', 'HOME', str(HOME), '--setenv', 'LANG', 'C.UTF-8',
                 '--chdir', str(ROOT), '--die-with-parent', 'bash', '-c', cmd]
        env = None
    else:
        args, env = ['bash', '-c', cmd], {'PATH': path, 'HOME': str(HOME), 'LANG': 'C.UTF-8'}
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout, cwd=ROOT, env=env)
        out = (p.stdout + p.stderr).strip()
        if len(out) > OUT_CAP:
            out = out[:OUT_CAP - 600] + f'\n...[{len(out) - OUT_CAP} chars cut; bound your output]...\n' + out[-500:]
        return f'{out}\n[exit {p.returncode}]', p.returncode == 0
    except subprocess.TimeoutExpired:
        return f'[timeout after {timeout}s]', False


def check(task, answer):
    """True/False when the task has expectations, None for free-text tasks."""
    if not task or not task.get('expect'):
        return None
    ok = all(re.search(rx, answer or '', re.I) for rx in task['expect'])
    if task.get('file'):
        f = ROOT / task['file']
        text = f.read_text(errors='replace') if f.exists() else ''
        ok = (ok and bool(text.strip()) and len(text.splitlines()) >= task.get('file_min_lines', 1)
              and bool(re.search(task.get('file_contains', ''), text)))
    return ok


def record(row):
    """Append one row to the benchmark results file."""
    row = {'date': time.strftime('%Y-%m-%dT%H:%M:%S'), **row}
    with open(ROOT / '07-bench/results.jsonl', 'a') as f:
        f.write(json.dumps(row, ensure_ascii=False) + '\n')
    return row
