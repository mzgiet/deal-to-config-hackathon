# 01 — Offer for Acme

**Role:** sales rep · **Skill:** `sales-copilot-sell` · **Needs:** Cloud Backup in the catalog

## Prompt

```text
Use the sales-copilot-sell skill. Acme wants cloud backup for all their employees. Prepare an offer.
```

Polish: `Użyj skilla sales-copilot-sell. Acme chce backup w chmurze dla wszystkich pracowników. Przygotuj ofertę.`

## What the agent does

1. Reads the customer: Acme Logistics, Business, 120 employees, 40 Cloud Analytics licences, contract ending in
   about 80 days, open quotes for Cloud Analytics only (nothing to duplicate).
2. Reads the Business catalog and finds Cloud Backup: $8 per user per month, 10% off from 50.
3. Prices it: 120 × $7.20 = **$864 per month**. No discount, so no approval.
4. Shows the page outline and why: savings first (Acme buys volume), then "why it fits Acme" with facts from the
   customer record, then the lines.
5. After **Create**: a `Draft` quote, an Opportunity, and the customer page.

Request body: [`../examples/quote_acme_cloud_backup.json`](../examples/quote_acme_cloud_backup.json).

## What the page shows

- "Prepared for Acme Logistics · 120 users", status "Ready to send".
- What Acme saves: $864 / month, **$96 less than list price, $1,152 a year**, "120 × Cloud Backup · 10% volume rate".
- Why it fits Acme: all 120 employees covered; the 10% rate already applies from 50 seats; the Cloud Analytics
  renewal is due soon, so one conversation covers both.
- The quote line: 120 × $7.20 ($8 crossed out), $864 / month.

## What to say

"The agent doesn't guess: the customer, the price and the tier come from Salesforce, and Revenue Cloud priced the
quote. And the page is not a template: the agent knows Acme buys for 120 people, so it leads with the savings."

## Check

`grandTotal` in the response must equal the $864 the agent showed. A difference means the pricing decision tables
are stale: refresh pricing (`sf api request rest 'services/data/v66.0/connect/core-pricing/sync/syncData' -o
poc-salescopilot`, twice).
