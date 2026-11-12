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

## What Sales Copilot is: an Agentforce agent in Slack

The rep chats with **Sales Copilot**, a Salesforce-native Agentforce agent, in a Slack DM, in plain English.
Everything runs on Salesforce:

- **It quotes a customer.** It reads the customer and the catalog for their segment, then prices the lines with
  volume tiers and discounts. After an explicit yes it creates a Revenue Cloud quote. A discount above the rep's
  limit sends the quote for manager approval.
- **It builds what is missing.** When the catalog lacks a product, it hands the request to the product manager
  role. It checks the catalog for duplicates, then builds the product, the prices and the tiers in Revenue Cloud.
- **It composes a page for the customer** on the fly, in a Multi-Framework React app on Salesforce: savings, why
  it fits, the offer, the assumptions. The page is built from template blocks the agent picks for that deal.

```
Slack DM ─► Agentforce Employee Agent (Agent Script, Claude Sonnet 5.5 inside the Einstein Trust Layer)
         ─► invocable Apex actions ─► deterministic Apex services ─► Revenue Cloud
         ◄─ proposal, quote / product, link to the customer page (Multi-Framework app)
```

- **How it works and how to deploy it:** [docs/agentforce.md](docs/agentforce.md).
- **The live demo:** [salesforce/demo/agentforce-demo.md](salesforce/demo/agentforce-demo.md).
- **The agent itself:** `salesforce/force-app/main/default/aiAuthoringBundles/Sales_Copilot/`.

The same skills and Apex services also run behind two other channels, so the agent can sit wherever sales works:
the custom Slack bot described below, and Cursor or Claude Code (`salesforce/skills/`).

## Also built: the custom Slack bot (`/quote`, `/configure`)

Two roles, one Slack:

- **`/quote`, the sales rep.** "Acme wants 120 more Cloud Analytics licences,
  give them 5%." Sales Copilot reads the customer in Salesforce (segment,
  current services, contracts ending, open quotes) and the catalog for their
  segment, prices the lines with the volume tiers, flags a discount that needs
  a manager, and composes a proposal page for that customer. One click creates
  the Revenue Cloud quote.
- **`/configure`, the product manager.** When the customer wants something the
  catalog does not sell, the rep's card hands it over in one click. The product
  manager adds the price in plain words; Claude turns it into a product and
  pricing specification (reusing catalog products in a package), asks about
  anything important that is missing, and one click builds it as real records
  in a Salesforce Revenue Cloud sandbox. **Quote it for Acme** then closes the
  loop.

```
 Slack                    Orchestrator (this repo, Node)              Salesforce sandbox
 ─────                    ──────────────────────────────              ──────────────────
 /quote ────────────────► GET customer, GET catalog ◄───────────────► Apex REST
                          Claude: lines from the catalog, page
 quote card ◄──────────── priced lines, approval flag, customer page,
                          "not in the catalog" hand-off
 [Create quote] ────────► POST quote ───────────────────────────────► Revenue Cloud quote,
 links in thread ◄─────── quote + customer page ◄─────────────────── priced by the pricing procedure

 [Send to product manager] or /configure
                ────────► GET catalog; Claude: plain English → spec + page
 offer card ◄──────────── products, billing, tiers or package, who buys,
                          customer page outline, assumptions made
 [Adjust] ──────────────► Claude revises the card in place (both cards)
 [Build it] ────────────► POST build (OAuth client credentials) ────► products, prices, tiers, bundle;
                          refresh pricing                              configurator page
 [Quote it for Acme] ───► back to the quote flow, no modal
```

**AI is used only where language is involved.** Claude interprets the rep's
words. Building the Salesforce records is a deterministic field mapping, with
no model in the loop, so the same specification always produces the same
configuration.

## The flow, step by step

1. The rep types `/quote`. A modal opens: a customer picker that searches
   Salesforce as they type, the request, and example chips.
2. Claude proposes lines from the catalog only, and composes the customer page
   (headline, which blocks lead, why the offer fits this customer, from facts in
   the customer record). Lines are priced on the card: volume tier, extra
   discount, total per billing, and how far the next tier is.
3. A discount above the limit is flagged before anything is written: the quote
   will wait for a manager.
4. **Create quote** creates the quote in Revenue Cloud and posts the customer
   page and the quote link in the thread.
5. If the customer wants something the catalog does not sell, the card says so
   and **Send to product manager** opens `/configure` with a ready request.
6. `/configure`: Claude extracts products, prices, billing, discount tiers or a
   package, and availability; it asks **up to three questions**, each pre-filled
   with its best guess. The card shows what will be built and **every assumption
   Claude made**.
7. **Adjust** (both cards): describe a change in plain words, such as "make it
   15% above 1000". The card is revised in place, as often as needed.
8. **Build it** builds the offer, refreshes pricing, and posts the configurator
   link. **Quote it for Acme** prepares the quote for the customer who asked.

## Repository layout

```
src/
  index.js            start-up: env check, Slack Bolt app (Socket Mode)
  config.js           all environment variables
  llm.js              the only place that calls Claude: Anthropic API if
                      ANTHROPIC_API_KEY is set, otherwise headless Claude Code
  extraction.js       /configure: skill + catalog + JSON schema -> analysis
  contract.js         build analysis schema and the contract sent to Salesforce
  quote.js            /quote: customer + catalog -> lines, page, hand-off
  pricing.js          quote preview: tiers, discount, totals, approval
  presentation.js     the customer page (blocks, order, text), shared
  prompt-utils.js     skill loading, catalog as prompt text
  salesforce.js       every Salesforce call (build, catalog, customer, quote,
                      pricing refresh); salesforce-stub.js when SF_* is not set
  store.js            in-memory sessions
  slack/
    configure.js      /configure -> intake modal -> questions -> offer card
    quote.js          /quote -> customer picker -> questions -> quote card
    adjust.js         Adjust (both cards) -> modal -> Claude revises -> card updated
    card-actions.js   Build it, Create quote, hand-off, Quote it, Discard
    card.js           the offer card (Block Kit)
    quote-card.js     the quote card (Block Kit)
    views.js          modal views
    format.js         Block Kit and money formatting
    modal-utils.js    progress steps, posting cards
    examples.js       example requests behind the modal chips (fictional)
skills/
  sales-request-extraction.md   the /configure skill (also in Context Builder)
  sales-quote-extraction.md     the /quote skill
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

That is contract v1. The orchestrator sends v2: `sellingModel` per product,
`pricing.appliesTo`, an explicit `bundle` (components, optional parts, catalog
products reused by `productId`), and `presentation`, the customer page. `/quote`
sends `{ account, lines, presentation }` to `POST quote`. Endpoint reference:
[salesforce/README.md](salesforce/README.md).

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

Then type `/quote` or `/configure` in a channel the bot is in.

| Variable | Required | Effect |
|---|---|---|
| `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | yes | connect to Slack over Socket Mode |
| `ANTHROPIC_API_KEY` | no | use the Anthropic API; without it, the local `claude` CLI is used |
| `CLAUDE_BIN`, `CLAUDE_MODEL` | no | path to the `claude` CLI, model override |
| `SF_DOMAIN`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET` | no | build in a real Salesforce org; without them, a stub returns a placeholder link |

With only the Slack tokens set, both flows run end to end against a stub with
fictional customers and catalog.

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
