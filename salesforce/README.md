# Sales Copilot — Salesforce side

The Salesforce half of Sales Copilot: Apex REST endpoints that turn a structured request into Revenue Cloud records
and quotes, and a React configurator that shows the result. The orchestrator in the rest of this repository is one
caller; an agent in Cursor (see [skills](#skills)) is another. Both send the same contract.

**No AI runs in Salesforce.** Every endpoint is deterministic Apex: it validates the request, writes the records in
one transaction and returns a readable error instead of a half-built configuration. The language work happens
before the request arrives.

## What's here

| Path | What |
|---|---|
| `force-app/main/default/classes/` | Five REST resources and their services, selector, constants, test data factory and tests |
| `force-app/main/default/objects/` | `SalesCopilot_Request__c` (one record per request) and five custom fields on standard objects |
| `force-app/main/default/uiBundles/RevenueConfigurator/` | The built configurator (UI Bundle), served inside Salesforce |
| `force-app/main/default/contextDefinitions/`, `expressionSetDefinition/` | Pricing: the context definition and the pricing procedure |
| `force-app/main/default/permissionsets/` | `SalesCopilotAccess` (endpoints and fields), `RevenueConfiguratorAccess` (the app) |
| `configurator/` | React + TypeScript source of the configurator; `npm run build` writes into the UI Bundle |
| `skills/` | Two agent skills that drive the endpoints from a chat: one per role |
| `scripts/apex/` | Seed fictional customers; reset one demo request |
| `examples/` | Sample request bodies, including one that must be rejected |
| `demo/` | The demo scenarios, one file each: prompt, expected numbers, what to say |
| [`TESTING.md`](TESTING.md) | Step-by-step manual for testing everything against the PoC org, including Slack |

## Endpoints

All under `/services/apexrest/salescopilot/`. Errors come back with a non-200 status and
`{ "status": "failed", "error": "<readable message>" }`. The one exception is `build` answering 409 with
`"status": "exists"` (see below): nothing failed, the offer is already in the catalog.

| Endpoint | Role | Does |
|---|---|---|
| `POST check` | Anyone, before `build` | Same body as `build`, builds nothing: is the product already sold (`exists`), are there look-alikes (`similar`), or nothing (`new`) |
| `POST build` | Product manager | Contract in, configuration out: products, prices, tiers, bundle. Returns `{ requestId, status, artifactUrl, recordUrl }` |
| `GET catalog?audience=Business` | Sales rep | What can be sold to a segment: price, billing, volume tiers, bundle components, the discount limit |
| `GET customer?name=Acme` | Sales rep | A customer's segment, current services (assets, contract end) and open quotes |
| `POST quote` | Sales rep | A priced Revenue Cloud quote for a customer, with approval when the discount is too high |

### `check`

Send the body you are about to `build`. Nothing is written; the answer is always HTTP 200 unless the JSON
cannot be parsed (400):

```json
{
  "requestId": "chk_backup_similar",
  "status": "similar",
  "problems": null,
  "matches": [
    {
      "forProduct": "Backup w chmurze", "match": "similar", "sharedWords": ["backup"],
      "productId": "01t...", "name": "Cloud Backup", "type": "Simple", "audience": "Business",
      "billing": "monthly", "listPrice": 8,
      "artifactUrl": "https://...app/c__RevenueConfigurator?requestId=...",
      "recordUrl": "https://...my.salesforce.com/lightning/r/Product2/01t.../view"
    }
  ]
}
```

- `status`: `exists` if any requested name (a new product or the bundle) is an active catalog product, ignoring
  case: `build` would answer 409. `similar` if names only share a significant word (3+ letters, not a filler such
  as "pro", "bundle", "service", "pakiet"). `new` otherwise.
- `problems`: what `build` would reject with 400 (missing price, bad tiers…), or `null`.
- `matches`: exact matches first. `recordUrl` opens the product in Lightning; `artifactUrl` is set when Sales
  Copilot built it.

The word match is deliberately simple: it catches "Backup w chmurze" vs "Cloud Backup" but not a translation such
as "Kopia zapasowa". An LLM caller can read `GET catalog` and judge those itself.

### `build`

The contract is described in [../docs/salesforce-integration.md](../docs/salesforce-integration.md) (v1 plus the
v2 fields `sellingModel`, `pricing.appliesTo` and `bundle`). A build creates, in one transaction:

| Record | Per | Notes |
|---|---|---|
| `SalesCopilot_Request__c` | request | Keyed by `requestId`; a repeated id returns the existing link and builds nothing |
| `Product2` | product, plus one for a bundle | `Audience__c` = Business / Consumer / Both from `availability` |
| `ProductSellingModelOption`, `PricebookEntry` | product | Standard Price Book; `one-time` or `evergreen` (monthly) selling model |
| `ProductCategoryProduct` | product | One demo category, so the catalog finds it |
| `PriceAdjustmentTier` | tier × discounted product | On the shared "Standard Price Adjustment Tier" schedule, Range bands with no gaps |
| `ProductComponentGroup`, `ProductRelatedComponent` | bundle | "Included" and "Optional" groups; required components are default and fixed |

`artifactUrl` opens the configurator with `?requestId=`. `recordUrl` opens the bundle, or the first new product, in
Lightning; it is stored on `SalesCopilot_Request__c.Record_Url__c` and a repeated `requestId` returns it too.

**The build knows the catalog.** A new product may not take the name of an active catalog product (case does
not matter), or the catalog would hold two products a rep cannot tell apart. If name clashes are the only
problem, nothing is built and the answer is HTTP 409:

```json
{
  "requestId": "req_mf3k_003",
  "status": "exists",
  "error": "\"Cloud Analytics licence\" already exists in the catalog (productId 01t..., 40.00 USD); send its productId to reuse it, or give the new product another name",
  "existingProducts": [
    { "productId": "01t...", "name": "Cloud Analytics licence", "unitPrice": 40, "billing": "one-time", "artifactUrl": "https://...", "recordUrl": "https://..." }
  ]
}
```

`artifactUrl` is there when Sales Copilot built that product, so a caller can offer "open the existing offer"
instead of an error. A bundle can **reuse** catalog products: list them in `products[]` as
`{ "productId": "01t..." }` and name them in `bundle.components` by their catalog name. Only the new products and
the bundle are created; a reused product keeps its price, billing and tiers (a different `basePrice` is a 400),
must be sold to the bundle's audience, and can only join a bundle, not be repriced on its own. The configurator
marks reused components "already in the catalog". `GET catalog` returns `productId` and `artifactUrl` for this.

### `quote`

```json
{ "account": "001...", "lines": [{ "product": "Cloud Analytics licence", "quantity": 120, "discountPct": 5 }] }
```

- Resolves the account by Id or exact name, and refuses a product sold only to the other segment.
- Creates an Opportunity and places the quote through `RevSalesTrxn.PlaceSalesTransactionExecutor`, so the
  real pricing procedure prices it: list price, volume tier, then the manual discount.
- Adds a bundle's required components itself; optional ones come from `addOns`.
- A discount above 10% sets the quote to `Needs Review` and returns the reason.
- The configurator calls the same endpoint with `{ "requestId", "addOns" }` for its "Create quote" button.
- With `presentation` (below) it also returns `pageUrl`: the customer's proposal page for this quote.

### `presentation`: the page the agent composes

Both `build` and a customer `quote` accept an optional top-level `presentation`. The configurator ships a fixed set
of blocks; the caller picks which ones to show, in which order, and writes their text for this customer:

```json
"presentation": {
  "headline": "Cloud Backup for every Acme employee, at the 10% volume rate",
  "customer": { "name": "Acme Logistics", "quantity": 120 },
  "sections": [
    "savings",
    { "type": "highlights", "title": "Why it fits Acme", "items": ["All 120 employees covered", "…"] },
    "offer"
  ]
}
```

| Block | Shows | On |
|---|---|---|
| `offer` | The priced products (build) or the quote lines (quote). Required whenever `sections` is sent | both |
| `savings` | Total, saving vs list per month and per year, how far the next tier is | build (volume-tier, needs `customer.quantity`), quote |
| `highlights` | 1–5 reasons the offer fits this customer, optional `title` | both |
| `assumptions`, `request` | The approved assumptions; the words of the request | build |

Each block at most once, `headline` up to 160 characters; anything else is a 400 and nothing is created. It is
stored as JSON on `SalesCopilot_Request__c.Presentation__c` or `Quote.Presentation__c`. Without `presentation`
both pages keep their default layout, so a caller that does not send it changes nothing.

## The configurator

A React app built as a Salesforce UI Bundle (Multi-Framework), so it runs inside the org with the user's session
and no separate hosting or login. With `?requestId=` it reads that request's products, price book entries, tiers
and bundle structure through the Salesforce GraphQL API and shows:

- a flat price, a volume table with a quantity slider, or a bundle with optional components;
- monthly and one-time totals separately;
- a "Create quote" button that prices the selection in Revenue Cloud;
- an "Open in Salesforce" button that opens the product or bundle record, for builds made after it was added.

With `?quoteId=` it shows a customer's proposal page instead: the quote's lines as Revenue Cloud priced them
(tier and manual discount included), its status ("Awaiting manager approval" when `Needs Review`) and the blocks
from `Quote.Presentation__c`.

Without either parameter it opens an earlier catalog browser that shares the same code.

## Skills

Agent skills for Cursor or Claude Code that call the endpoints with the Salesforce CLI, one per role:

- [`sales-copilot-build`](skills/sales-copilot-build/SKILL.md): a product manager describes an offer in plain
  words; the agent writes the contract, asks for approval, builds it and opens the configurator.
- [`sales-copilot-sell`](skills/sales-copilot-sell/SKILL.md): a sales rep names a customer; the agent reads their
  services and the catalog for their segment, proposes lines with tier and discount maths, flags anything that
  needs approval and creates the quote.

One more skill is for UI work rather than the endpoints:
[`synechron-web-ui`](skills/synechron-web-ui/SKILL.md) describes the configurator's Synechron style (palette
tokens, background gradient, yellow accent rules, typography, components, contrast). Use it for any UI change.
Claude Code picks it up automatically through the `.claude/skills/synechron-web-ui` link at the repository root.

## Deploy to a sandbox

Revenue Cloud must be enabled, with Salesforce Pricing and the Standard Price Book active.

```bash
cd salesforce
sf project deploy start --source-dir force-app -o <alias>
sf org assign permset --name SalesCopilotAccess --name RevenueConfiguratorAccess -o <alias>
sf apex run --file scripts/apex/salescopilot-seed-customers.apex -o <alias>   # optional: fictional customers
```

Rebuilding the configurator: `cd configurator && npm install --legacy-peer-deps && npm run deploy`
(`npm run open` opens it). Both use the CLI's default org; prefix them with `SF_ORG=<alias>` to target a specific
one. `--legacy-peer-deps` is needed because the UI Bundle plugin declares a React 19 peer while the app uses
React 18; plain `npm install` fails with `ERESOLVE`.

An active pricing procedure version cannot be redeployed. Deactivate it in Pricing Procedure Builder (or set
`ExpressionSetVersion.IsActive = false`), deploy, then activate it again.

## One-off org setup

Done once per org, not per request:

- Selling models **One Time** and **Evergreen Monthly**, active.
- The **Standard Price Adjustment Tier** schedule, and a product category with code `SALES_COPILOT_OFFERS`.
- Decision tables for price book entries and volume tiers, refreshed after each build
  (`POST /services/data/v66.0/connect/core-pricing/sync/syncData`).
- The pricing procedure in this folder set as the org's default, and the context definition
  `SalesCopilotTransactionContext` active.
- For the orchestrator: the External Client App **Sales Copilot Orchestrator** (`externalClientApps/` and the
  `extlClntApp*` folders): Client Credentials flow, scope `api`, a Run As user holding `SalesCopilotAccess`.
  Before deploying to another org, set `clientCredentialsFlowUser` in
  `extlClntAppOauthPolicies/SalesCopilot_Orchestrator_oauthPlcy.ecaOauthPlcy-meta.xml` to that org's Run As
  user. The consumer key and secret are generated by the org and read in Setup (External Client App Manager →
  Sales Copilot Orchestrator → Settings → OAuth Settings); they are not in this repository.

The pricing procedure contains record Ids of the org's adjustment schedules; in a new org, re-select them in
Pricing Procedure Builder after deploying.

## Known limitations

- **Bundle discounts are rejected** with a 400 (`tiers` or `bundle.discountPct` on a bundle), including the
  "tier with `from: 1`" convention in contract v1. Bundles price as the sum of their components. The
  orchestrator already drops the discount and records it as an assumption.
- **Existing products are never changed** by a build: no new price, tiers or audience for a catalog product.
- **Currency:** single-currency org, USD only. **Selling models:** `one-time` and `evergreen`; `term` is rejected.
- **Decision tables** are not refreshed by the build; the configurator computes tier prices from the records, so
  the page is right immediately, while quotes need the refresh.
- **Place Sales Transaction does not enforce bundle group minimums**, so the quote endpoint adds required
  components itself.
- **Manual discount needs a number field.** Pricing procedures reject Percent fields, so `QuoteLineItem.Discount`
  never reaches the Manual Discount step; the endpoint writes `Line_Discount_Pct__c`, mapped to a custom context
  tag.
- **B2B / B2C** has no Revenue Cloud field: `Product2.Audience__c` and `Account.Customer_Segment__c` are custom.
- Apex tests cover the build endpoint; the quote, customer and catalog endpoints were verified against the org
  and have no tests yet.

## Data

Fictional products and customers only, in a scratch org. No client data.
