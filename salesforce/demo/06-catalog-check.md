# 06 — The catalog check: exists, similar or new

**Role:** anyone who describes a product (not only the product manager) · **Skill:** `sales-copilot-build` ·
**Needs:** Cloud Backup and Business VoIP in the catalog, Email Security not

Before building anything the agent asks Salesforce what the catalog already has (`POST check`, which writes
nothing). There are three answers, and the decision on the first two belongs to the person, not the agent.

| Answer | When | The agent |
|---|---|---|
| `exists` | A product with that exact name is sold | Shows it with price and links, asks: use it, or create a new one under another name |
| `similar` | Names share a significant word ("Backup w chmurze" and "Cloud Backup") | Shows the look-alikes, asks: use one of them, reuse it in a bundle, or create the new one |
| `new` | Nothing alike | Goes straight to the summary and builds after approval |

Every finished build ends on a page with **Open in Salesforce**: the real product (or bundle) record in Revenue
Cloud, where the configuration can be continued by hand.

## Step 1 — something similar exists

```text
Use the sales-copilot-build skill. Set up cloud backup ("Backup w chmurze") at $9 per user per month for businesses.
```

Expected: `status: "similar"`, one match: **Cloud Backup**, $8 / month, Business, shared word "backup", with the
link to its page and to its Salesforce record. A question card: use Cloud Backup / create "Backup w chmurze"
anyway. Pick **use Cloud Backup** → the agent opens the existing page and builds nothing.

Request body: [`../examples/check_backup_similar.json`](../examples/check_backup_similar.json).

Say: "The agent knows the catalog. It does not create a second backup product because somebody worded it
differently; it shows what we have and lets the person decide."

## Step 2 — the exact product exists

```text
Use the sales-copilot-build skill. Business VoIP at $12 per user per month, business customers only.
```

Expected: `status: "exists"` (Business VoIP is already there). The card offers: open the existing offer, quote it
for a customer, or a new product under another name. Nothing is built.

Request body: [`../examples/req_business_voip.json`](../examples/req_business_voip.json).

## Step 3 — nothing like it

```text
Use the sales-copilot-build skill. Email Security at $4 per user per month, business customers.
```

Expected: `status: "new"` → the summary (product, $4 monthly, Business, assumptions) → **Build** → refresh
pricing twice → the configurator page. Click **Open in Salesforce**: the Email Security product record opens in
Lightning.

Say: "From one sentence to a product in Revenue Cloud, and one click from the page to the record itself."

## Reset

Email Security (and Business VoIP, if you want step 2 to say `new` again) is removed with
`scripts/apex/salescopilot-reset-request.apex` and its `requestId`. It deletes records: run it only on purpose,
and refresh pricing afterwards.
