# 05 — Bundle reusing a catalog product

**Role:** product manager · **Skill:** `sales-copilot-build` · **Needs:** Mobile Internet in the catalog, no
"Home Office Bundle" yet

The reserve for "doesn't the AI just create duplicates?".

## Prompt

```text
Use the sales-copilot-build skill. New Home Office bundle for consumers: Mobile Internet plus an optional
Wi-Fi Extender at $20 one-time.
```

Polish: `Użyj skilla sales-copilot-build. Nowy pakiet Home Office dla klientów indywidualnych: Mobile Internet plus
opcjonalny Wi-Fi Extender za 20 $ jednorazowo.`

## What the agent does

1. Reads the catalog and says Mobile Internet already exists ($10 per month), so the bundle reuses it
   (`{ "productId": "…" }` instead of a name and price). Only the Wi-Fi Extender is new.
2. The summary marks each component as reused or new → **Build** → refresh pricing → the configurator link.

On the page the Mobile Internet component reads "Included · already in the catalog"; the Wi-Fi Extender is an
optional add-on with a toggle that changes the total.

## What to say

"The AI didn't create a second Mobile Internet. It knows the catalog, so it only added what was missing."

## Variants for questions

- "…Mobile Internet at $12…": the agent does not change the price of an existing product. It asks whether to reuse
  it at $10 or create a new product under another name.
- A product with the same name as one in the catalog: the endpoint answers **409** with the existing product and
  its configurator link; nothing is built. The Slack orchestrator shows the same.

## Reset

`scripts/apex/salescopilot-reset-request.apex` with the build's `requestId` deletes the bundle and the Wi-Fi
Extender, never the reused Mobile Internet. Refresh pricing afterwards.
