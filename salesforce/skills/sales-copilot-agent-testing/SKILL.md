---
name: sales-copilot-agent-testing
description: "Prepares, runs and reviews test cases for the Sales Copilot Agentforce agent (Slack, sf agent preview), and walks the presenter through preparing and rehearsing the live demo. It starts from what the org holds now (catalog, customers, open quotes, recent builds), so tests do not repeat earlier ones, keep the demo data for demo rehearsals (reset after each run), and come with expected figures worked out from the live catalog. TRIGGER when: the user wants to prepare for, rehearse, check or reset the demo of the Agentforce agent ('I want to prepare for the demo', 'check the demo data', 'run a rehearsal'); wants test cases, a test plan, prompts or a regression run for the agent; asks what to test next; changed Sales_Copilot.agent or the SalesCopilotAgent* actions and wants them checked; wants to change the demo customer, product or prompts. DO NOT TRIGGER when: testing the Node Slack bot in src/, building or quoting for real through Cursor (sales-copilot-build, sales-copilot-sell), or editing the configurator UI."
metadata:
  version: "0.3"
  domains: ["Salesforce", "Agentforce", "Revenue Cloud", "Sales Copilot PoC"]
---

# Sales Copilot agent: demo preparation and test runs

The agent is described in `docs/agentforce.md` and the live demo in `salesforce/demo/agentforce-demo.md`. It has two
roles (sales rep and product manager) and five actions over the Apex services. It **writes real records** when the
user approves a quote ("Yes, create the quote") or a build ("Build it"). So every session starts from what the org
holds now. The data reserved for the demo may be used for rehearsals of the demo itself, and only if it is reset
afterwards with `scripts/apex/salescopilot-reset-demo.apex`.

Run commands from `salesforce/`. Talk to the user in their language. Everything written to the repository stays
in English.

## 0. Find the org (every session)

The demo org is the scratch org at `https://power-power-8138-dev-ed.scratch.my.salesforce.com` (instance
USA1154S, set up on 12 November). Different people have different CLI aliases for it.

The first PoC org, `https://flow-dream-5125-dev-ed.scratch.my.salesforce.com`, is retired for the demo. Its
Agentforce-in-Slack connection stopped answering after Salesforce rolled its instance back (incident 20004592).
Do not use it for demo work.

1. Run `sf org list --json`, find the entry whose `instanceUrl` is that org, and use its alias as `<org>` from here
   on.
2. If none matches, ask the user to log in with `sf org login web -r https://power-power-8138-dev-ed.scratch.my.salesforce.com -a <alias>`.
3. Never run a command against any other org.

`converse.sh` takes the alias through `ORG=<org>`, and `org-snapshot.sh` takes it as its argument. Agent preview
compiles the local `aiAuthoringBundles/Sales_Copilot`, so it needs the `agentforce-agent` branch (or `main` after
the merge) checked out and in sync with the active agent.

## Guided session: "I want to prepare for the demo"

Lead the user through these steps. After each one, say what you found and what comes next.

**Step 1. The demo data is in place.** Read the "Demo data" table in `salesforce/demo/agentforce-demo.md`, then run
`skills/sales-copilot-agent-testing/scripts/org-snapshot.sh <org>` and check every "Required state":

- the customer exists and has no quotes;
- the catalog product is present, with the listed price and tier;
- the new product is absent.

Report each check as OK or not. If one fails, propose a fix and wait for a yes before doing anything:

- **The customer is missing:** run `sf apex run -f scripts/apex/salescopilot-seed-demo-customer.apex -o <org>`.
  It is idempotent and adds fictional data only.
- **The customer has quotes, or the new product exists:** the demo data was used, probably by a rehearsal. Offer
  the reset and run it after a yes, because it deletes records:
  `sf apex run -f scripts/apex/salescopilot-reset-demo.apex -o <org>`. It deletes the customer's quotes and
  opportunities and the demo product's build, then refreshes pricing. Run the snapshot again to confirm.

