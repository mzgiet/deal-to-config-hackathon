---
name: sales-copilot-sell
description: "Sales-rep channel of the Sales Copilot PoC — turns a request to sell to a named customer (e.g. 'Acme wants 80 more Cloud Analytics licences, give them 5%') into a Revenue Cloud quote: reads the customer's current services and open quotes, proposes lines from the existing catalog, checks the discount threshold, gets approval and posts to /services/apexrest/salescopilot/quote on the PoC org. TRIGGER when: the user names a customer and wants an offer, quote, upsell, renewal or discount for them; asks what a customer already has or what can be sold to them; or asks to run the sales-rep part of the Sales Copilot demo. DO NOT TRIGGER when: the user describes a new product or price to set up (sales-copilot-build), loads or edits a catalog (revenue-cloud-product-config, revenue-cloud-price-config), or works on the endpoints' Apex or the configurator's React code."
metadata:
  version: "0.1"
  domains: ["Salesforce", "Revenue Cloud", "Sales Copilot PoC"]
---

# Sales Copilot — sales rep

The agent prepares a quote the way a sales rep would: it looks the customer up, offers only what the catalog
sells to that customer's segment, and flags anything that needs a manager. It never invents a product or a
price; if the catalog lacks what the customer wants, that is a job for `sales-copilot-build` (the product
manager's role), not a workaround here. The agent does not create records itself — the quote endpoint does.

PoC org: `poc-salescopilot`. Run from the `salesforce/` folder of this repository. All calls are `sf api request rest … -o poc-salescopilot`.

## Workflow

```
- [ ] 1. Find the customer
- [ ] 2. Read the catalog for their segment
- [ ] 3. Propose the lines
- [ ] 4. Show the proposal and get approval (the approval is the consent to write to the org)
- [ ] 5. Create the quote and report
```

### 1. Customer

```bash
sf api request rest 'services/apexrest/salescopilot/customer?name=<at least 2 characters>' -o poc-salescopilot
```

Returns up to 5 matches: `accountId`, `name`, `segment` (`Business` / `Consumer`), `industry`, `employees`,
`notes`, `services[]` (assets: `product`, `quantity`, `unitPrice`, `status`, `contractEnd`,
`daysToContractEnd`) and `openQuotes[]`.

- No match → say so and ask for the exact name. Do not create a customer.
- Several matches → ask which one; carry its `accountId` from here on.
- Read the context before proposing: what they already pay for, contracts ending within ~90 days (a renewal
  conversation), open quotes that the new one might duplicate.

### 2. Catalog

```bash
sf api request rest 'services/apexrest/salescopilot/catalog?audience=<segment>' -o poc-salescopilot
```

Returns `maxDiscountWithoutApprovalPct` and `products[]`: `name`, `type` (`Simple` / `Bundle`), `sellingModel`,
`billing` (`one-time` / `monthly` / `yearly`), `listPrice`, `volumeTiers[]` (`fromQuantity`, `toQuantity`,
`adjustment`, `value`), and for bundles `components[]` (`name`, `required`, `listPrice`, `billing`). A simple
product with `includedIn` is also a bundle component and can be sold on its own.

A bundle's own `listPrice` is 0 — its price is the sum of the required components plus any chosen optional ones.

### 3. Propose

Build the lines from the user's request and the context. For each line work out the unit and total price
yourself from the catalog so the user sees the number before anything is written:

- **Volume tiers** — the tier is reached by the quantity **on that line**, and then applies to every unit on it.
  Existing assets do not count: a customer with 40 licences buying 80 more gets no 100-unit tier. Say so when
  it matters, and offer the alternative (e.g. "add 20 more and the whole line drops to the 10% tier").
- **Manual discount** — percent off the price after tiers. Up to `maxDiscountWithoutApprovalPct` is the rep's
  call; above it the quote is created as `Needs Review`. Say that up front, do not lower the discount silently.
- **Bundles** — required components are always added; optional ones go in `addOns` by component name.
- **Segment** — only offer products from the step 2 list. A product sold to the other segment is a 400.
- Mixed billing (one-time + monthly) — show the one-time total and the monthly total separately.

### 4. Approve

Show a compact proposal in the user's language:

| Product | Qty | List | Tier | Discount | Unit | Total | Billing |
|---|---|---|---|---|---|---|---|

followed by the customer context that shaped it (current services, contract end, open quotes), whether approval
is needed and why, and any assumptions. Ask with `AskQuestion`: create the quote / change something / cancel.
Post nothing without an explicit "create" in this turn.

### 5. Quote

```bash
sf api request rest 'services/apexrest/salescopilot/quote' --method POST \
  --header 'Content-Type: application/json' -o poc-salescopilot \
  --body '{"account":"<accountId>","lines":[{"product":"Cloud Analytics licence","quantity":120,"discountPct":5}]}'
```

| Field | Rule |
|---|---|
| `account` | Account Id (preferred) or exact name; a name matching two accounts is a 400 |
| `lines[].product` | Exact catalog name or product code; the newest active product wins on a shared name |
| `lines[].quantity` | Whole number ≥ 1; default 1 |
| `lines[].discountPct` | 0 ≤ value < 100; omit for none |
| `lines[].addOns` | Bundles only: names of optional components |

- HTTP 200 → `quoteId`, `quoteUrl`, `quoteStatus` (`Draft` / `Needs Review`), `grandTotal`, `opportunityId`,
  `approvalRequired`, `approvalReasons[]`. Every quote gets a new Opportunity on the account.
- HTTP 400 → `error` names the rule broken (unknown product, wrong segment, bad add-on). Fix the line and go back
  to step 4 — nothing was created.
- HTTP 500 → Revenue Cloud rejected the quote and everything was rolled back. Show the error and stop.

Compare `grandTotal` with the total you showed in step 4. A difference means the pricing procedure disagrees with
the catalog (stale decision tables, a tier you misread) — say so instead of glossing over it; refreshing pricing
is `sf api request rest 'services/data/v66.0/connect/core-pricing/sync/syncData' -o poc-salescopilot`.

Report: the quote link, status, total, the approval reason if any, and one line on what to do next (send it,
or wait for the manager).
