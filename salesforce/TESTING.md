# Testing Sales Copilot end to end

A manual for testing everything on the PoC org before the demo: the endpoints from the command line, the Cursor
scenarios, and what the Slack side can use. About 30–40 minutes for the whole run. Fictional data only.

Everything below is already deployed to the PoC scratch org (alias `poc-salescopilot` here, active until
5 December 2026). Commands run from the `salesforce/` folder. If your alias differs, replace `-o poc-salescopilot`.

## 0. Set up (5 min)

```bash
sf org display -o poc-salescopilot            # Status: Active / Connected
sf org open -o poc-salescopilot               # logs the browser in; the configurator pages need that session
```

In Cursor: a **new chat in Agent mode**, with this repository in the workspace so the skills in `skills/` are
found. Allow `sf api request rest` in the Cursor allowlist, or every call waits for a click.

What the catalog holds right now (check with `sf api request rest 'services/apexrest/salescopilot/catalog' -o poc-salescopilot`):

| Product | Price | Audience | Used by |
|---|---|---|---|
| Cloud Backup | $8 / user / month, 10% from 50 | Business | 01–03, 06 step 1 |
| Business VoIP | $12 / user / month | Business | 06 step 2 |
| Cloud Analytics licence | $40 one-time, 2 tiers | Business | Acme's current service |
| Mobile Internet, Router, Internet Bundle, Starter Hardware Kit, Onboarding Service | various | Consumer | 05 |

Customers (from `scripts/apex/salescopilot-seed-customers.apex`): **Acme Logistics** (Business, 120 employees),
**Nowak Design** (Business, 8 employees), **Anna Testowa** (Consumer).

## 1. Endpoints from the command line (10 min)

No AI involved: this checks the Salesforce side on its own. `< /dev/null` keeps the CLI from waiting for input.

### 1a. Catalog check (builds nothing)

```bash
sf api request rest 'services/apexrest/salescopilot/check' --method POST \
  --header 'Content-Type: application/json' --body @examples/check_backup_similar.json \
  -o poc-salescopilot < /dev/null
```

Expect `"status": "similar"` with one match, **Cloud Backup**, `sharedWords: ["backup"]`, `listPrice: 8`, and
two links: `artifactUrl` (its configurator page) and `recordUrl` (the product in Lightning). Open both.

```bash
sf api request rest 'services/apexrest/salescopilot/check' --method POST \
  --header 'Content-Type: application/json' --body @examples/req_business_voip.json \
  -o poc-salescopilot < /dev/null
```

Expect `"status": "exists"`, `match: "same"`, Business VoIP at 12. The same body sent to `build` returns 409.

For `new`, copy any example, change the product name to something unrelated (e.g. "Email Security") and send it
to `check`: `"status": "new"`, `"matches": []`.

### 1b. Build — the record link

Builds create records. Use a fresh `requestId` and a product name the catalog does not have:

```bash
sed -e 's/req_business_voip/req_email_security_test/' -e 's/Business VoIP/Email Security/g' -e 's/12/4/' \
  examples/req_business_voip.json > /tmp/req_email_security_test.json
sf api request rest 'services/apexrest/salescopilot/build' --method POST \
  --header 'Content-Type: application/json' --body @/tmp/req_email_security_test.json \
  -o poc-salescopilot < /dev/null
sf api request rest 'services/data/v66.0/connect/core-pricing/sync/syncData' -o poc-salescopilot < /dev/null   # twice
```

Expect HTTP 200 with `artifactUrl` and `recordUrl`. Open `artifactUrl`: the page shows Email Security at $4 / month
and a yellow **Open in Salesforce** button under the headline; it opens the product record. Send the same body
again: the same two links come back and nothing new is built.

### 1c. Customer and quote

```bash
sf api request rest 'services/apexrest/salescopilot/customer?name=Acme%20Logistics' -o poc-salescopilot < /dev/null
sf api request rest 'services/apexrest/salescopilot/quote' --method POST \
  --header 'Content-Type: application/json' --body @examples/quote_acme_cloud_backup.json \
  -o poc-salescopilot < /dev/null
```

Expect Acme as Business with its services, then a quote of **$864** (120 × $7.20, Draft) with `pageUrl`: the
proposal page composed for Acme. Quotes are records too; they stay on the org.

### 1d. Clean up

`scripts/apex/salescopilot-reset-request.apex`: set `requestId` at the top (e.g. `req_email_security_test`), run
`sf apex run -f scripts/apex/salescopilot-reset-request.apex -o poc-salescopilot`, then syncData. A product that is
on a quote line cannot be deleted; delete those quotes first.

## 2. Cursor scenarios (15 min)

The prompts, expected numbers and talking points are in [`demo/`](demo/README.md). Suggested order:

| Run | Scenario | Checks |
|---|---|---|
| 1 | [01](demo/01-offer-for-acme.md) Offer for Acme | `sales-copilot-sell`: customer + catalog → $864 quote → page for Acme |
| 2 | [02](demo/02-discount-above-limit.md) 15% discount | Needs Review, saving $225.60 / month, page shows "Awaiting manager approval" |
| 3 | [03](demo/03-same-blocks-other-customer.md) Nowak Design | Different page from the same blocks |
| 4 | [06](demo/06-catalog-check.md) Catalog check | `similar` → question card; `exists` → no build; `new` → build → Open in Salesforce |
| 5 | [05](demo/05-bundle-with-catalog-product.md) Bundle | Reuses a catalog product instead of duplicating it |

What to look for in 06: the agent must **ask** before reusing or creating when the check finds something (a
question card in Cursor), and must not ask when the answer is `new`. The final report has both links.

04 needs Cloud Backup removed from the catalog, which breaks 01–03; leave it for last or skip it.

## 3. For Michał: wiring `check` into Slack

Nothing in `src/` changes for the demo: `build` still answers as before, and the 409 path you added keeps working.
`recordUrl` is a new field on the 200 and on each `existingProducts[]` item; ignoring it is fine. If there is time,
two small additions would make the Slack card match the Cursor flow:

1. **An "Open in Salesforce" button** next to "Open configurator" when `session.result.recordUrl` is set
   (`card.js`, `configuratorButton` neighbours). For `exists`, `existingProducts[0].recordUrl` works the same way.
2. **Check before Build it.** Call `check` with the same contract before showing **Build it** (or when it is
   clicked), and put the matches on the card:

```js
const CHECK_PATH = '/services/apexrest/salescopilot/check';

async function checkCatalog(contract) {
  const res = await fetch(`${config.salesforce.domain}${CHECK_PATH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await getSalesforceToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(contract),
  });
  return res.json(); // { status: 'exists' | 'similar' | 'new', matches: [{ name, listPrice, billing, recordUrl, artifactUrl, match }] }
}
```

   - `new` → the card as today.
   - `similar` → a line per match ("Cloud Backup, $8/month — similar") with **Use this** (open `artifactUrl`
     or `recordUrl`) and keep **Build it** as "Create new anyway".
   - `exists` → the same as the current 409 handling, only before the click instead of after.

   The run-as user of the External Client App needs `SalesCopilotAccess`, which already grants the new class and
   field. `check` reads only, so it is safe to call on every card refresh.

## Known gaps

- The similarity check matches words, not meaning: "Kopia zapasowa" is `new` next to "Cloud Backup". The Cursor
  skill tells the agent to read the catalog and judge translations itself.
- Builds made before the button existed have no `recordUrl`; their page shows no button.
- No Apex tests for `check` yet (verified against the org).
