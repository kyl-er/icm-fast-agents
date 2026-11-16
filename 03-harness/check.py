#!/usr/bin/env python3
"""check.py: grade a finished run for harnesses that are not Python (the rig binary pipes its row here).
stdin: {"task","model","answer","tokens_in","tokens_out", ...row fields}   stdout: the row with "success" and "cost_usd" added.
  --record   also append the row to 07-bench/results.jsonl"""
import json, sys
import common as C
row = json.load(sys.stdin)
answer = row.pop('answer', '')
row['success'] = False if row.get('error') else C.check(C.tasks().get(row.get('task')), answer)
row['cost_usd'] = round(C.registry.cost(row.get('model'), row.get('tokens_in', 0), row.get('tokens_out', 0)), 6)
if '--record' in sys.argv:
    C.record(row)
print(json.dumps(row))
