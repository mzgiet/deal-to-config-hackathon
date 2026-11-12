#!/bin/zsh
# Talk to the local Sales_Copilot authoring bundle with live actions; prints each turn.
# Usage (from salesforce/): skills/sales-copilot-agent-testing/scripts/converse.sh "utterance 1" "utterance 2" ...
# ORG=<alias> to override syn-scratch. Live actions WRITE when a turn approves a build or a quote.
ORG=${ORG:-syn-scratch}
SID=$(sf agent preview start -o "$ORG" --authoring-bundle Sales_Copilot --use-live-actions --json 2>/dev/null \
  | tr -d '\000-\037' | python3 -c "import json,sys;print(json.load(sys.stdin)['result']['sessionId'])") || exit 1
for u in "$@"; do
  echo ">>> YOU: $u"
  sf agent preview send -o "$ORG" --authoring-bundle Sales_Copilot --session-id "$SID" -u "$u" --json 2>/dev/null | python3 -c "
import json,sys
d=json.loads(sys.stdin.read(), strict=False)
for m in d.get('result',{}).get('messages',[]): print('<<< AGENT ['+m.get('type','')+']', m.get('code',''), '\n'+(m.get('message') or ''))
if 'result' not in d: print(d)"
done
sf agent preview end -o "$ORG" --authoring-bundle Sales_Copilot --session-id "$SID" >/dev/null 2>&1
echo "trace: .sfdx/agents/Sales_Copilot/sessions/$SID/traces/"
