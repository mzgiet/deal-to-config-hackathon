# Demo scenarios (Cursor channel)

One file per scenario: the prompt, what the agent should do, the numbers it must show, and what to say. The agent
runs on the two skills in `../skills/`; the presenter only types the prompt and clicks the choice in the
question card. Prompts can be typed in English or Polish.

| # | Scenario | Role | Skill | Shows |
|---|---|---|---|---|
| [01](01-offer-for-acme.md) | Offer for Acme | Sales rep | `sales-copilot-sell` | Customer + catalog → priced quote → a page composed for Acme |
| [02](02-discount-above-limit.md) | Customer wants 15% | Sales rep | `sales-copilot-sell` | Discount above the limit → manager approval; the page is composed again |
| [03](03-same-blocks-other-customer.md) | Same blocks, another customer | Sales rep | `sales-copilot-sell` | A different page from the same blocks for a small studio |
| [04](04-product-not-in-catalog.md) | Product not in the catalog | Sales rep → product manager | both | The rep's agent hands off; one sentence puts the offer in Revenue Cloud |
| [05](05-bundle-with-catalog-product.md) | Bundle reusing a catalog product | Product manager | `sales-copilot-build` | The build knows the catalog: reuses, does not duplicate |
| [06](06-catalog-check.md) | Catalog check: exists, similar or new | Anyone | `sales-copilot-build` | The agent checks the catalog first, the person decides; the page opens the record in Salesforce |

## The 5-minute run

The main story is 01 → 02, with 03 if there is time. 04, 05 and 06 are reserves for questions from the floor.

| Time | What | Scenario |
|---|---|---|
| 0:00–0:30 | The problem: "Before the Acme meeting the rep opens CRM, the price list, a discount spreadsheet and an offer template. An hour of work, and the offer looks like every other one." | — |
| 0:30–2:00 | The agent reads Acme and the catalog, prices the quote with the volume tier, builds the quote and a page for Acme | 01 |
| 2:00–3:15 | The customer wants 15% → the quote waits for a manager; the page is composed again. Then the Nowak Design page next to Acme's | 02, 03 |
| 3:15–4:30 | Slide: channels (Slack, Cursor) → one contract → deterministic Apex endpoints → Revenue Cloud → a page composed per customer | — |
| 4:30–5:00 | Roadmap, including 04: a missing product put in the catalog with one sentence | — |

Closing line: "Three sentences, and out of them a Revenue Cloud quote, a discount check and a page for the customer
that nobody designed: the agent composed it from what it knows about Acme."

## How the page is composed

The configurator ships a fixed set of blocks. For every quote (and every build) the agent sends `presentation`:
a headline, the customer and the blocks in the order it chose. The blocks for a quote page are `savings`,
`highlights` and `offer`; a build page also has `assumptions` and `request`. The app is deployed once; what
changes per customer is the choice, the order and the content of the blocks.

```json
"presentation": {
  "headline": "Cloud Backup for every Acme employee, at the 10% volume rate",
  "customer": { "name": "Acme Logistics", "quantity": 120 },
  "sections": ["savings", { "type": "highlights", "title": "Why it fits Acme", "items": ["…"] }, "offer"]
}
```

## Before the demo

- [ ] Cursor workspace includes this repository; **new chat, Agent mode**.
- [ ] `sf org display -o poc-salescopilot` shows `Connected`; the Cursor browser is logged in to the org
      (`sf org open -o poc-salescopilot` once).
- [ ] `sf api request rest` runs without a confirmation prompt (Cursor allowlist), or every call waits for a click.
- [ ] Fictional customers exist: `sf apex run -f scripts/apex/salescopilot-seed-customers.apex -o poc-salescopilot`.
- [ ] For 01–03: **Cloud Backup is in the catalog** ($8 per user per month, 10% from 50, business customers).
      If not, build it from [`../examples/req_cloud_backup.json`](../examples/req_cloud_backup.json) with the build
      skill, then refresh pricing twice.
- [ ] For 04: the opposite, Cloud Backup **must not** exist (reset it with `scripts/apex/salescopilot-reset-request.apex`).
      Delete the quotes that contain Cloud Backup first; Salesforce does not delete a product that is on a quote line.
- [ ] For 06: Cloud Backup and Business VoIP exist ([`../examples/req_business_voip.json`](../examples/req_business_voip.json)),
      Email Security does not.
- [ ] A recording of a full run as the fallback.

Only fictional data: the customers come from the seed script, the products from the examples.
