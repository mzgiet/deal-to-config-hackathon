# Live demo: Sales Copilot on Agentforce, in Slack (5 minutes)

The presenter types into a Slack DM with **Sales Copilot** and opens the links it returns. Show the Agentforce
agent only. The custom Slack bot exists as well; bring it up only if someone asks.

The reserved demo data is a fresh customer, **Baltic Freight**, and a product that does not exist yet, **Fleet
Tracking licence**. Nobody uses them in tests, so the agent has no earlier quotes to warn about. The
`sales-copilot-agent-testing` skill keeps them untouched.

## Messages to land

1. **Native.** Everything runs on Salesforce: an Agentforce agent, Claude inside the Einstein Trust Layer, Apex
   actions over Revenue Cloud, and the page in a Multi-Framework app. In short: Salesforce × Slack.
2. **Pages are composed on the fly** from template blocks: savings, why it fits, offer, assumptions, the request.
   Each customer gets a different page from the same blocks.
3. **The same blocks can grow** into larger processes: more component templates and specs, assembled in
   Multi-Framework.
4. **Any channel.** It runs in Slack today. The same agent can serve Teams, Claude (Claude in Slack) or a custom
   bot. We built a custom bot too.

## Run sheet

| Time | Do | Say |
|---|---|---|
| 0:00–0:30 | Slack DM open | "After a call the rep needs an offer the same day. Today it's CRM, a price list, a discount sheet, a template, sometimes a ticket for a new product. Here it's a Slack conversation." |
| 0:30–2:15 | **Part 1**, the sales rep (3 messages), then open the customer page | Point at: it read the customer *and* the catalog, priced the volume tier, and the 15% triggers manager approval |
| 2:15–3:45 | **Part 2**, a product the catalog doesn't have (4 messages), then open the product page | "The rep can't sell what doesn't exist. The agent doesn't invent it: it hands off, the product manager sets the price in one sentence, and it's in Revenue Cloud" |
| 3:45–4:30 | Back to Slack, or the architecture slide | Messages 1 and 2 |
| 4:30–5:00 | — | Messages 3 and 4. Close: "Seven sentences in Slack. A priced quote waiting for approval, a new product in the catalog, and two pages nobody designed." |

While the agent thinks (10–30 s per turn), talk through what it is doing. Do not wait in silence.

### Part 1: sales rep

| # | Type | Expect |
|---|---|---|
| 1 | `Baltic Freight wants cloud backup for all their employees. Prepare an offer.` | Cloud Backup × **150**, $8 → 10% volume tier → **$7.20**, **$1,080 / month**. Also: 60 Cloud Analytics licences ending in about 65 days (a renewal conversation), no open quotes, no approval needed |
| 2 | `They're asking for 15% off.` | $7.20 − 15% = **$6.12**, **$918 / month**. 15% is above the 10% limit, so **manager approval** (Needs Review). The tier does not count toward the limit |
| 3 | `Yes, create the quote` | Quote created and Needs Review, $918.00, which matches the proposal. A **customer page** link and the quote link, which Slack shows as a record card |

Open the **customer page** link. It shows, in this order:

- "Composed for this deal · Baltic Freight · 150 users", with the badge "Awaiting manager approval";
- **What Baltic Freight saves**: $918 a month, $282 a month and **$3,384 a year** saved against list;
- **Why it fits**: the whole team, the tier reached, the analytics renewal in 65 days;
- the offer line: 150 × $6.12, with the $8 list price crossed out.

### Part 2: not in the catalog, so the product manager builds it

| # | Type | Expect |
|---|---|---|
| 4 | `They also want fleet tracking for their trucks.` | "Not in the catalog, can't quote it." It offers a ready request to the product manager, with the deal context |
| 5 | `Yes, hand it to the product manager` | It switches to the product manager role and asks for price, billing, tiers and audience |
| 6 | `Fleet Tracking licence, $15 per vehicle per month, 10% off from 50 vehicles. Baltic Freight runs 80 trucks.` | "Nothing similar in the catalog". Summary: $15/month, 10% from 50, so **$13.50**, Business. For 80 trucks: **$1,080 / month**. Asks: build it? |
| 7 | `Build it` | Built. A **configurator page** link and the Salesforce record. Pricing refreshes in the background in about a minute |

Open the **configurator page**: the Fleet Tracking licence card with the tier table, the savings for 80 trucks
($120 a month, $1,440 a year), why it fits Baltic Freight, the assumptions and the request. Its "Open in
Salesforce" button opens the real product record.

If there is time: wait about a minute, then `Quote it for Baltic Freight, 80 vehicles` gives **$1,080 / month**.

## Before going on stage

- [ ] **Org state.** Run `skills/sales-copilot-agent-testing/scripts/org-snapshot.sh` from `salesforce/`.
      Baltic Freight must have **no quotes**, and **Fleet Tracking licence** must not be in the catalog.
- [ ] **Slack.** Reload with Cmd+R and start a **new DM conversation** with Sales Copilot.
- [ ] **Browser.** Log in to the org, because the page links need a Salesforce session. Zoom to 125%.
- [ ] **LLM quota.** The last rehearsal ends at least **10 minutes** before the slot, because of the
      per-minute quota.
- [ ] **Backup tabs,** in case the network or the quota fails on stage: a Cloud Backup customer page and a
      product page from earlier tests (Acme, Nowak Design).
- [ ] **A DM, not a channel.** In a channel, replies are "only visible to you" until Share is clicked.

## Questions from the floor (reserves)

| Question | Show |
|---|---|
| "Will it create duplicates?" | `Set up Team Chat licence at $6 per user per month for business customers`: it already exists, so the agent shows it and asks |
| "What if the words differ?" | `Set up cloud backup ("Backup w chmurze") at $9 per user per month for businesses`: the agent finds the similar Cloud Backup |
| "Can it break the rules?" | `Bundle Fibre Internet and Starter Router for businesses with 10% off the bundle`: bundles cannot carry a discount, and it explains why |
| "Polish?" | `Baltic Freight chce backup w chmurze dla wszystkich pracowników` (Baltic Freight wants cloud backup for all employees). The reply comes in Polish; the page stays in English |
| "Other channels?" | The custom Slack bot (`/quote`, `/configure`) uses the same Apex and the same pages |

## After the demo

Parts 1 and 2 used up the reserved data. To run the demo again:

- delete Baltic Freight's quotes and the Fleet Tracking build (`scripts/apex/salescopilot-reset-request.apex`
  with its requestId); this needs approval because it deletes records;
- or choose a new customer and product name, and update this file and the skill.