**Step 2. The agent is current.** In the snapshot, compare the active `BotVersion` with what the local bundle
publishes. If `Sales_Copilot.agent` changed and was not published, offer to run validate, publish and activate the
new version (see "Change the agent").

**Step 3. Dry rehearsal (optional, writes nothing).** Run the demo prompts in preview up to the approval
questions, to check the figures and wording before touching Slack:

```bash
ORG=<org> skills/sales-copilot-agent-testing/scripts/converse.sh "<part 1, prompt 1>" "<part 1, prompt 2>"
python3 skills/sales-copilot-agent-testing/scripts/trace-summary.py
```

Compare every figure and every action with the run sheet: the actions called, the prices, the approval decision
and the page sections. Point out each difference and propose a fix (the agent's instructions, the prompt, or the
figures in the sheet).

**Step 4. Full rehearsal in Slack, then reset.** This is the real practice run: the exact prompts, on the reserved
data, with "Yes, create the quote" and "Build it".

1. Use a new DM conversation with Sales Copilot.
2. Ask the user to paste the replies and screenshots of both pages, and check them against the run sheet.
3. Then reset with `scripts/apex/salescopilot-reset-demo.apex`, after a yes, and confirm with the snapshot.

The same full run also works in preview: put all seven prompts in one `converse.sh` call. Rehearse as often as
needed, but **always reset** after each run, and finish at least 10 minutes before the demo.

**Step 5. Hand over the checklist.** Walk through "Before going on stage" in the run sheet, including the
**10-minute** gap after the last rehearsal (the per-minute LLM quota) and a new DM conversation.

## Regular test rounds

```
- [ ] 1. Snapshot the org
- [ ] 2. Choose names: test names fresh, demo names untouched
- [ ] 3. Write the test cases, with expected figures from the catalog
- [ ] 4. Run them (Slack or preview) and read the traces
- [ ] 5. Report, and list what the round left in the org
```

### 1. Snapshot

`skills/sales-copilot-agent-testing/scripts/org-snapshot.sh <org>` is read-only. It shows the catalog, the
customers, the quotes per customer, the latest builds and the active agent version.

For details, call the endpoints the agent uses:

- `sf api request rest 'services/apexrest/salescopilot/customer?name=<name>' -o <org>`: services and contract end
  dates;
- `.../salescopilot/catalog?audience=Business`: prices and tiers.

### 2. Names

- **Reserved:** everything in the "Demo data" table of `salesforce/demo/agentforce-demo.md`. Use these only in a
  rehearsal of the demo, and reset afterwards. Never use them in other tests.
- **A new product in a test:** a name that is not in the snapshot, plus a short unique suffix, for example "Asset
  Library licence T1112".
- **Customers in tests:** Acme Logistics, Nowak Design or Anna Testowa. They already have test quotes, so expect
  the duplicate warning there.
- **A test that needs "no earlier quotes":** needs a fresh customer. Ask before seeding one.
- **A test that needs an existing product:** take one from the snapshot (Team Chat licence, Video Conferencing
  licence, …).

### 3. Test cases

One block per case. Figures come from the catalog in the snapshot, never from memory.

```markdown
#### T<n>: <what it proves>
- Role: sales rep | product manager | both. Writes: none | quote | product
- Preconditions (from the snapshot): ...
- Prompts (a new conversation): 1. "..." 2. "..." 3. "..."
- Expected: actions in order (find_customer, get_catalog, ...), figures, the approval decision, page sections
- Fails if: ...
```

Pricing rules, as the Apex services and Revenue Cloud apply them:

- **Volume tier:** reached by the quantity *on the line*; the reached rate applies to every unit. Existing assets
  do not count.
- **Manual discount:** applied after the tier. It needs approval only when the manual discount alone is above
  `maxDiscountWithoutApprovalPct` (10%). The tier never counts.
