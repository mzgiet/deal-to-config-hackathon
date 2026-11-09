# Sales Copilot — Written Summary

Team Multi-Framework Builders · Hackathon 2026 · 9 November 2026

## The problem

Deals cool while sales reps wait days for a developer to configure what the client just asked for.

A rep comes out of a client call with a concrete ask: a product at a certain price, 10% off above 500 units, two products sold together. To show the client something real, the rep raises a ticket and waits for someone who knows Salesforce Revenue Cloud to build the products, price book entries and discount tiers. That takes days. By the time the configuration exists, the client's attention has moved on.

The rep already knows what the client wants. What is missing is a way to turn their own words into a working configuration without a developer in the loop.

## What we built

Sales Copilot lets a rep describe the client's request in plain English in Slack and get back a working Revenue Cloud product and price configuration the same day.

What the rep sees:

1. They type `/configure` in Slack. A form opens with example requests and two optional fields: who buys and currency.
2. They paste or type their call notes, as rough as they are, e.g. "liked the Smart Shelf sensors, want it cheaper for big orders, based in Germany".
3. If something important is missing, Claude asks at most three short questions, each pre-filled with its best guess, so the rep can just confirm.
4. A card appears in the channel: products, prices, discount tiers, who can buy, and every assumption Claude made.
5. **Adjust** lets them change it in plain words ("make it 15% above 1000"); the card updates in place.
6. **Build it** creates the configuration in a Salesforce sandbox and posts a link to the configurator in the thread, ready to show the client.

## How it works

Claude handles the language; everything after the rep's approval is deterministic.

| Part | What it does |
| --- | --- |
| Slack app (Node, Bolt, Socket Mode) | Receives `/configure`, shows the forms and the card, acknowledges every action within Slack's 3-second limit |
| Extraction skill | A reusable Claude skill that turns plain English into products, prices, pricing type (flat, volume tiers, bundle) and availability; it never invents a product or a price and records every assumption |
| Strict schema | Claude's answer is validated against a JSON schema, so a number is always a number and the card never shows free text where a price belongs |
| Contract | A small JSON hand-off in business terms (products, tiers, availability, assumptions), independent of Slack |
| Salesforce side | An Apex REST endpoint, called server to server with OAuth client credentials, maps the contract to Product2, PricebookEntry, discount tiers and bundles, and returns the configurator link |

Because no model runs inside Salesforce, the same approved specification always produces the same configuration.

## Who it helps

The rep shows the client a working configuration in the same conversation cycle, and developers stop spending time on demo setups.

- **Sales reps and account executives**: turn a client's ask into something concrete the same day, while the deal is still warm, without learning Salesforce.
- **Pre-sales and solution consultants**: skip repetitive demo configuration and focus on the parts that need real design.
- **Delivery teams**: get requests as a clean, structured specification with the assumptions stated, instead of a vague ticket.

**Reusability.** The extraction skill and the contract do not depend on Slack. The same skill can sit behind Teams, a button in the CRM, or Claude directly, and the same contract can target another Salesforce org or another pricing product. The skill is published in our Context Builder project for other teams to reuse.

## How we used the stack

We used each part of the stack for a distinct job: brainstorming the idea, recording our decisions, keeping our knowledge in one place, and building the product.

| Tool | How we used it |
| --- | --- |
| Brainstorm | Team calls moved the idea from an internal developer tool to a sales-facing one, because helping close deals faster creates more value than saving internal effort |
| Transcribe | Our working session is recorded as a transcript in Context Builder (`Hackathon_Group_Catch-Up.vtt`) |
| Context Builder | Hosts the concept documents, the transcript, the deck text, the reusable skill and the START HERE entry point; the Revenue Cloud documentation loaded there was our reference for the record mapping |
| Claude | Inside the product, Claude extracts the request, asks the questions and applies adjustments; Claude Code was used to build and document the orchestrator |

## Team

| Member | Contribution |
| --- | --- |
| Michał Zgiet (Poland, technical) | Slack orchestrator, Claude integration, extraction skill, contract with the Salesforce side |
| Dawid Rymarzak (Poland, technical) | Salesforce records, Apex endpoint, configurator UI |
| Demi Nicolaou (UK, non-technical) | Reframed the idea around the sales problem, shaped the demo story and presentation, reviewed the extraction skill |
| Amit Dhakre (India, technical) | Testing: wrote the realistic sales-rep inputs we used to test the extraction and tested the end-to-end flow |

## Where to find it

Everything starts from the **START HERE** document in our Context Builder project, *Multi-Framework Builders*.

- **Code:** [github.com/mzgiet/deal-to-config-hackathon](https://github.com/mzgiet/deal-to-config-hackathon); the README explains the flow and how to run it.
- **Reusable skill:** *Sales request extraction*, in Context Builder and in the repo.
- **Productionising note:** in our SharePoint folder, next to this summary, and in [productionising-note.md](productionising-note.md).

What cannot be re-run as is: our Slack workspace is a private demo workspace (a new one takes about 15 minutes with the setup guide in the repo), and the Salesforce sandbox credentials are not shared. Without them, **Build it** runs against a built-in stub, so the Slack flow still works end to end.

All data is fictional; the configuration is built in a sandbox org only.
