#!/usr/bin/env python3
"""Summarise a preview session: actions called (inputs/outputs), blocked URLs, masked tokens, model errors.
Usage (from salesforce/): python3 skills/sales-copilot-agent-testing/scripts/trace-summary.py [session-dir]
Without an argument, the newest session of Sales_Copilot is used."""
import glob, json, os, re, sys
root = '.sfdx/agents/Sales_Copilot/sessions'
d = sys.argv[1] if len(sys.argv) > 1 else max(glob.glob(root + '/*/'), key=os.path.getmtime)
for path in sorted(glob.glob(os.path.join(d, 'traces', '*.json')), key=os.path.getmtime):
    raw = open(path).read()
    data = json.loads(raw)
    def walk(o):
        if isinstance(o, dict):
            t = o.get('type')
            if t == 'UserInputStep':
                print('\nYOU:', o.get('message'))
            elif t == 'FunctionStep':
                f = o['function']
                print('  ACTION', f['name'], '->', str(f.get('output', {}).get('status')), '|', json.dumps(f.get('input'))[:160])
            elif t == 'PlatformNotificationStep':
                print('  NOTICE', o.get('header'), '|', (o.get('body') or '')[:200])
            elif t and 'execution-error' in str(t):
                print('  ERROR', (o.get('detail') or '')[:220])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(data)
    if '<<URL_' in raw:
        print('  note: the Trust Layer masked URLs as <<URL_n>> tokens for the model')
