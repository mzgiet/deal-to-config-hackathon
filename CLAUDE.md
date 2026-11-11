# Sales Copilot — Slack orchestrator

Hackathon 2026 submission, team **Multi-Framework Builders** (Synechron / Cloobees).

## How to treat this file

This is a snapshot of decisions made so far, **not a rulebook**. Every decision
below has a reason attached; if the reason no longer holds, or there is a better
option, say so and propose the change. Disagreeing with this file is expected and
welcome. Update the file when a decision changes.

Only one thing is genuinely fixed: the house rules at the bottom.

## Demo date

The live demo is on Thursday 12 November. That is a date, **not a constraint on
scope**: implementation is fast, so do not cut features, push ideas to "next steps",
or argue for the smaller option because time is short. Choose the option that makes
the better product and demo. The one thing to protect is that the core demo path
(below) keeps working while things change.

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

Constraints from Dawid's validation (`SalesCopilotRequestWrapper.validate()`): USD
only (single-currency org), bundles carry no discount (`tiers: []`), tiers need whole
`from` >= 1 and `discountPct` in (0, 100]. `normalizeAnalysis()` in `src/contract.js`
enforces these before the card is rendered, so the card shows what will be built. See
`salesforce/README.md` "Known limitations".

He returns:

```json
{ "requestId": "req_001", "status": "created", "artifactUrl": "https://..." }
```

That is v1. The orchestrator now sends v2, all of it already accepted by the
Salesforce side: `sellingModel`, `pricing.appliesTo`, `bundle` (components,
`optional`, catalog products reused by `productId`), `source.channel: "slack"`, and
`presentation` (the customer page: headline, customer, ordered blocks;
`src/presentation.js` enforces the Apex rules). `/quote` uses `GET customer`,
`GET catalog` and `POST quote` (`{ account, lines, presentation }`); the endpoint
reference is `salesforce/README.md`.

## Repo state

```
src/
  index.js            start-up: env check, Bolt app (Socket Mode)
  config.js           all env vars
  llm.js              the ONLY place that calls Claude: API if ANTHROPIC_API_KEY,
                      otherwise headless `claude -p` (CLAUDE_BIN)
  extraction.js       /configure: skill + catalog + schema -> analysis (+ questions)
  contract.js         ANALYSIS_SCHEMA, normalizeAnalysis(), toContract() (v2)
  quote.js            /quote: customer + catalog -> lines, page, not-in-catalog hand-off
  pricing.js          quote preview (tiers, discount, totals, approval); pure
  presentation.js     the customer page: schema part + Apex rules; shared
  prompt-utils.js     skill loading, catalog as prompt text
  salesforce.js       ALL Salesforce calls; salesforce-stub.js when SF_* is not set
  store.js            in-memory sessions (kind 'build' | 'quote')
  slack/
    configure.js      /configure -> intake modal -> progress -> questions -> offer card
    quote.js          /quote -> customer picker (external select) -> questions -> quote card
    card-actions.js   Build it, Create quote, hand-off, Quote it, the "…" menu (Discard)
    adjust.js         Adjust (both cards) -> modal -> Claude revises -> card updated in place
    modal-utils.js    progress steps, safe views.update, posting cards
    views.js          modal views
    card.js           the offer card;  quote-card.js  the quote card
    format.js         Block Kit + money helpers; no emoji in card content
    examples.js       example requests behind the modals' chips (fictional)
skills/
  sales-request-extraction.md   /configure prompt; same file goes to Context Builder
  sales-quote-extraction.md     /quote prompt
docs/
  slack-setup.md                 create the Slack app and run locally
  salesforce-integration.md      endpoint, contract v1/v2, auth, curl test
  revenue-cloud-mapping.md       which Revenue Cloud records a request needs
manifest.yaml         Slack app manifest
_internal/            git-ignored team notes (history, handover, plan)
```

Two flows, two roles:

- `/quote` (sales rep): modal with a customer picker that searches Salesforce and
  the request → `GET customer` + `GET catalog` → Claude proposes lines from the
  catalog and composes the customer page → quote card (priced lines, approval flag,
  customer context) → **Create quote** → `POST quote` → customer page + quote link
  in the thread. Anything the catalog lacks → **Send to product manager** →
  `/configure` pre-filled.
- `/configure` (product manager): modal → Claude extracts (with the catalog, so a
  package can reuse products) and may ask up to 3 questions → offer card →
  **Build it** → `POST build` → pricing refresh → configurator link and **Quote it
  for <customer>** (hand-off) or **Quote it for a customer**.
- **Adjust** works on both cards; Discard sits in the "…" menu.

This mirrors the Salesforce side's demo scenarios (`salesforce/demo/`), which the
Cursor channel runs through the skills in `salesforce/skills/`.

A third channel, being built alongside the bot (not replacing it yet): an
Agentforce Employee Agent (`salesforce/.../aiAuthoringBundles/Sales_Copilot/`, Claude
Sonnet 4.5 via `model_config`) whose actions (`SalesCopilotAgent*.cls`) wrap the same
Apex services, talked to in Slack in plain words. If it proves intuitive enough it
may replace the bot. See `docs/agentforce.md`.

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

Then type `/quote` or `/configure` in a channel the bot is in. After a manifest
change (e.g. a new command), update the app from `manifest.yaml` and reinstall it.

The configurator (`salesforce/configurator/`) builds and deploys separately; see
`salesforce/README.md`:

```bash
cd salesforce/configurator
npm install --legacy-peer-deps      # plain install fails: the UI Bundle plugin wants React 19, the app uses 18
SF_ORG=<alias> npm run deploy       # SF_ORG optional; without it the CLI's default org is used
```

Restart `npm run dev` after editing `tailwind.config.js`, otherwise it serves stale styles.

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
