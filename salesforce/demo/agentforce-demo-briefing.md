# Demo briefing: run this with your coding agent

> **For the presenter:** open this repository in Claude Code (or Cursor), pull `main`, and say:
> *"Read salesforce/demo/agentforce-demo-briefing.md and run it."*
> In about 15 minutes you get a summary, the demo variants to choose from, a rehearsal in Slack, and a stage card.

---

## Instructions for the agent

You are briefing the presenter of a **5-minute live demo** of Sales Copilot, an Agentforce agent in Slack that
turns a sales request into Revenue Cloud quotes and products. The presenter is busy:

- write in their language and keep every message to one screen;
- lead with what they need to decide or do;
- never paste whole files at them; this briefing and the files it points to are your reference.

Use the `sales-copilot-agent-testing` skill (`salesforce/skills/sales-copilot-agent-testing/SKILL.md`) for every
org operation: finding the org alias, the snapshot, dry runs, trace reading and the reset. Its rules apply. Above
all: **ask before the reset**, because it deletes records, and never touch any org but the PoC scratch org.

### Step 1: check the ground (silently, then report in 3 lines)

1. Pull `main`. Find the org alias (skill, step 0).
2. Run the snapshot and check the "Demo data" table in `salesforce/demo/agentforce-demo.md`:
   - Baltic Freight exists and has no quotes;
   - Cloud Backup is $8 with 10% off from 50;
   - Fleet Tracking licence is absent.
3. Check that the active agent version matches the repository.

Report: **ready**, or **what is off and the fix you propose**. Offer the reset if a rehearsal left data behind.

### Step 2: the briefing (one screen)

Tell the presenter, in this order:

**What we show:** a sales rep types plain English in a Slack DM. The agent reads the customer and the
catalog, prices the deal with volume tiers and discount rules, creates a real Revenue Cloud quote (with manager
approval when needed), and returns a page composed for that customer. When the catalog lacks the product, it hands
off to the product manager role, which builds the product in Revenue Cloud from one sentence.

**How it works,** for the "how" questions:

- Slack → an Agentforce Employee Agent (Agent Script; Claude Sonnet 5.5 hosted by Salesforce inside the Einstein
  Trust Layer).
- The agent calls Apex invocable actions, which wrap the same deterministic Apex services the rest of the project
  uses.
- The services work in Revenue Cloud: products, price book, volume tiers, quotes, the pricing procedure, approval.
- A Multi-Framework React app (UI Bundle) renders the page from the blocks the agent picked.
- Everything is native Salesforce. All customer data is fictional.

**The four messages to land**, as agreed in the team:

1. Native: Salesforce × Slack, nothing hosted outside.
2. Pages are composed on the fly from template blocks: a different page per customer from the same blocks.
3. The blocks can grow into larger processes: more component templates and specs, assembled in Multi-Framework.
4. Any channel: Slack today (what matters most to the audience), and Teams, Claude or a custom bot as well. We
   built a custom Slack bot too; mention it only if asked.

### Step 3: the variants. Ask which one, and what to change

Present this table, adding your recommendation and one line on the risk of each:

| Variant | Messages | Live time | Shows | Risk |
|---|---|---|---|---|
| **A. Full story** (the run sheet) | 7 | ~3:15 | Both roles: a quote with approval, then hand-off, a new product and a second page | Tightest on time; 7 agent turns at 10–30 s each |
| **B. Sales rep only** | 3 (+1) | ~1:45 | Part 1: tier, 15% → approval, customer page. Optional `Make it 10% instead` shows "no approval needed" | Lowest; leaves time for the architecture and questions |
| **C. Product manager only** | 2–3 | ~1:30 | `Set up Fleet Tracking licence, $15 per vehicle per month, 10% off from 50 vehicles, business customers. Baltic Freight runs 80 trucks.` → `Build it` → product page; then `Set up Team Chat licence at $6…` shows that it knows the catalog | Medium; less "sales" story |
| **D. A + quote of the new product** | 8 | ~4:15 | Closes the loop: after about a minute, `Quote it for Baltic Freight, 80 vehicles` gives $1,080 | Needs the 1-minute pricing refresh; only with spare time |
| **Reserves** (questions) | 1 each | ~0:30 | Duplicates (Team Chat), a similar name (Backup Plus), a bundle discount refused, another language | None; read-only |

Then ask, in one message:

- **Which variant?** Recommend A when the slot really is 5 minutes with no other speaker, otherwise B.
- **Change anything?** The customer or the product (we can seed new ones), the prompts, what to emphasise, or
  who types while who talks.

### Step 4: apply the changes

- **Different data:** edit "Demo data" in `salesforce/demo/agentforce-demo.md` and the values at the top of the
  seed and reset scripts, then seed. Recompute the figures with the skill's pricing rules.
- **Different prompts or variant:** update the run sheet.
- **Before any Slack rehearsal:** check the new figures with a dry run in preview (skill, step 3).
- **Behaviour changes in the agent** (wording, page composition): edit `Sales_Copilot.agent`, try it in
  preview, then publish and activate the new version (skill, "Change the agent"). Tell the presenter to start a
  new Slack conversation afterwards.

### Step 5: rehearse in Slack, then reset

1. Give the prompts one at a time, in copy-paste blocks, each followed by a single "you should see" line with
   the key figure.
2. Ask the presenter to paste the replies, or a screenshot, after each turn, and confirm or flag the
   differences.
3. After the last prompt, ask for screenshots of the pages and check them against the run sheet.
4. Ask before resetting, then run `scripts/apex/salescopilot-reset-demo.apex` and confirm the snapshot is clean
   again.

Repeat if they want another round. The last round should end at least 10 minutes before the slot.

### Step 6: the stage card

Finish with a compact card the presenter keeps open on a second screen. Keep it under 25 lines:

- the chosen prompts, numbered, each with its key figure;
- the line to say during each wait;
- the four messages;
- the three-item pre-stage checklist: reset done and snapshot clean, Slack reloaded with a new DM, browser
  logged in to the org.

## Things that will happen on stage (tell the presenter in advance)

| Symptom | What it is / what to do |
|---|---|
| 10–30 s per reply | Normal: several model calls plus Apex. Talk through what the agent is doing |
| A reply says "Only visible to you" | You are in a channel. Use the DM |
| A `\` at the end of a link | Cosmetic; the link still works |
| Links go to `…/apex/SalesCopilotPage?id=…` | On purpose: Agentforce strips links on the app's own domain in Slack, so the link goes through a redirect page on the org domain |
| "Live Chat support is currently unavailable" or "something went wrong" | The per-minute LLM quota. Wait a minute and send the message again |
| "You don't have permission to message this app" | Slack lost the agent access after a version change. Deactivate and activate the agent (skill, "Change the agent"), then reload Slack |
| A newly built product cannot be quoted right away | Pricing refreshes in the background for about a minute |
| The agent warns about duplicate quotes | The customer has quotes from a rehearsal. Reset before the demo |

## Reference

- Run sheet, demo data and reserves: `salesforce/demo/agentforce-demo.md`
- Testing and rehearsal skill: `salesforce/skills/sales-copilot-agent-testing/SKILL.md`
- How the agent works (deploy, permissions, models, links): `docs/agentforce.md`
- What changed on the Salesforce side, and the optional page-block proposal: `docs/agentforce-review-and-page-blocks.md`
