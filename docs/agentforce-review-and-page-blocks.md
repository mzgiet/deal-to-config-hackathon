# Agentforce channel: review notes and an optional proposal for richer pages

**For the Salesforce side.** Optional reading. The demo works without any of this. It covers three things: what the
Agentforce channel added to the Salesforce code (please look before `agentforce-agent` is merged), what testing
turned up in the org, and a proposal for more page blocks, which needs a decision from you.

Background: [agentforce.md](agentforce.md) explains how the agent works, how to deploy it and how to test it.

## 1. Salesforce code added on branch `agentforce-agent`

None of the existing services, endpoints or the configurator were changed. All of these are new files under
`salesforce/force-app/main/default/`.

| What | Why |
|---|---|
| `aiAuthoringBundles/Sales_Copilot/` | The agent, in Agent Script: two subagents ported from `salesforce/skills/`, Claude Sonnet 5.5, connected to Slack |
| `classes/SalesCopilotAgent*.cls` | Five invocable actions: Find Customer, Get Catalog, Check Offer, Build Offer, Create Quote. Each calls the service its REST endpoint calls and returns the same JSON. `requestId` is generated in Apex, and `source.channel` is `agentforce` |
| `classes/SalesCopilotPricingRefresh.cls` + `flows/SalesCopilot_Refresh_Decision_Table` | After an agent build, refreshes the `DefaultPricing` decision tables (two passes, a minute apart). This is the same job as the bot's `syncData` call. It goes through a flow because Apex cannot invoke `refreshDecisionTable` ("isn't a valid action type") |
| `pages/SalesCopilotPage` + `classes/SalesCopilotPageRedirect.cls` | `/apex/SalesCopilotPage?id=<quote or request id>` redirects to the configurator. It only forwards to the app's start URL and only passes a valid id, so it is not an open redirect. See section 2 for why it exists |
| `permissionsets/SalesCopilotAgentAccess` | Agent Access to Sales Copilot, plus the redirect page |
| `cspTrustedSites/SalesCopilot*Links` | Trusted URLs, so record links survive in agent replies. No CSP directives are granted |

Already in `syn-scratch`, all additive:

- `AgentPlatformSettings.enableAgentPlatform = true`;
- assignments for Michał's user and the `test-…@example.com` user: `SalesCopilotAgentAccess`, `CopilotSalesforceUser` (Agentforce licence) and the Revenue Cloud permission sets;
- a throwaway `Probe_Agent`, which can be deleted.

## 2. What testing found

- **Configurator links are redacted in Slack.** Agentforce redacts links on `*.salesforce.app` even when they are
  on the Trusted URL list. Links on the org domain (`*.my.salesforce.com`) get through, hence the redirect page.
  The Einstein Trust Layer also passes the model `<<URL_1>>` instead of the URL and restores it in the reply.
- **Sample data:** the catalog has *Cloud Analytics licence* as one-time, while Acme's asset for it reads as
  $40/month. The agent noticed and pointed out the difference to the rep. Worth aligning.
- **Catalog browser without parameters** (`/app/c__RevenueConfigurator`) showed *0 products across 0 categories*.
  The agent never links there, but it showed up once when the agent shortened a link.
- **Test data in the org from today:**
  - quotes: several draft quotes for Acme (Cloud Backup, Video Conferencing) and Nowak Design (Project Hub),
    plus one for Anna Testowa;
  - products: *Video Conferencing licence*, *Project Hub licence*.

  Because of the duplicate drafts, the agent warns "this may duplicate an existing quote". Your call whether to
  clean these up before the demo.

## 3. Proposal: more page blocks (needs your decision)

Pages built for small, flat offers look thin. For example, 8 users × $12 has no savings block, two or three
highlights and the offer. The agent already uses every block the configurator has (`offer`, `savings`,
`highlights`, `assumptions`, `request`), so more content needs new blocks. These are ranked by value for the
effort:

| Block | Shows | Data from | Page | Agent sends |
|---|---|---|---|---|
| `services` ("Your services with us") | The customer's current services and contract end dates, plus the new line next to them | Account assets, the same data as `GET customer`; the configurator can read them through the quote's account | quote | `"services"` (no text) |
| `nextSteps` | 1–4 steps: what happens after the customer says yes | Written by the agent: for example manager approval when Needs Review, start date, who to contact | both | `{ "type": "nextSteps", "items": [...] }` |
| `included` | What the offer contains: a bundle's required and optional components with prices, or the product description | Bundle structure and `Product2.Description`, which is already stored from `summary` | both | `"included"` |
| `tierLadder` | Every volume tier with the unit and total price at the customer's quantity, and where the customer sits | Price adjustment tiers, already read for the offer card | build (and quote) | `"tierLadder"` |

### What each block needs if you take it

1. **Apex:**
   - add the type to `SalesCopilotConstants.SECTION_TYPES` and `QUOTE_SECTION_TYPES`;
   - teach `Presentation.validate()` its shape: plain string, or `items` with 1–4 entries, each at most N characters.
2. **Configurator:** a component for the block, rendered in the given order like the existing ones.
3. **Our side, which I will do once the shape is agreed:**
   - `src/presentation.js`: `BUILD_SECTIONS` / `QUOTE_SECTIONS`, so the bot can send it;
   - the agent's instructions in `Sales_Copilot.agent`;
   - the two skills in `salesforce/skills/`.

### Questions for you

- Which blocks, if any? My pick would be `services` and `nextSteps`. They use data we already have and make every
  page look made for that customer.
- Are the names and shapes above fine, or do you prefer other ones?
- Before or after the demo? The current pages work as they are, so this can wait.

## Try it

Slack: Michał's workspace, DM *Sales Copilot*. Start a new conversation for each test.

```text
Acme wants cloud backup for all their employees. Prepare an offer.
The customer wants 15%
Yes, create the quote
```

```text
Nowak Design wants a project management tool for their whole team. Prepare an offer.
Yes, hand it to the product manager
<product name>, $<price> per user per month
Build it
```

Without Slack, `sf agent preview` works too (see [agentforce.md](agentforce.md), "Test without Slack"). Write
actions run for real there, so do not reuse the demo product names.
