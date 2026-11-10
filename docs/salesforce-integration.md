# Salesforce integration

How the Slack orchestrator hands a configuration to Salesforce, and what the
Salesforce side has to provide. With `SF_DOMAIN`, `SF_CLIENT_ID` and
`SF_CLIENT_SECRET` set, **Build it** calls the endpoint below; without them it
calls a stub ([src/builder.js](../src/builder.js)).

## How it connects

```
 Slack                 Orchestrator (Node)                Salesforce sandbox
 ─────                 ───────────────────                ──────────────────
 /configure ─────────► Claude: text → contract
                       card with products and discounts
 [Build it] ─────────► POST /services/oauth2/token ─────► token (client credentials)
                       POST contract ───────────────────► /services/apexrest/salescopilot/build
                                                            creates Product2, PricebookEntry,
                                                            discount tiers, bundle
 link in thread ◄───── { requestId, status, artifactUrl } ◄
 click ───────────────────────────────────────────────────► configurator (React)
                                                            reads records by requestId
```

**AI runs only on the orchestrator side.** Salesforce receives a finished
structure that has already been validated against a JSON schema. The Apex
code calls no model; it is a plain field mapping.

The entry point could later be a different surface, such as a corporate Slack
assistant or Teams. The contract stays the same.

## Endpoint

