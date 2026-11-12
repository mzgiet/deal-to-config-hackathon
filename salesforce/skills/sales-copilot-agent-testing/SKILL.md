---
name: sales-copilot-agent-testing
description: "Prepares, runs and reviews test cases for the Sales Copilot Agentforce agent (Slack, sf agent preview), and prepares or rehearses the live demo run. It starts from what the org holds now (catalog, customers, open quotes, recent builds), so tests do not repeat earlier ones, do not collide with names reserved for the demo, and come with expected figures worked out from the live catalog. TRIGGER when: the user wants test cases, a test plan, prompts or a regression run for the Agentforce agent; asks what to test next; wants to check the agent after a change to Sales_Copilot.agent or the SalesCopilotAgent* actions; prepares, rehearses or resets the demo of the agent. DO NOT TRIGGER when: testing the Node Slack bot in src/ (use the npm/Slack flow), building or quoting for real through Cursor (sales-copilot-build, sales-copilot-sell), or editing the configurator UI."
metadata:
  version: "0.1"
  domains: ["Salesforce", "Agentforce", "Revenue Cloud", "Sales Copilot PoC"]
---

# Sales Copilot agent: test cases and demo run

The agent is described in `docs/agentforce.md`. It has two roles (sales rep and product manager), five actions over the
Apex services, and it writes real records when the user approves a build or a quote. A good test therefore depends
on what the org holds right now:

- A product that already exists turns a "build" test into a catalog-check test.
- A customer with many draft quotes makes the agent warn about duplicates.
- A name used once is no longer "new".

So every round starts with a snapshot.

Org: **`syn-scratch` only.** Run commands from `salesforce/`. Never point any command at another org.

## Workflow

```
- [ ] 1. Snapshot the org
- [ ] 2. Choose names: test names fresh, demo names untouched
- [ ] 3. Write the test cases, with expected figures from the catalog
- [ ] 4. Run them (Slack or preview) and check the traces
- [ ] 5. Report, and list what the round left in the org
```

### 1. Snapshot

```bash
skills/sales-copilot-agent-testing/scripts/org-snapshot.sh
```

It reads, and changes nothing:

- the active catalog (name, audience, type, which channel built it);
- the customers;
- how many quotes each customer has;
- the latest builds;
- the active agent version.

For a customer's full context (services, contract end dates), call the endpoint the agent uses:
`sf api request rest 'services/apexrest/salescopilot/customer?name=<name>' -o syn-scratch`. For catalog prices and
tiers: `.../salescopilot/catalog?audience=Business`.

### 2. Names: fresh for tests, reserved for the demo

**Reserved for the live demo.** Never build, quote or check these in a test. The demo needs them in exactly
this state:

| Reserved | Required state |
|---|---|
| Customer **Baltic Freight** | No quotes |
| Product **Fleet Tracking licence** | Not in the catalog |
| Product **Cloud Backup** | In the catalog, $8/month, 10% off from 50 users |

Before a demo, check these states with the snapshot. If one no longer holds, propose a fix and do not apply it
yourself:

- **Baltic Freight has quotes:** delete them, which needs the user's explicit approval because it deletes
  records, or choose another fresh demo customer.
- **Fleet Tracking licence exists:** pick another product name for the demo, and update this table and
  `salesforce/demo/agentforce-demo.md`.
- **Baltic Freight is missing:** run `sf apex run -f scripts/apex/salescopilot-seed-demo-customer.apex -o syn-scratch`.
  It is idempotent and only adds fictional data.

**Test names:**

- **A new product** gets a name that is not in the snapshot and is not reserved, with a short unique suffix,
  for example "Asset Library licence T1112".
- **Customers:** use Acme Logistics, Nowak Design or Anna Testowa. They already have test quotes, so expect the
  duplicate warning there.
- **A test that needs "no earlier quotes":** do not use Baltic Freight. Say the test needs a fresh customer and
  ask before seeding one.
