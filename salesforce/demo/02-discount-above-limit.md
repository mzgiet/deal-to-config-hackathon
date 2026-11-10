# 02 — The customer wants 15%

**Role:** sales rep · **Skill:** `sales-copilot-sell` · **Follows:** 01, in the same chat

## Prompt

```text
The customer wants a 15% discount.
```

Polish: `Klient chce 15% rabatu.`

## What the agent does

1. Says up front that 15% is above the 10% a sales rep can give alone, so the quote will need a manager.
   It does not lower the discount silently.
2. Prices it: the 15% applies after the volume tier, $7.20 − 15% = $6.12 → 120 × $6.12 = **$734.40 per month**.
3. Composes the page again for the new situation: after a price push it still leads with the savings.
4. After **Create**: a new quote with status `Needs Review` and its own page.

## What the page shows

- Status badge "Awaiting manager approval".
- Saved vs list price: **$225.60 / month, $2,707.20 a year**; on the line "10% volume rate · 15% extra discount".
- Under the lines: the discount is above what a sales rep can give; a manager approves it before it is sent.

## What to say

"The AI doesn't get around the company's rules. A discount above the limit goes to the manager, and the customer
still gets a page that shows what they save."

## Check

`approvalRequired: true` and one reason in `approvalReasons` naming Cloud Backup and the 15%.