**`POST {MyDomain}/services/apexrest/salescopilot/build`**

Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`.
The body is the contract below.

**Success: HTTP 200**

```json
{ "requestId": "req_mf3k_001", "status": "created", "artifactUrl": "https://...", "recordUrl": "https://..." }
```

`recordUrl` (added later, safe to ignore) opens the built product or bundle record in Lightning, for a
"Open in Salesforce" button next to "Open configurator".

**Catalog check (optional, before Build it):** `POST .../salescopilot/check` with the same body answers
`{ "status": "exists" | "similar" | "new", "matches": [...] }` and builds nothing. Details and a Slack sketch:
[`salesforce/TESTING.md`](../salesforce/TESTING.md), section 3.

**Failure: HTTP 4xx/5xx** with a readable message:

```json
{ "requestId": "req_mf3k_001", "status": "failed", "error": "PricebookEntry: currency EUR not enabled" }
```

- **Return errors with a non-200 status.** The orchestrator treats every 200
  as success. The error body is shown to the rep in the Slack thread, so it
  should be understandable.
- **Timing:** the orchestrator waits up to 90 s while the card shows
  "Building…". The target is **< 15 s**. Synchronous Apex has a 10 s CPU
  limit, so heavy work belongs outside the request.
- **Retries (idempotency):** after a failure the rep can click **Try again**,
  which sends **the same `requestId`**. Store it in an External ID field such
  as `SalesCopilot_RequestId__c` on Product2 and upsert, or delete and
  recreate. This also makes cleaning up the sandbox easy.

`requestId` stays unique across orchestrator restarts, e.g. `req_mf3k_001`.

## Contract v1

| Field | Type | Meaning |
|---|---|---|
| `requestId` | string | unique request id |
| `rawRequest` | string | the rep's original wording, for logs and description only |
| `extracted.products[]` | array | products: `name`, `basePrice` (number, unit price), `currency` (`USD` / `EUR` / `GBP` / `PLN`) |
| `extracted.pricing.type` | enum | `flat` / `volume-tier` / `bundle` |
| `extracted.pricing.tiers[]` | array | `from` (quantity the discount starts at, **inclusive**), `discountPct` (percent). Empty list means no discount |
| `extracted.availability` | enum | `B2B` / `B2C` / `both` |
| `summary` | string | one plain-English sentence, e.g. for a product description or configurator heading |
| `assumptions[]` | string[] | what Claude assumed; the rep has seen and accepted these |
| `target` | string | always `revenue-cloud` |

### Mapping to records

Details and sources: [revenue-cloud-mapping.md](revenue-cloud-mapping.md).

**Each product** in `products[]`:
1. `Product2`: `Name` = `name`, `ProductCode` generated from the name and
   `requestId`, `IsActive = true`.
2. `ProductSellingModelOption` with **one pre-created** selling model (One
   Time; v1 does not carry a selling model).
3. `PricebookEntry`: `UnitPrice` = `basePrice`, same selling model, demo price
   book.
4. Optionally, assignment to a demo catalog category if the configurator
   looks products up by catalog.

**`pricing.type = "volume-tier"`**: tiers on **every** product in the list
(v1 does not say which product a discount applies to; v2 fixes that).

- `PriceAdjustmentTier` on the ready-made "Standard Price Adjustment Tier"
  schedule, method Range, type Percentage.
- Turn the list of `from` values into continuous bands with no gaps. For
  `[{from:100, 10}, {from:500, 15}]`:
  - 1–99: 0%,
  - 100–499: 10%,
  - 500–∞: 15%.
- `from` is an inclusive `LowerBound`. The orchestrator maps "above 500" to
  `from: 500`.

**`pricing.type = "bundle"`**: all products in `products[]` form **one static
bundle**.

- An extra `Product2` of type Bundle, named from `summary` or the component
  names (v1 has no bundle name).
- Components with quantity 1, "Include by default".
- The bundle needs its own `PricebookEntry`; price = sum of components.
- **A tier with `from: 1`** means a bundle discount with no threshold, i.e. a
  `BundleBasedAdjustment` ("5% off the bundle").
- **Tiers with `from > 1`** are a volume discount on the bundle product.

**`pricing.type = "flat"`**: products and prices only, no tiers.

### Examples (fictional)

Volume discount:

```json
{
  "requestId": "req_mf3k_001",
  "rawRequest": "They want the Cloud Analytics licence at $40 per user per month, 10% off above 100 users and 15% above 500. Business customers only.",
  "extracted": {
    "products": [{ "name": "Cloud Analytics licence", "basePrice": 40, "currency": "USD" }],
    "pricing": { "type": "volume-tier", "tiers": [{ "from": 100, "discountPct": 10 }, { "from": 500, "discountPct": 15 }] },
    "availability": "B2B"
  },
  "summary": "Cloud Analytics licence at $40 per user per month with 10% off from 100 users and 15% off from 500 users, for business customers",
  "assumptions": ["Price is per user per month"],
  "target": "revenue-cloud"
}
```

Bundle:

```json
{
  "requestId": "req_mf3k_002",
  "rawRequest": "Starter Hardware Kit ($200) and Onboarding Service ($500) sold together as one package, 5% off the package, B2B.",
  "extracted": {
    "products": [
      { "name": "Starter Hardware Kit", "basePrice": 200, "currency": "USD" },
      { "name": "Onboarding Service", "basePrice": 500, "currency": "USD" }
    ],
    "pricing": { "type": "bundle", "tiers": [{ "from": 1, "discountPct": 5 }] },
    "availability": "B2B"
  },
  "summary": "Starter Hardware Kit and Onboarding Service sold as one package with 5% off",
  "assumptions": [],
  "target": "revenue-cloud"
}
```

## Authentication (OAuth 2.0 Client Credentials)

Server to server: no user login and no Slack-to-Salesforce account mapping.

1. An **External Client App** (or Connected App) with OAuth, scope `api`, and
   **Client Credentials Flow** enabled.
2. A technical **Run As user** with:
   - CRUD on Product2, Pricebook2, PricebookEntry, ProductSellingModelOption,
     PriceAdjustmentTier, BundleBasedAdjustment, ProductRelatedComponent,
   - permission sets: Manage Product Catalog, ARC Access, Salesforce Pricing,
   - access to the Apex class behind the endpoint.
3. The My Domain URL, consumer key and consumer secret go into the
   orchestrator's `.env` only, never into the repo.

The orchestrator fetches a token from `POST {MyDomain}/services/oauth2/token`
(`grant_type=client_credentials`), keeps it in memory, and refreshes it once
on a 401.

> Client Credentials works **only on the My Domain URL**. Against
> `test.salesforce.com` you get `invalid_grant`. Missing Run As permissions
> only show up on the first real call, which is why the test below matters.

## One-off org setup

Done once, not per request:

- **Selling model** (One Time, active), shared by all products.
- **Demo price book** (or Standard). All products and bundles in the same one.
- **Demo catalog and category**, if the configurator looks products up by them.
- **Salesforce Pricing:**
  - Context Service with a context definition,
  - a pricing procedure with List Price, Volume Discount and Bundle Based
    Adjustment elements,
  - decision tables: Price Book Entries, Volume Discount Entries, Bundle Based
    Adjustment Entries.
- The discount schedule ID is hard-coded in the procedure, so **all
  configurations use one shared, ready-made schedule**.

## Open design points

1. **Where `artifactUrl` leads.** The link is clicked live, so it must open
   without surprises such as a Salesforce login screen: a Lightning page, an
   Experience Cloud site, or a separately hosted React app with `?requestId=`.
2. **Refreshing decision tables.** Without a refresh, pricing shows the price
   **without** the discount. Fallback: the configurator computes the discount
   itself from the `PriceAdjustmentTier` records.
3. **B2B / B2C** has no Revenue Cloud field. Options: ignore it, put it in the
   product description, a separate price book or category per segment, or a
   custom field.
4. **Currency.** If the sandbox has a single currency, ignore the field or
   return an error. The orchestrator can restrict the list to the currencies
   that are enabled.
5. **Price 0.** If the rep gave no price and skipped the question, `basePrice`
   is `0` and `assumptions` contains "Price for X to be confirmed". The card
   already flags this with a warning.

## Test before connecting Slack

```bash
# 1. Token
curl -s -X POST "$SF_DOMAIN/services/oauth2/token" \
  -d grant_type=client_credentials \
  -d client_id="$SF_CLIENT_ID" \
  -d client_secret="$SF_CLIENT_SECRET"

