# 03 — Same blocks, another customer

**Role:** sales rep · **Skill:** `sales-copilot-sell` · **Shows:** the page is composed per customer, not templated

## Prompt

```text
Use the sales-copilot-sell skill. Nowak Design also wants cloud backup for the whole team. Prepare an offer.
```

Polish: `Użyj skilla sales-copilot-sell. Nowak Design też chce backup w chmurze dla całego zespołu. Przygotuj ofertę.`

## What the agent does

1. Reads the customer: Nowak Design, Business, 8 people, a design studio, no services yet.
2. Prices it: 8 × $8 = **$64 per month**, below the 50-seat tier.
3. Composes a different page: no savings block (at 8 seats there is nothing to save, it would show $0), the
   reasons first, then the line.
4. After **Create**: a `Draft` quote and its page.

Request body: [`../examples/quote_nowak_cloud_backup.json`](../examples/quote_nowak_cloud_backup.json).

## Acme vs Nowak Design

| | Acme Logistics | Nowak Design |
|---|---|---|
| Customer | 120 people, already has Cloud Analytics | 8 people, new |
| First block | Savings: $96 a month, $1,152 a year | Why it fits a studio of 8 |
| Savings block | yes | no |
| Reasons | from the customer record (renewal due soon) | for a small team (no set-up fee, grow from 8) |
| Price | $864 / month with the 10% tier | $64 / month, list price |

## On stage

Open both pages in two browser tabs and switch between them. If there is no time for the prompt, open the pages
from the earlier rehearsal (the `pageUrl` of both quotes).

## What to say

"Same app, same blocks. For Acme the agent leads with savings, because they buy for 120 people. For a studio of
eight it leads with why it's worth it, and shows the price. Nobody designed these pages."
