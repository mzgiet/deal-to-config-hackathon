# 04 — Product not in the catalog

**Roles:** sales rep, then product manager · **Skills:** `sales-copilot-sell`, then `sales-copilot-build` ·
**Needs:** Cloud Backup **not** in the catalog

The reserve for "and what if the product doesn't exist?". It is the same path the Slack orchestrator takes.

## Step 1 — the rep asks for something the catalog lacks

```text
Use the sales-copilot-sell skill. Acme wants cloud backup for all their employees. Prepare an offer.
```

Expected: the agent reads Acme and the Business catalog, finds no backup product and **quotes nothing**. It writes
a ready request for the product manager, with the deal it comes from:

```text
Request for the product manager — Acme Logistics (Business, 120 employees) wants cloud backup for all staff.
Not in the catalog. Suggested offer: Cloud Backup, per user per month, business customers.
Price and volume discount: to be set by the product manager.
```

Say: "The AI doesn't make up a product or a price. It says what is missing and passes it on with the context of
the deal."

## Step 2 — the product manager sets up the offer

```text
Use the sales-copilot-build skill. Set up the offer from the rep's request: Cloud Backup at $8 per user per month,
10% off from 50 users, business customers only.
```

Expected: the agent checks the catalog (no Cloud Backup yet), shows the product, monthly price, the tier (from 50:
$7.20), the assumptions and the page outline it composed from the rep's request (savings for Acme's 120 people
first) → **Build** → refresh pricing twice → the configurator link.

Request body: [`../examples/req_cloud_backup.json`](../examples/req_cloud_backup.json).

The page leads with "What Acme saves": 120 × $7.20 = $864 / month, $96 less than list ($1,152 a year), "Best
rate reached". Below it the tier table with the slider at 120.

Say: "The catalog is changed by the product manager, not the rep, but without a ticket or a consultant. One
sentence, one Salesforce transaction, Revenue Cloud's rules enforced by code."

## Then

Scenario 01 works from here: the rep can quote Cloud Backup for Acme.

## Reset

`scripts/apex/salescopilot-reset-request.apex` with the build's `requestId` deletes the configuration; refresh
pricing afterwards. It deletes records, so run it only on purpose.
