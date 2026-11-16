#!/usr/bin/env python3
"""show.py ID [ID ...]: print emails exactly as the pipelines see them (headers + first 2,500 characters of the body).
Used by whoever writes the gold labels, so the labeller and the models read the same text."""
import pathlib, sqlite3, sys
con = sqlite3.connect(pathlib.Path(__file__).resolve().parent.parent / 'data/emails.sqlite')
con.row_factory = sqlite3.Row
for i in sys.argv[1:]:
    r = con.execute('SELECT * FROM emails WHERE id=?', (int(i),)).fetchone()
    print(f"===== EMAIL {r['id']} =====\nFrom: {r['sender']}\nTo: {(r['recipients'] or '')[:300]}\nCc: {(r['cc'] or '')[:200]}\nDate: {r['date']}\nSubject: {r['subject']}\n\n{(r['body'] or '')[:2500]}\n")
