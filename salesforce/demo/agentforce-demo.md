# Live demo: Sales Copilot on Agentforce, in Slack (5 minutes)

The presenter types into a Slack DM with **Sales Copilot** and opens the links it returns. Show the Agentforce
agent only. The custom Slack bot exists as well; bring it up only if someone asks.

To prepare, open this repository in Claude Code (or Cursor) and say *"I want to prepare for the demo"*. The
`sales-copilot-agent-testing` skill checks the org, runs safe rehearsals and walks you through this sheet.

## Demo data (the single source of truth)

The skill reads the reserved names and the expected figures from this table. To change the demo:

1. Edit the table.
2. Seed the new customer with `scripts/apex/salescopilot-seed-demo-customer.apex`, after changing the values at
   its top.
3. Update the prompts and figures in the run sheet below. The skill can recompute them from the live catalog.

Org: **`https://power-power-8138-dev-ed.scratch.my.salesforce.com`** (the first PoC org, `flow-dream-5125…`, is
retired for the demo).

| Item | Value | Required state before the demo |
|---|---|---|
| Customer | **Baltic Freight**: Business, 150 employees, 60 Cloud Analytics licences, contract ends 2027-01-15 | Exists, **no quotes** |
| Catalog product (part 1) | **Cloud Backup**: $8 per user per month, 10% off from 50 users | In the catalog, unchanged |
| New product (part 2) | **Fleet Tracking licence**: $15 per vehicle per month, 10% off from 50 vehicles; the customer runs 80 trucks | **Not** in the catalog |
| Part 1 figures | 150 × $7.20 = **$1,080** a month; with 15%: 150 × $6.12 = **$918** a month, saving $282 a month or $3,384 a year | |
| Part 2 figures | 80 × $13.50 = **$1,080** a month, saving $120 a month or $1,440 a year | |

Rehearse with exactly this data, as often as needed, and reset after every run:
`sf apex run -f scripts/apex/salescopilot-reset-demo.apex -o <org>`. The reset deletes the customer's quotes and
opportunities and the demo product's build, keeps the customer and its services, and refreshes pricing. Other
tests do not use these names.

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
| 6 | `Fleet Tracking licence, $15 per vehicle per month, 10% off from 50 vehicles. Baltic Freight runs 80 trucks.` | "Nothing similar in the catalog". Summary: $15/month, 10% from 50, so **$13.50**, Business. For 80 trucks: **$1,080 / month**, saving $120. Asks: build it? |
| 7 | `Build it` | Built. A **configurator page** link and the Salesforce record. Pricing refreshes in the background in about a minute |

Open the **configurator page**: the Fleet Tracking licence card with the tier table, the savings for 80 trucks
($120 a month, $1,440 a year), why it fits Baltic Freight, the assumptions and the request. Its "Open in
Salesforce" button opens the real product record.

If there is time: wait about a minute, then `Quote it for Baltic Freight, 80 vehicles` gives **$1,080 / month**.

## Before going on stage

- [ ] **Org state.** After the last rehearsal, run the reset, then ask the agent to "check the demo data".
      Baltic Freight must have **no quotes**, and **Fleet Tracking licence** must not be in the catalog.
- [ ] **Slack.** Reload with Cmd+R and start a **new DM conversation** with Sales Copilot.
- [ ] **Browser.** Log in to the org, because the page links need a Salesforce session. Zoom to 125%.
- [ ] **LLM quota.** The last rehearsal ends at least **10 minutes** before the slot, because of the
      per-minute quota.
- [ ] **Backup tabs,** in case the network or the quota fails on stage: a customer page and a product page from
      earlier tests (Acme Logistics, Nowak Design).
- [ ] **A DM, not a channel.** In a channel, replies are "only visible to you" until Share is clicked.

## Plan B: the same agent in the Agentforce Builder preview

Use it when the agent does not answer in Slack. It is the same agent, the same seven prompts and the same figures.
Only the window changes: the conversation runs in the Builder's preview panel on the org, where the page links
are clickable.

### When to switch

- **Before the slot:** if the last Slack rehearsal failed, start in the preview and do not mention Slack trouble.
- **On stage:** if message 1 gets no reply in Slack within **45 seconds**, or the reply is an error, say
  *"Let me show you the same agent directly in Salesforce"* and switch to the preview tab. Do not retry in Slack.
  Records an earlier message already created stay; the preview conversation starts again from message 1 (or from
  message 4 if the quote was already created).

### Prepare (in addition to "Before going on stage")

- [ ] **Builder tab.** Setup → Agentforce Agents → Sales Copilot → open in Agentforce Builder, on the version that
      is active. Turn on live actions for the preview (otherwise nothing is created and the links lead nowhere).
- [ ] **Fresh preview.** Restart the preview conversation after the last rehearsal, so it starts empty.
- [ ] **Rehearse once in the preview** with all seven prompts, then reset. Check that both page links open.
- [ ] **Tab order:** Slack DM, Builder preview, an empty tab for the pages, then the backup tabs.
- [ ] **Zoom.** The preview panel is narrow: zoom to 125–150% or collapse the Builder's side panels.

### What to say differently

The run sheet above stays as it is, except:

| Moment | Say instead |
|---|---|
| 0:00–0:30 | "After a call the rep needs an offer the same day. Here it's a conversation with an agent in Salesforce, in plain English." |
| Message 4, "Any channel" | "The agent is one definition in Salesforce. Slack, Teams or a custom bot are connection settings on top of it, and we connected it to Slack. We also built a custom Slack bot on the same Apex." |
| If asked "Why not in Slack?" | "The Slack connection is configured on this agent; today we show it where it runs, so you can see the actions and the records next to it." |

Do not open the trace or the topic configuration unless asked: they take time and pull attention from the pages.

### Plan C: if the preview fails too

Show the backup tabs (a customer page and a product page from earlier tests) and, if one was recorded, the screen
recording of a full rehearsal. Talk through the seven messages from the run sheet over them.

## Questions from the floor (reserves)

| Question | Show |
|---|---|
| "Will it create duplicates?" | `Set up Team Chat licence at $6 per user per month for business customers`: it already exists, so the agent shows it and asks |
| "What if the name differs?" | `Set up Backup Plus at $9 per user per month for businesses`: the agent finds the similar Cloud Backup and asks before creating a second backup product |
| "Can it break the rules?" | `Bundle Fibre Internet and Starter Router for businesses with 10% off the bundle`: bundles cannot carry a discount, and it explains why |
| "Other languages?" | Type the part 1 prompt in another language. The agent replies in that language; the customer page stays in English |
| "Other channels?" | The custom Slack bot (`/quote`, `/configure`) uses the same Apex and the same pages |

## After the demo

Run the reset (`scripts/apex/salescopilot-reset-demo.apex`), and the demo is ready to run again. For a different
customer or product, edit "Demo data", and change the values at the top of the seed and reset scripts.
