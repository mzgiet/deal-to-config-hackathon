# Sales Copilot — Slack orchestrator

Hackathon 2026 submission, team **Multi-Framework Builders** (Synechron / Cloobees).

## How to treat this file

This is a snapshot of decisions made so far, **not a rulebook**. Every decision
below has a reason attached; if the reason no longer holds, or there is a better
option, say so and propose the change. Disagreeing with this file is expected and
welcome. Update the file when a decision changes.

Only two things are genuinely fixed: the deadline and the house rules at the bottom.

## Deadline

**Live demo: Thursday 12 November.** When choosing between options, prefer the one
that demos cleanly by then. A smaller thing that works beats a bigger thing that
half-works — but "smaller" is a judgement call, not a ban on improvements.

## What the product is

A sales rep finishes a client call and needs to show something concrete before the
deal cools. Instead of raising a dev ticket and waiting a week, they describe what
the client asked for — in plain English, in Slack — and get back a working Revenue
Cloud product and price configuration they can show the client the same day.

Slack is the rep's surface. Everything else happens behind it.

## Ownership

- **Michał** owns this repo: the Slack orchestrator — receiving the request,
  calling Claude to extract a structured contract, rendering the Block Kit card,
  handing the contract over and posting back the result.
- **Dawid** owns turning the contract into Salesforce records (products, price
  books, pricing) and the configurator UI.

This is a division of work, not a wall. Proposing changes on Dawid's side, or to the
handover between us, is fine — just flag that it needs his agreement before it
lands, since he is building in parallel.

## The contract with Dawid's side (current version)

Agreed so both sides can stub each other and work in parallel. Changes are allowed
when they make the end result better — they just need to be agreed with Dawid,
so call them out explicitly.

Orchestrator sends:

```json
{
  "requestId": "req_001",
  "rawRequest": "client wants Product A and B bundled, 10% off above 500 units, B2B",
  "extracted": {
    "products": [{ "name": "Product A", "basePrice": 10, "currency": "USD" }],
    "pricing": { "type": "volume-tier", "tiers": [{ "from": 500, "discountPct": 10 }] },
    "availability": "B2B"
  },
  "summary": "Bundle of Product A and B with a 10% volume discount above 500 units",
  "assumptions": ["currency assumed USD"],
  "target": "revenue-cloud"
}
```

He returns:

```json
{ "requestId": "req_001", "status": "created", "artifactUrl": "https://..." }
```

## Repo state

```
src/
  index.js            start-up: env check, Bolt app (Socket Mode)
  config.js           all env vars
  llm.js              the ONLY place that calls Claude: API if ANTHROPIC_API_KEY,
                      otherwise headless `claude -p` (CLAUDE_BIN)
  extraction.js       skill + schema -> analysis (contract fields + questions)
  contract.js         ANALYSIS_SCHEMA and toContract() for Dawid's side
  store.js            in-memory sessions
  builder.js          Salesforce Apex REST if SF_* set, otherwise stub
  slack/
    configure.js      /configure -> intake modal -> progress -> questions -> card
    card-actions.js   Build it / Discard / Open configurator
    adjust.js         Adjust button -> modal -> Claude revises -> card updated in place
    modal-utils.js    progress steps + safe views.update shared by configure and adjust
    views.js          modal views
    card.js           the channel card, rendered from session status
    examples.js       example requests behind the modal's chips (fictional)
skills/
  sales-request-extraction.md   the extraction prompt; same file goes to Context Builder
docs/
  slack-setup.md                 create the Slack app and run locally
  salesforce-integration.md      endpoint, contract v1/v2, auth, curl test
  revenue-cloud-mapping.md       which Revenue Cloud records a request needs
manifest.yaml         Slack app manifest
_internal/            git-ignored team notes (history, handover, plan)
```

The flow: `/configure` opens a modal → rep describes the request (example chips,
optional who-buys/currency) → Claude extracts and may ask up to 3 questions in a
second modal, pre-filled with its best guess → final pass → card in the channel
→ optional **Adjust** (rep describes a change in plain words, the card is revised in
place, as often as needed) → **Build it** → `buildConfiguration()` → link in the thread.

## Running it

`.env` (never committed):

```
SLACK_BOT_TOKEN=xoxb-...   # Install App → Bot User OAuth Token
SLACK_APP_TOKEN=xapp-...   # Basic Information → App-Level Tokens (connections:write)
CLAUDE_BIN=/path/to/claude # only if `claude` is not on PATH
# ANTHROPIC_API_KEY=sk-ant-...   # set it and llm.js switches to the API
# SF_DOMAIN / SF_CLIENT_ID / SF_CLIENT_SECRET  # set them and builder.js calls Salesforce
```

```bash
npm install
npm start
```

Then type `/configure` in a channel the bot is in.

## Current technical choices and why

These are defaults with reasons, not prohibitions.

- **Socket Mode, not HTTP.** No public URL, no ngrok, no deploy — fewer things to
  break in a live demo.
- **Personal free Slack workspace.** Installing a custom app into Synechron's
  corporate Slack needs admin approval that may not arrive in time. If an already
  approved app or a faster route exists, it is worth considering.
- **State is an in-memory `Map`.** Enough for a demo; revisit only if something
  actually needs persistence.

## Hard technical fact

**Slack's 3-second rule.** Every command and action must `ack()` immediately. The
Claude call takes longer than 3 seconds, so slow work happens after the ack, with
results posted via `respond()` or `chat.postMessage`. Breaking this shows a timeout
error in the demo.

## The demo path

Five minutes total: one minute on the business problem, one on the flow, three on
live demo. The core path that must work on screen:

1. Rep types `/configure ...` in a channel
2. Bot acknowledges, then posts the card: products, pricing tiers, availability,
   anything it had to assume
3. Rep clicks **Build it**
4. Bot replies in thread with a link to the configurator

Prioritise this path. Extras are fine if they make the demo or the submission
stronger and do not put this path at risk.

## House rules (fixed)

No client data, ever — sample or anonymised only, sandbox orgs only. This is a
hard hackathon rule, not a preference.
