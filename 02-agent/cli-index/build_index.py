#!/usr/bin/env python3
"""Regenerate 02-agent/cli-index/INDEX.md from the cards. One line per card: name, category, use-when."""
import pathlib, re
D = pathlib.Path(__file__).resolve().parent
rows = []
for p in sorted((D / 'cards').glob('*.md')):
    t = p.read_text()
    use = re.search(r'^use-when:\s*(.+)$', t, re.M)
    cat = re.search(r'^category:\s*(\w+)', t, re.M)
    rows.append((cat.group(1) if cat else 'files', p.stem, use.group(1).strip() if use else ''))
out = ['# CLI index', '', 'One line per command. Read the full card with `card(name)` before first use.', '']
for cat in sorted({r[0] for r in rows}):
    out.append(f'## {cat}')
    out += [f'- `{n}`: {u}' for c, n, u in rows if c == cat]
    out.append('')
(D / 'INDEX.md').write_text('\n'.join(out))
print(f'{len(rows)} cards -> INDEX.md')
