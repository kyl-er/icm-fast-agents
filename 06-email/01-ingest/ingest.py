#!/usr/bin/env python3
"""Build 06-email/data/emails.sqlite from a slice of the public Enron corpus.

SOURCE
  dataset : SnowZeng/enron_mail   (raw RFC822 messages from the CMU maildir, key = maildir/<mailbox>/<folder>/<n>)
  shard   : default/train/0000.parquet  (auto-converted parquet, 232 MB, 144,800 messages, 52 mailboxes)
  URL     : https://huggingface.co/datasets/SnowZeng/enron_mail/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet
  licence : apache-2.0 (as stated on the dataset card; underlying Enron data is public record)

Rebuild from scratch (downloads the shard, builds DB, deletes the shard):
  uv run --with pyarrow python 06-email/01-ingest/ingest.py
Options: --keep-raw (keep downloaded shard), --n 3000, --heldout 200, --seed 7
"""
import argparse, hashlib, html, random, re, shutil, sqlite3, sys, urllib.request
from collections import defaultdict
from email import policy
from email.parser import BytesParser
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

import pyarrow.parquet as pq

URL = "https://huggingface.co/datasets/SnowZeng/enron_mail/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet"
HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"
RAW = DATA / "_raw"
DB = DATA / "emails.sqlite"
MAX_BODY = 20_000
PER_BOX_POOL = 150  # reservoir size per mailbox


class _Strip(HTMLParser):
    def __init__(self):
        super().__init__(); self.out = []; self.skip = 0
    def handle_starttag(self, t, a):
        if t in ("script", "style"): self.skip += 1
        if t in ("br", "p", "div", "tr", "li"): self.out.append("\n")
    def handle_endtag(self, t):
        if t in ("script", "style") and self.skip: self.skip -= 1
    def handle_data(self, d):
        if not self.skip: self.out.append(d)


def strip_html(s):
    p = _Strip(); p.feed(s); return html.unescape("".join(p.out))


def get_body(msg):
    plain, htm = [], []
    for part in msg.walk():
        if part.is_multipart() or part.get_content_disposition() == "attachment":
            continue
        ct = part.get_content_type()
        if ct not in ("text/plain", "text/html"):
            continue
        try:
            txt = part.get_content()
        except Exception:
            continue
        (plain if ct == "text/plain" else htm).append(txt)
    body = "\n".join(plain) if plain else strip_html("\n".join(htm))
    body = body.replace("\r\n", "\n").replace("\r", "\n")
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def hdr(msg, k):
    v = msg.get(k)
    return re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""


def parse(raw: bytes):
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    body = get_body(msg)
    try:
        date = parsedate_to_datetime(hdr(msg, "Date")).isoformat()
    except Exception:
        date = ""
    folder = hdr(msg, "X-Folder")
    origin = hdr(msg, "X-Origin")
    return dict(message_id=hdr(msg, "Message-ID"), date=date, sender=hdr(msg, "From"),
                recipients=hdr(msg, "To"), cc=hdr(msg, "Cc"), subject=hdr(msg, "Subject"),
                body=body, folder=" | ".join(x for x in (origin, folder) if x))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3000)
    ap.add_argument("--heldout", type=int, default=200)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--keep-raw", action="store_true")
    a = ap.parse_args()
    rng = random.Random(a.seed)

    RAW.mkdir(parents=True, exist_ok=True)
    shard = RAW / "0000.parquet"
    if not shard.exists():
        print("downloading", URL, flush=True)
        urllib.request.urlretrieve(URL, shard)
    pf = pq.ParquetFile(shard)
    print("shard rows:", pf.metadata.num_rows)

    seen = set(); pools = defaultdict(list); seen_n = defaultdict(int)
    stats = defaultdict(int)
    for rg in range(pf.num_row_groups):
        t = pf.read_row_group(rg)
        keys = t.column(0).to_pylist(); raws = t.column(2).to_pylist()
        for key, raw in zip(keys, raws):
            stats["total"] += 1
            try:
                r = parse(raw)
            except Exception:
                stats["parse_error"] += 1; continue
            b = r["body"]
            if not b: stats["empty"] += 1; continue
            if len(b) > MAX_BODY: stats["too_long"] += 1; continue
            h = hashlib.md5(re.sub(r"\s+", " ", b).lower().encode()).hexdigest()
            if h in seen: stats["dup_body"] += 1; continue
            seen.add(h)
            box = key.split("/")[1]
            r["mailbox"] = box
            if not r["folder"]:
                r["folder"] = f"{box}/" + "/".join(key.split("/")[2:-1])
            seen_n[box] += 1
            pool = pools[box]
            if len(pool) < PER_BOX_POOL: pool.append(r)
            else:
                j = rng.randrange(seen_n[box])
                if j < PER_BOX_POOL: pool[j] = r
    print("filter stats:", dict(stats), "mailboxes:", len(pools))

    # balanced pick: round-robin across mailboxes, random order within each
    for p in pools.values(): rng.shuffle(p)
    order = sorted(pools); picked = []; i = 0
    while len(picked) < a.n and any(i < len(pools[b]) for b in order):
        for b in order:
            if i < len(pools[b]) and len(picked) < a.n: picked.append(pools[b][i])
        i += 1
    rng.shuffle(picked)
    n = len(picked)
    held = set(random.Random(a.seed).sample(range(n), min(a.heldout, n)))

    DATA.mkdir(parents=True, exist_ok=True)
    if DB.exists(): DB.unlink()
    con = sqlite3.connect(DB)
    con.executescript("""
    CREATE TABLE emails(id INTEGER PRIMARY KEY, message_id TEXT, date TEXT, sender TEXT, recipients TEXT,
      cc TEXT, subject TEXT, body TEXT, folder TEXT, n_chars INTEGER, split TEXT);
    CREATE VIRTUAL TABLE emails_fts USING fts5(subject, body, content='emails', content_rowid='id');
    """)
    con.executemany("INSERT INTO emails(message_id,date,sender,recipients,cc,subject,body,folder,n_chars,split) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [(r["message_id"], r["date"], r["sender"], r["recipients"], r["cc"], r["subject"], r["body"], r["folder"],
          len(r["body"]), "heldout" if k in held else "dev") for k, r in enumerate(picked)])
    con.execute("INSERT INTO emails_fts(rowid,subject,body) SELECT id,subject,body FROM emails")
    con.commit()
    print("emails:", con.execute("select count(*) from emails").fetchone()[0],
          "fts:", con.execute("select count(*) from emails_fts").fetchone()[0],
          "by split:", con.execute("select split,count(*) from emails group by split").fetchall())
    con.execute("VACUUM"); con.close()
    if not a.keep_raw:
        shutil.rmtree(RAW, ignore_errors=True); print("deleted raw shard")


if __name__ == "__main__":
    main()
