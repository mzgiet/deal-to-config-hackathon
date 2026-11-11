# Agentforce channel

Sales Copilot as an Agentforce Employee Agent that people talk to in Slack. It sits next to the Slack bot in `src/`
and does not replace it. Both channels call the same Apex services, so they validate and build in the same way.

| | Slack bot (`src/`) | Agentforce agent |
|---|---|---|
| Entry | `/quote`, `/configure`, modals | A DM or @mention in plain words |
| Confirming and changing | Cards with Build it, Create quote and Adjust | A question in the thread; changes are typed in the conversation |
| Model | Claude through the API or `claude -p` | Claude Sonnet 4.5, hosted by Salesforce on Bedrock (`model_config`) |
| Logic | `src/` plus the Apex endpoints | Instructions in `Sales_Copilot.agent` plus the same Apex services |
| Runs as | The integration user (client credentials) | The Salesforce user mapped to the person in Slack |

## What is in the repository

| Path | What |
|---|---|
| `salesforce/force-app/main/default/aiAuthoringBundles/Sales_Copilot/Sales_Copilot.agent` | The agent in Agent Script: a router plus two subagents, `quote_customer` (sales rep) and `build_offer` (product manager). It is written from the skills in `salesforce/skills/` |
| `classes/SalesCopilotAgent*.cls` | Invocable actions: Find Customer, Get Catalog, Check Offer, Build Offer, Create Quote. Each one calls the service its REST endpoint calls and returns the endpoint's JSON as `resultJson`, with `status` alongside |
| `classes/SalesCopilotAgentSupport.cls` | Generates `requestId` when the agent leaves it out, and sets `source.channel` to `agentforce` |
| `cspTrustedSites/SalesCopilot*Links` | Trusted URLs, so the agent's replies can include record and page links |
| `permissionsets/SalesCopilotAgentAccess` | Agent Access to Sales Copilot. Users need it to talk to the agent |
| `classes/SalesCopilotPricingRefresh.cls` | Runs after a build: refreshes the `DefaultPricing` decision tables, then once more a minute later. This is the same job as the bot's call to `syncData` |

`sf agent publish` generates `bots/` and `genAiPlannerBundles/` from the `.agent` file. They contain ids specific
to one org, so they are git-ignored.

## Deploy

The org needs the Agentforce platform switched on. It is a settings deploy:
`AgentPlatformSettings.enableAgentPlatform = true`. `BotSettings.enableBots` is not needed.

```bash
cd salesforce
sf project deploy start -o <alias> \
  --source-dir force-app/main/default/classes \
  --test-level RunSpecifiedTests --tests SalesCopilotAgentActionsTest
sf agent validate authoring-bundle -o <alias> --api-name Sales_Copilot
sf agent publish authoring-bundle -o <alias> --api-name Sales_Copilot
sf agent activate -o <alias> --api-name Sales_Copilot --version <n>   # the version publish just created
```

Each publish creates a new, inactive version. Without `--version`, `activate` can quietly leave the old version
active. To see which version is active, run
`SELECT VersionNumber, Status FROM BotVersion WHERE BotDefinition.DeveloperName = 'Sales_Copilot'`.

Deploy the Apex first. Publishing checks that the `apex://` targets exist.

### The user the agent runs as

An Employee Agent acts as the person talking to it, so that person needs the same permission sets as the
integration user. Without them, Create Quote fails with "You don't have access to the place sales transaction
service".

- `CopilotSalesforceUser` ("Access Agentforce Default Agent", needs an Agentforce (Default) licence; the scratch
  org has 3). Probably required for any Employee Agent, but this is not yet confirmed
- `SalesCopilotAgentAccess`: Agent Access to Sales Copilot. Without it, Slack shows "You don't have permission to
  message this app" and the agent cannot be added to a channel
- `SalesCopilotAccess`
- `ProductCatalogManagementAdministrator`
- `CorePricingAdmin`
- `RevLifecycleManagementCalculatePricesApi`
- `RevLifecycleManagementQuotePricesTaxes`
- `RevLifecycleManagementPlaceOrderApi`

### Links in replies

Agentforce removes any URL whose domain is not a Trusted URL and shows `URL_Redacted` in its place. The trace
records this as a `PlatformNotificationStep` with the header "Untrusted URLs Blocked". `cspTrustedSites/` adds
four domains with no CSP directives:

- `*.my.salesforce.com` and `*.my.salesforce.app`;
- the same two domains under `scratch.`, because a wildcard covers only one subdomain level.

In Slack, links on `*.scratch.my.salesforce.com` get through. The configurator's own domain
(`...--c.scratch.my.salesforce.app`) stayed redacted even with its entry on the list. `sf agent preview` redacts
both.

The workaround is `pages/SalesCopilotPage`, a Visualforce page on the org domain:
`/apex/SalesCopilotPage?quoteId=...` (or `?requestId=...`) redirects to the configurator.
`SalesCopilotAgentSupport.result()` rewrites every configurator link in an action result to this form, so the
agent only sees links that Slack shows. The page is not an open redirect: it only forwards to the app's start URL,
with a well-formed id.

`/lightning/app/c__RevenueConfigurator` does not work as a link. It opens the empty Lightning app shell, not the
configurator.

## Test without Slack

A published Employee Agent cannot be previewed by name (`Invalid user ID provided on start session`). Preview
the local bundle instead. It uses the same compiler and runs the real actions:

```bash
SID=$(sf agent preview start -o <alias> --authoring-bundle Sales_Copilot --use-live-actions --json | jq -r .result.sessionId)
sf agent preview send -o <alias> --authoring-bundle Sales_Copilot --session-id "$SID" \
  -u "Acme wants 80 more Cloud Analytics licences, give them 5%"
sf agent preview end -o <alias> --authoring-bundle Sales_Copilot --session-id "$SID"
```

Traces with every action's input and output are saved in `salesforce/.sfdx/agents/Sales_Copilot/sessions/`.

Be careful with `--use-live-actions`: once you say yes in the conversation, the agent really creates quotes and
products. Do not try out the demo scenarios' product names this way, because the demo needs them absent.

## Connect to Slack

These are one-off steps in Setup and in Slack. They need a Salesforce admin and a Slack workspace owner. The exact
labels may differ slightly between releases.

1. **Connect the org to Slack.** In Salesforce, go to Setup, search for "Slack", then Slack Apps or Salesforce for
   Slack, and connect the workspace. A Slack admin approves the request in Slack, and the Salesforce admin
   activates it.
2. **Map users.** Link each Slack user to their Salesforce user. The agent acts as the mapped user, so that user
   needs the permission sets above.
3. **Add Slack to the agent.** This step is already in the source: the `connection slack:` block in
   `Sales_Copilot.agent`, which compiles to a Slack surface. After any change, publish and activate again. Do not
   add the connection in Agentforce Builder, because the org would then drift from the repository.
4. **Install the agent in the workspace.** In Slack, a workspace admin opens Manage Agentforce, then Install
   Agent, picks Sales Copilot and the workspace.
5. **Use it.** Open a DM with Sales Copilot, or @mention it in a channel. It replies in a thread. If the Agents tab
   is missing in Slack, turn on "Show app agents" in Slack preferences.

Not yet confirmed in practice:

- whether a free Slack workspace is enough (Slack's help says all plans);
- whether the Slack Platform Connector package is required first.

Avoid logging in to several Salesforce orgs or Slack workspaces in one browser during step 1, because it breaks
the authorisation.
