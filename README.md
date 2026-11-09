# Sales Copilot

**From a client call to a working Revenue Cloud configuration the same day,
without waiting for a developer.**

Hackathon 2026 · team **Multi-Framework Builders**

## The problem

A sales rep finishes a client call. The client wants something specific: a
product at a certain price, a discount above a certain volume, two products
sold together. To show them something concrete, the rep raises a ticket and
waits for a developer to configure it in Salesforce. That takes days, and in
the meantime the deal cools.

## What Sales Copilot does

The rep describes the request in plain English, in Slack. Claude turns it into
a structured product and pricing specification, asks about anything important
that is missing, and shows the result as a card. One click builds it as real
records in a Salesforce Revenue Cloud sandbox and posts a link to a
configurator the rep can show the client.

```
 Slack (rep)              Orchestrator (this repo, Node)           Salesforce sandbox
 ───────────              ──────────────────────────────           ──────────────────
 /configure ────────────► Claude: plain English → structured spec
 answers ≤3 questions ◄─► Claude: final pass
 card in channel ◄─────── products, discount tiers, who buys,
                          assumptions made
 [Adjust] ──────────────► Claude revises the card in place
 [Build it] ────────────► POST contract (OAuth client credentials) ──► Apex REST endpoint
                                                                       creates Product2,
                                                                       PricebookEntry, tiers,
                                                                       bundle
 link in thread ◄──────── { requestId, status, artifactUrl } ◄──────
 click ───────────────────────────────────────────────────────────► configurator (React)
```

**AI is used only where language is involved.** Claude interprets the rep's
words. Building the Salesforce records is a deterministic field mapping, with
no model in the loop, so the same specification always produces the same
configuration.

## The flow, step by step

1. The rep types `/configure` in a channel. A modal opens with example chips
   and optional fields for who buys and currency.
2. Claude extracts products, prices, discount tiers and availability. If
   something important is missing, it asks **up to three questions**, each
   pre-filled with its best guess.
3. A card is posted in the channel showing what will be built and **every
   assumption Claude made**, so nothing is hidden from the rep.
4. **Adjust** (optional): the rep describes a change in plain words, such as
   "make it 15% above 1000". The card is revised in place, as often as needed.
5. **Build it**: the specification is sent to Salesforce, and a link to the
   configurator appears in the thread.

## Repository layout

```
src/
  index.js            start-up: env check, Slack Bolt app (Socket Mode)
  config.js           all environment variables
  llm.js              the only place that calls Claude: Anthropic API if
                      ANTHROPIC_API_KEY is set, otherwise headless Claude Code
  extraction.js       skill + JSON schema -> analysis (spec + questions)
  contract.js         analysis schema and the contract sent to Salesforce
  store.js            in-memory sessions
  builder.js          Salesforce Apex REST call, or a stub when SF_* is not set
  slack/
    configure.js      /configure -> intake modal -> questions -> card
    adjust.js         Adjust -> modal -> Claude revises -> card updated
    card-actions.js   Build it / Discard / Open configurator
    card.js           the channel card (Block Kit)
    views.js          modal views
    modal-utils.js    progress steps shared by configure and adjust
    examples.js       example requests behind the modal chips (fictional)
skills/
  sales-request-extraction.md   the extraction skill (also in Context Builder)
docs/
  slack-setup.md                 create the Slack app and run locally
  salesforce-integration.md      the endpoint, contract, auth and a curl test
  revenue-cloud-mapping.md       which Revenue Cloud records a request needs
  written-summary.md             hackathon written summary
  productionising-note.md        what it would take to make this real
manifest.yaml         Slack app manifest
```

## The reusable part: the extraction skill

[`skills/sales-request-extraction.md`](skills/sales-request-extraction.md) is
a self-contained Claude skill. It defines which fields to extract, which
sensible defaults to use, when to ask the rep instead of guessing, and the
rule that it never invents a product the rep did not mention. The same file is
published in our Context Builder project, so it can be reused outside Slack,
for example from a Teams bot or directly in Claude.

## The contract with Salesforce

The orchestrator sends:

```json
{
  "requestId": "req_mf3k_001",
  "rawRequest": "Cloud Analytics licence at $40 per user per month, 10% off above 100 users and 15% above 500. Business customers only.",
  "extracted": {
    "products": [{ "name": "Cloud Analytics licence", "basePrice": 40, "currency": "USD" }],
    "pricing": { "type": "volume-tier", "tiers": [{ "from": 100, "discountPct": 10 }, { "from": 500, "discountPct": 15 }] },
    "availability": "B2B"
  },
  "summary": "Cloud Analytics licence at $40 per user per month with 10% off from 100 users and 15% off from 500 users",
  "assumptions": ["Price is per user per month"],
  "target": "revenue-cloud"
}
```

Salesforce returns:

```json
{ "requestId": "req_mf3k_001", "status": "created", "artifactUrl": "https://..." }
```

Full field reference and record mapping:
[docs/salesforce-integration.md](docs/salesforce-integration.md).

## Running it

Requires Node ≥ 20.6 and a Slack workspace where you can install an app.
Step-by-step Slack setup: [docs/slack-setup.md](docs/slack-setup.md).

```bash
cp .env.example .env   # fill in the two Slack tokens
npm install
npm start
```

Then type `/configure` in a channel the bot is in.

| Variable | Required | Effect |
|---|---|---|
| `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | yes | connect to Slack over Socket Mode |
| `ANTHROPIC_API_KEY` | no | use the Anthropic API; without it, the local `claude` CLI is used |
| `CLAUDE_BIN`, `CLAUDE_MODEL` | no | path to the `claude` CLI, model override |
| `SF_DOMAIN`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET` | no | build in a real Salesforce org; without them, a stub returns a placeholder link |

With only the Slack tokens set, everything up to and including **Build it**
runs end to end against the stub.

## What a reviewer cannot re-run

- **Our Slack workspace** is a private demo workspace. You can create your own
  in about 15 minutes using [docs/slack-setup.md](docs/slack-setup.md).
- **The Salesforce sandbox** and its OAuth credentials are not shared. Without
  them the builder uses the stub. The record mapping is documented in
  [docs/revenue-cloud-mapping.md](docs/revenue-cloud-mapping.md).
- **The Salesforce side** (Apex endpoints, Revenue Cloud metadata and the
  configurator UI) is in [`salesforce/`](salesforce/README.md), with its
  deploy steps and one-off org setup.

## Design choices

- **Socket Mode, not HTTP.** No public URL and nothing to deploy, so there are
  fewer moving parts in a live demo.
- **Slack's 3-second rule.** Every command and button is acknowledged
  immediately, and Claude's work happens afterwards, with progress shown in
  the modal.
- **Structured output only.** Claude's answer is validated against a strict
  JSON schema ([src/contract.js](src/contract.js)), so the card and the
  contract never receive free text where a number is expected.
- **In-memory state.** Enough for a demo. Productionising notes cover what
  changes for real use.

## Data

Sample and fictional data only. Every example in this repo is invented, and
the configuration is built in a sandbox org. No client data is used anywhere.

## Team

| | Role |
|---|---|
| Michał Zgiet | Slack orchestrator, Claude integration, extraction skill |
| Dawid Rymarzak | Salesforce records, Apex endpoint, configurator UI |
| Demi Nicolaou | Business problem and positioning, skill review |
| Amit Dhakre | Testing, realistic sales-rep inputs for the extraction |

Built with Claude Code.