- **Savings on the page:** list total − net total, per month, and ×12 per year.
- **Bundles:** required components plus chosen optional ones. A bundle cannot carry a discount.

Coverage to keep in every regression round:

- **Quote without approval:** a tier reached, or a discount of 10% or less.
- **Discount above the limit:** the quote is Needs Review, and the page shows "Awaiting manager approval".
- **Catalog check:** exists (Team Chat licence), similar ("Backup Plus" against Cloud Backup), and new.
- **Build:** a new product with tiers, and a bundle that reuses a catalog product.
- **Not sellable:** the agent hands the product to the product manager, it is built, and after about a minute it
  is quoted.
- **Vague request:** at most 3 questions, and no invented price or audience.
- **Rejected rule:** a bundle discount is refused with a reason.
- **Links:** the customer page and configurator links (`/apex/SalesCopilotPage?id=...`) open the right page.

### 4. Run and read the traces

- **Slack:** the real channel. Use a DM to Sales Copilot, and a **new conversation per case**, because an old
  thread keeps the agent version it started on.
- **Preview:** `ORG=<org> skills/sales-copilot-agent-testing/scripts/converse.sh "prompt 1" "prompt 2" ...`, then
  `python3 skills/sales-copilot-agent-testing/scripts/trace-summary.py`. It uses real actions, so it **writes**
  when a prompt approves something. Preview redacts every link (`URL_Redacted`), so check links in Slack or in
  the trace.

| Trace summary line | Meaning |
|---|---|
| `ACTION <name> -> <status>` | Which actions ran, with what input, and the endpoint status (`found`, `new`, `exists`, `similar`, `created`, `failed`) |
| `NOTICE Untrusted URLs Blocked` | A link domain is not trusted (see "Links in replies" in docs/agentforce.md) |
| `<<URL_n>>` note | Normal: the Trust Layer masks URLs for the model and restores them in the reply |
| `ERROR … LLM_GATEKEEPER … rate limit` | The per-minute LLM quota. Wait a minute. Opus models always hit it (limit 0 in this org) |

The quote's `grandTotal` must equal the approved proposal. Open the page links to check the composed page.

### 5. Report

Report in the user's language:

- a per-case result (pass, fail, and why), with a trace line or a figure as evidence;
- defects, with a proposed change to `Sales_Copilot.agent` or to an action;
- **what the round left in the org:** quotes and products by name. Offer cleanup but do not run it.
  `scripts/apex/salescopilot-reset-request.apex` takes a requestId and deletes records.

## Change the demo

- **Another customer:** change the values at the top of `scripts/apex/salescopilot-seed-demo-customer.apex` and
  `scripts/apex/salescopilot-reset-demo.apex`, run the seed, and update the "Demo data" table.
- **Another product, or other prices:**
  1. Check the name is new: `check_offer` in preview, or the snapshot. Put the name in the reset script too.
  2. Update the table and the prompts.
  3. Recompute the figures with the pricing rules above, and confirm them in a dry rehearsal.
- **Other prompts or wording:** edit the run sheet, then dry-rehearse it (Step 3).

## Change the agent

1. Edit `salesforce/force-app/main/default/aiAuthoringBundles/Sales_Copilot/Sales_Copilot.agent`.
2. Check it in preview first, because preview runs the local file.
3. Validate, publish and activate:

   ```bash
   sf agent validate authoring-bundle -o <org> --api-name Sales_Copilot
   sf agent publish authoring-bundle -o <org> --api-name Sales_Copilot
   sf agent activate -o <org> --api-name Sales_Copilot --version <the new version number>
   ```

   Activate with `--version`, because without it the old version can stay active.
4. Delete the generated `bots/` and `genAiPlannerBundles/` folders. They are git-ignored.
5. If Slack then says "You don't have permission to message this app", deactivate and activate the agent again.
   Start new Slack conversations after any change.