# 2. Build: the volume-discount example above saved as volume.json
curl -s -X POST "$SF_DOMAIN/services/apexrest/salescopilot/build" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data @volume.json
```

Expected: HTTP 200 with an `artifactUrl` that opens the configurator showing
$40, the 10% and 15% tiers, and a correctly discounted price for e.g. 600
units.

Then set `SF_DOMAIN`, `SF_CLIENT_ID` and `SF_CLIENT_SECRET` in `.env`. After a
restart, **Build it** goes to Salesforce instead of the stub. No code changes
are needed.

## Contract v2 (proposal)

v2 is a **superset of v1**: it only adds fields, so a parser that ignores
unknown fields keeps working.

```json
"extracted": {
  "products": [{
    "name": "Product A", "basePrice": 10, "currency": "USD",
    "sellingModel": "one-time",
    "term": null
  }],
  "pricing": {
    "type": "volume-tier",
    "appliesTo": "Product A",
    "tiers": [{ "from": 500, "to": null, "discountPct": 10 }]
  },
  "bundle": {
    "name": "A + B Bundle",
    "components": [{ "product": "Product A", "qty": 1 }],
    "discountPct": null
  },
  "availability": "B2B"
}
```

- `sellingModel`: `one-time` / `term` / `evergreen`; `term`
  (`{ "length": 12, "unit": "month" }`) only for subscriptions.
- `pricing.appliesTo`: a product name or `"bundle"`. Says which product a
  discount belongs to.
- `tiers[].to`: inclusive upper bound, `null` = open-ended.
- `bundle`: explicit composition, name and its own `discountPct`, instead of
  the "tier with `from: 1`" convention. `null` when there is no bundle.

## Rules

- **Sandbox only, fictional data only.** No client data.
- Secrets live only in `.env`, never in the repo.
