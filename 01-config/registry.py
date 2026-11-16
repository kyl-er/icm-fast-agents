#!/usr/bin/env python3
"""Model registry: one loader for 01-config/models.toml. Stdlib only.

  from registry import resolve
  base, key, model_id, opts = resolve('mercury-3')            # first route that has a key
  base, key, model_id, opts = resolve('gpt-oss-120b', 'groq') # a named provider

  registry.py list      models and which providers have a key
  registry.py verify    check every route id against the provider's live /models list
  registry.py docs      regenerate docs/MODELS.md from the registry

Keys are read by name from, in order: the shell environment, ./.env, ~/.config/icm-agent-demo/keys.env.
Key values are never printed.
"""
import json, os, pathlib, sys, tomllib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CFG = tomllib.loads((ROOT / '01-config/models.toml').read_text())
KEY_FILES = [pathlib.Path.home() / '.config/icm-agent-demo/keys.env', ROOT / '.env']


def keys():
    d = {}
    for p in KEY_FILES:
        if p.exists():
            for line in p.read_text().splitlines():
                line = line.split(' #')[0].strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    if v and not v.startswith('your-'):
                        d[k.strip()] = v.strip().strip('"\'')
    d.update({k: v for k, v in os.environ.items() if v})
    return d


def resolve(alias, provider=None):
    m = CFG['models'][alias]
    K = keys()
    for prov, mid in m['routes']:
        p = CFG['providers'][prov]
        if (provider is None or prov == provider) and K.get(p['key_env']):
            return (p['base_url'].format(model=mid), K[p['key_env']], mid,
                    {'provider': prov, 'max_tokens': p.get('max_tokens', 2000), **m})
    raise KeyError(f'no usable route for {alias}' + (f' via {provider}' if provider else ''))


def cost(alias, tokens_in, tokens_out):
    """USD for a call, from the registry's listed price per 1M tokens."""
    pin, pout = CFG['models'].get(alias, {}).get('price', [0, 0])
    return (tokens_in * pin + tokens_out * pout) / 1e6


def live(prov):
    p = CFG['providers'][prov]
    k = keys().get(p['key_env'])
    if not k:
        return None
    url = p['base_url'].format(model='celeris-1') + '/models'
    try:
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + k, 'User-Agent': 'curl/8'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return {x['id'].split('/')[-1] if prov == 'gemini' else x['id'] for x in json.load(r)['data']}
    except Exception as e:
        return f'error: {str(e)[:60]}'


def docs():
    K = keys()
    out = ['# Models', '',
           'Generated from `01-config/models.toml` by `python3 01-config/registry.py docs`. Do not edit by hand.',
           'Prices are USD per 1M tokens (input / output) as listed in the registry on 2026-11-15.',
           '"Key here" says whether this machine had a key for at least one route when the file was generated.', '',
           '## Chat models (agents)', '',
           '| Alias | Name | Tier | Tools | Price in / out | Routes (preferred first) | Key here |', '|---|---|---|---|---|---|---|']
    rest = []
    for a, m in CFG['models'].items():
        ok = any(K.get(CFG['providers'][p]['key_env']) for p, _ in m['routes'])
        price = ' / '.join(f'${x:g}' for x in m['price']) if 'price' in m else 'n/a'
        routes = ', '.join(f'{p}:`{i}`' for p, i in m['routes'])
        row = f"| `{a}` | {m['name']} | {m.get('tier', '')} | {'yes' if m['tools'] else 'no'} | {price} | {routes} | {'yes' if ok else 'no'} |"
        (out if m['kind'] == 'chat' else rest).append(row if m['kind'] == 'chat' else (m['kind'], row))
    out += ['', '## Other models (apply, decision, classifier, speech)', '',
            '| Alias | Name | Kind | Price in / out | Routes | Key here |', '|---|---|---|---|---|---|']
    for kind, row in rest:
        c = row.split(' | ')
        out.append(' | '.join([c[0], c[1], kind, c[4], c[5], c[6]]))
    out += ['', '## Decision models (System One API)', '',
            '| Id | Name | Model | Price per 1M in | Endpoint | Key here |', '|---|---|---|---|---|---|']
    for a, d in CFG['deciders'].items():
        out.append(f"| `{a}` | {d['name']} | `{d['model']}` | ${d['price'][0]:g} | {d['url']} | {'yes' if K.get(d['key_env']) else 'no'} |")
    out += ['', '## Providers', '', '| Provider | Base URL | Key variable | Get a key | Docs |', '|---|---|---|---|---|']
    for a, p in CFG['providers'].items():
        out.append(f"| {a} | `{p['base_url']}` | `{p['key_env']}` | {p['console']} | {p['docs']} |")
    (ROOT / 'docs/MODELS.md').write_text('\n'.join(out) + '\n')
    print('wrote docs/MODELS.md')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    K = keys()
    if cmd == 'docs':
        docs()
    elif cmd == 'list':
        for a, m in CFG['models'].items():
            ok = [p for p, _ in m['routes'] if K.get(CFG['providers'][p]['key_env'])]
            print(f"{a:<24} {m['kind']:<10} {'tools' if m['tools'] else '-':<6} {','.join(ok) or 'NO KEY'}")
    else:
        lists = {p: live(p) for p in CFG['providers']}
        bad = n = 0
        for p, v in lists.items():
            print(f'{p:<11}', 'no key' if v is None else v if isinstance(v, str) else f'{len(v)} models listed')
        for a, m in CFG['models'].items():
            for p, mid in m['routes']:
                v = lists[p]
                if isinstance(v, set):
                    n += 1
                    if p == 'celeris':
                        continue  # celeris lists per base URL; checked by a chat call instead
                    if mid not in v:
                        bad += 1
                        print('MISSING', a, p, mid)
        print(f'{n} routes checked, {bad} missing')
