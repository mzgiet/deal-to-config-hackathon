---
name: sales-copilot-build
description: "Cursor channel of the Sales Copilot PoC — turns a plain-language offer request from the chat (product, unit price, volume discounts, B2B/B2C) into a Sales Copilot request, shows it for approval, posts it to /services/apexrest/salescopilot/build on the PoC org, refreshes pricing and opens the configurator link. TRIGGER when: the user describes an offer or price to set up in Revenue Cloud in their own words (e.g. 'set up Cloud Analytics at $40 per user, 10% off from 100 users, business only'), asks to 'build it', 'configure it via Sales Copilot' or to run the Cursor channel of the PoC. DO NOT TRIGGER when: loading or editing a catalog from CSV or by hand (revenue-cloud-product-config), pricing an existing catalog record by record (revenue-cloud-price-config), product rules (revenue-cloud-product-rules), or working on the endpoint's Apex or the configurator's React code."
metadata:
  version: "0.2"
  domains: ["Salesforce", "Revenue Cloud", "Sales Copilot PoC"]
---

# Sales Copilot — Cursor channel

The agent plays the orchestrator's part (Slack card + Claude extraction) for one request: it turns the user's
sentence into the request JSON, the user approves it, the endpoint builds the configuration in one transaction.
The agent does not create records itself.

PoC org: `poc-salescopilot`. Run from the `salesforce/` folder of this repository. Contract: `docs/salesforce-integration.md` at the repository root.

## Workflow

```
- [ ] 1. Extract the request from the user's words
- [ ] 2. Show it and get approval (the approval is the consent to write to the org)
- [ ] 3. POST it to the endpoint
- [ ] 4. Refresh pricing
- [ ] 5. Open the link and report
```

### 1. Extract

Write `/tmp/sales-copilot/<requestId>.json` in this shape:

```json
{
  "requestId": "req_cloud_analytics_2611061712",
  "rawRequest": "<the user's words, verbatim>",
  "source": { "channel": "cursor" },
  "extracted": {
    "products": [{ "name": "Cloud Analytics licence", "basePrice": 40, "currency": "USD", "sellingModel": "evergreen" }],
    "pricing": {
      "type": "volume-tier",
      "tiers": [{ "from": 100, "discountPct": 10 }, { "from": 500, "discountPct": 15 }]
    },
    "availability": "B2B"
  },
  "summary": "Cloud Analytics licence at $40 per user with 10% off from 100 users and 15% off from 500, for business customers",
  "assumptions": ["Price is per user per month"],
  "target": "revenue-cloud"
}
```

Rules the endpoint enforces — get them right here instead of round-tripping a 400:

| Field | Rule |
|---|---|
| `requestId` | New for every build: `req_<short_slug>_<yyMMddHHmm>`, only `A-Z a-z 0-9 _ -`, max 80. Reusing an id returns the old link and builds nothing |
| `products[].name` | Required, unique within the request |
| `products[].basePrice` | Number ≥ 0, the price per unit before discounts |
| `products[].currency` | `USD` only (single-currency org); anything else is rejected |
| `products[].sellingModel` | `one-time` (default) or `evergreen` (billed monthly). "Per month", "subscription", "monthly fee" → `evergreen`; hardware and set-up fees → `one-time`. `term` is not supported |
| `pricing.type` | `flat` (no tiers), `volume-tier` (at least one tier) or `bundle` (products sold as one package, see below) |
| `pricing.tiers[]` | `from` whole number ≥ 1, distinct; `discountPct` > 0 and ≤ 100. Range tiers: the reached rate applies to every unit. "Above 100" means `from: 100` unless the user says otherwise — record that in `assumptions` |
| `pricing.appliesTo` | Optional product name the tiers belong to; omit with one product |
| `availability` | `B2B`, `B2C` or `both`. Not stated → ask, do not guess |
| `assumptions` | Every interpretation you made that the user did not say (unit, period, tier boundaries) |

Bundles (`pricing.type: "bundle"`) add `extracted.bundle`:

```json
"bundle": {
  "name": "Internet Bundle",
  "components": [
    { "product": "Mobile Internet", "qty": 1 },
    { "product": "Router", "qty": 1, "optional": true }
  ]
}
```

- Every component names one of `products[]`, once; `qty` ≥ 1 (default 1); at least one component is required.
- Without `components`, every product is a required component with qty 1. Without `name`, the bundle is named
  after its products joined with " + ".
- The bundle bills monthly if any component is `evergreen`. Its price is the sum of its components.
- **Bundle discounts are rejected** (`tiers` or `bundle.discountPct`): tell the user and offer the bundle without
  the discount, or the discount as a volume tier on one product instead.

Ask a short question instead of inventing a missing unit price or audience.

### 2. Approve

Show the user a compact summary — product, unit price and billing (one-time / monthly), a tier table with the
resulting unit prices or the bundle's components, audience, assumptions — and the JSON. Ask with `AskQuestion`: build it / change something / cancel. Post nothing without
an explicit "build it" in this turn.

### 3. Build

```bash
sf api request rest 'services/apexrest/salescopilot/build' --method POST \
  --header 'Content-Type: application/json' --body @/tmp/sales-copilot/<requestId>.json \
  -o poc-salescopilot
```

- HTTP 200 → `{ "requestId", "status": "created", "artifactUrl" }`.
- HTTP 400 → `{ "status": "failed", "error" }`: the request broke a rule above. Show the error, fix the JSON with a
  **new** `requestId`, return to step 2.
- HTTP 500 → org setup or Salesforce rejected the records; nothing was created. Show the error and stop.

### 4. Refresh pricing

The pricing procedure reads decision tables, not the records:

```bash
sf api request rest 'services/data/v66.0/connect/core-pricing/sync/syncData' -o poc-salescopilot
```

The first sync after a build can miss new prices; run it twice. The configurator page prices from the records
and does not wait for it.

### 5. Open and report

Open `artifactUrl` in the Cursor browser (`cursor-ide-browser` → `browser_navigate`); the session must already be
logged in to `poc-salescopilot` (`sf org open -o poc-salescopilot` once). Take a screenshot and show it with the
link. Report in the user's language: what was built (product, price, tiers, audience), the link, and the
assumptions made.

## Reset a demo request

`scripts/apex/salescopilot-reset-request.apex` deletes one request's configuration (set the id at the top),
then run step 4. Ask before running it — it deletes records.
