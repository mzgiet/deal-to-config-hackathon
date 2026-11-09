# Sales Copilot — Productionising Note

Team Multi-Framework Builders · Hackathon 2026 · 9 November 2026

## Where it stands today

The end-to-end flow works, but every piece of infrastructure around it is demo-grade.

- **Slack:** a private demo workspace, not the corporate Slack, because a custom app there needs admin approval.
- **Hosting:** one Node process on a developer laptop, connected over Socket Mode.
- **State:** sessions held in memory, lost on restart.
- **Claude:** called through a local Claude Code login or a personal API key.
- **Salesforce:** a sandbox org with one technical integration user; without credentials the build step is a stub.
- **Scope:** flat prices, volume tiers and simple static bundles; one selling model; no subscriptions.

## What production needs

Most of the work is platform and governance, not new features; the core logic carries over unchanged.

| Area | Change | Rough size |
| --- | --- | --- |
| Slack | Install in the corporate workspace with admin approval, or run behind an already approved assistant; restrict to sales channels | S |
| Hosting | Run as a managed service (container or serverless) with health checks, logs and alerting; switch to HTTP events if required by IT | M |
| State | Persist sessions and an audit trail (who asked for what, what was built) in a database | S |
| Claude | Company Anthropic API account with usage limits, prompt and model versioning, and an evaluation set of real-style requests | M |
| Salesforce | One connected app per target org, least-privilege integration user, secrets in a vault, idempotent upserts by request id | M |
| Pricing scope | Selling models and subscriptions, discount per product, explicit bundle structure (contract v2), refresh of pricing decision tables after each build | L |
| Identity | Map the Slack user to a Salesforce user so builds are owned and permissioned per rep | M |
| Cleanup | Expire or archive demo configurations so the org does not fill with one-off products | S |

## Risks and open questions

- **Pricing refresh.** Revenue Cloud prices from decision tables that must be refreshed after data changes; without it the configurator shows the price without the discount. Production needs a reliable refresh step after each build.
- **Client data.** Reps will paste real call notes. Before any use with clients, this needs a data-handling review: what is sent to the model, what is stored, and for how long.
- **Wrong configuration shown to a client.** The card lists every assumption and the rep approves before building, but a pilot should track how often reps adjust or discard, as a quality signal.
- **Clients without Revenue Cloud.** The contract is product-neutral, so the same request could target Salesforce CPQ or another pricing tool; each target needs its own builder.
- **B2B / B2C** has no Revenue Cloud field; it needs an agreed convention (price book, category or custom field).

## Suggested path

Start with an internal pilot on a shared demo org before anything touches a client environment.

1. **Pilot:** a handful of reps in the Salesforce practice use it in the corporate Slack against one shared demo org, with fictional products only.
2. **Harden:** move to a hosted service, persistent storage, company API account and contract v2, based on what the pilot shows.
3. **Extend:** add the targets and pricing models reps actually ask for, such as subscriptions or Salesforce CPQ.

Success for the pilot: a rep goes from call notes to a configurator link in under 10 minutes, and most cards are built without needing more than one adjustment.