- **Scenarios that must find an existing product:** use one that is in the snapshot, such as Team Chat licence,
  Video Conferencing licence or Cloud Backup.

### 3. Test cases

One block per case. The figures come from the catalog in the snapshot, never from memory.

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
- **Manual discount:** applied after the tier. It needs approval only if the manual discount alone is above
  `maxDiscountWithoutApprovalPct` (10%). The tier never counts.
- **Savings on the page:** list total − net total, per month, and ×12 per year.
- **Bundles:** required components plus chosen optional ones; a bundle cannot carry a discount.

Coverage to keep in every regression round:

- **Quote without approval:** a tier reached, or a discount of 10% or less.
- **Discount above the limit:** the quote is Needs Review, and the page shows "Awaiting manager approval".
- **Catalog check:** exists, similar (for example "Backup w chmurze"), and new.
- **Build:** a new product with tiers, and a bundle that reuses a catalog product.
- **Not sellable:** a product the catalog does not have. The agent hands it to the product manager, the product
  is built, and after about a minute it is quoted.
- **Vague request:** at most 3 questions, and no invented price or audience.
- **Rejected rule:** a bundle discount is refused with a reason.
- **Links:** the customer page and configurator links open the right page (`/apex/SalesCopilotPage?id=...`).

### 4. Run and check

- **Slack:** the real channel. Use a DM to Sales Copilot, and a **new conversation per case**, because an old
  thread keeps the agent version it started on. Ask the user to paste the replies and screenshots of the pages.
- **Preview,** for running cases yourself. It uses the same compiler and real actions, so it **writes** when a
  prompt approves a build or a quote:

  ```bash
  skills/sales-copilot-agent-testing/scripts/converse.sh "prompt 1" "prompt 2" ...
  python3 skills/sales-copilot-agent-testing/scripts/trace-summary.py     # newest session
  ```

  Preview redacts every link (`URL_Redacted`), so check links in Slack or in the trace, not in the preview text.

What the trace summary tells you:

| You see | Meaning |
|---|---|
| `ACTION <name> -> <status>` | Which actions ran, with what input, and the endpoint status (`found`, `new`, `exists`, `similar`, `created`, `failed`) |
| `NOTICE Untrusted URLs Blocked` | A link domain is not trusted (see "Links in replies" in docs/agentforce.md) |
| `<<URL_n>>` note | Normal: the Trust Layer masks URLs for the model and restores them in the reply |
| `ERROR … LLM_GATEKEEPER … rate limit` | The per-minute LLM quota. Wait a minute. Opus models always hit it (limit 0 in this org) |

To check a page, open the link from the reply. The configurator shows what Revenue Cloud stored. The quote's
`grandTotal` must equal the approved proposal.

### 5. Report

Report in the user's language, and keep it short:

- a per-case result (pass, fail, and why), with a trace line or a figure as evidence;
- defects in the agent's instructions, with a proposed change to `Sales_Copilot.agent`, and in the actions;
- **what the round left in the org:** quotes and products by name. Offer cleanup but do not run it. For
  products, `scripts/apex/salescopilot-reset-request.apex` takes a requestId, and it deletes records.

## Demo mode

When the user prepares or rehearses the demo, follow `salesforce/demo/agentforce-demo.md`.

1. Run the snapshot and confirm the three reserved states above.
2. **Rehearse without writing:** run the demo prompts in preview **up to the approval question**, and stop
   before "Yes, create the quote" and "Build it". Compare the replies and figures with the script.
3. A full rehearsal with writes uses up the reserved names. If the user wants one, do it with a copy (another
   fresh customer and product name), never with the reserved ones.
4. Leave at least 10 minutes between the last rehearsal and the demo, because of the per-minute LLM quota.

After a change to the agent, publish and **activate the new version explicitly** (`sf agent activate --version <n>`).
If Slack then says "You don't have permission to message this app", deactivate and activate the agent again.
