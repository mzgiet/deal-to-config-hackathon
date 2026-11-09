# Slack setup, step by step

About 15 minutes. At the end, `/configure` works end to end against the
built-in stub, with no Salesforce org needed.

## 1. Workspace

1. Go to **https://slack.com/get-started#/createnew**
2. Enter an email and the code you receive
3. Name the workspace, e.g. `Sales Copilot Demo`
4. Skip inviting people (you can add them later at no cost)
5. Create a channel called **`#sales-demo`**

> We use a separate workspace because installing a custom app into a corporate
> Slack needs admin approval. On screen it looks identical.

## 2. Create the app from the manifest

1. Go to **https://api.slack.com/apps**, click **Create New App**, then
   **From a manifest**
2. Pick the workspace from step 1
3. On the **YAML** tab, paste the whole of `manifest.yaml` from this repo,
   then **Next** and **Create**

## 3. App-level token (`xapp-…`) for Socket Mode

1. In the app settings: **Basic Information** → **App-Level Tokens**
2. **Generate Token and Scopes**
   - Token Name: `socket`
   - **Add Scope** → `connections:write`
3. **Generate**, then copy the token starting with `xapp-`

Also check **Settings → Socket Mode**. It should be on (the manifest sets it).

## 4. Install the app and copy the bot token (`xoxb-…`)

1. **Install App** (left menu) → **Install to Workspace** → **Allow**
2. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

> After any scope change in the manifest, click **Reinstall to Workspace**,
> otherwise the new permissions do not apply.

## 5. Appearance (optional, 2 minutes, worth it for a demo)

**Basic Information → Display Information**: add an app icon (512×512).
Without it the bot has a grey default avatar.

## 6. Add the bot to the channel

In Slack, in `#sales-demo`:

```
/invite @Sales Copilot
```

## 7. Run locally

Requires Node ≥ 20.6 (`node -v`).

```bash
cp .env.example .env
```

Fill in `.env` (it is git-ignored):

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
CLAUDE_BIN=/path/to/claude        # only if `claude` is not on your PATH
# ANTHROPIC_API_KEY=sk-ant-...    # use the Anthropic API instead of the CLI
```

Then:

```bash
npm install
npm start
```

The console should show:
`Sales Copilot is listening (Socket Mode). Try /configure in Slack.`

## 8. Test

In `#sales-demo`:

```
/configure
```

Expected:

1. A "Sales Copilot" modal opens. Click the **:memo: Rough call notes**
   example, then **Analyse**
2. Progress steps (✅ / ⏳), then a modal with up to 3 questions, pre-filled
   with Claude's suggestion. Answer and click **Create configuration**
3. A card appears in the channel: products, discounts, who buys, assumptions
4. **Build it**: the card shows "Building…", then a configurator link appears
   in the thread (a placeholder link from the stub unless Salesforce is
   configured)

## Troubleshooting

| Symptom | Cause |
|---|---|
| `/configure failed with the error "dispatch_failed"` | `npm start` is not running, or the `xapp-` token is wrong |
| `/configure` does not appear in suggestions | the app is not installed (step 4) |
| `invalid_auth` in the console | tokens swapped: `xoxb` ↔ `xapp` |
| Modal says "I can't post in this channel" | private channel without the bot: invite it (step 6) |
| Modal says "That didn't work: …" | a problem calling Claude; details in the console. Most often a wrong `CLAUDE_BIN` path |
