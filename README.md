# n8n Personal Finance Automation Bundle
### Actual Budget Edition — v1.0

---

> **Built and maintained by a real person running this stack daily.**
> If something's broken or confusing, post in the Gumroad comments. I respond within 48 hours.

---

## What's in This Bundle

| File | Description |
|---|---|
| `00 🔍 Actual Budget - Discovery (Run Once).json` | **Run first.** Fetches all your account/category IDs |
| `01 📅 Sunday Financial Briefing.json` | Weekly AI-generated budget summary via Telegram |
| `02 💸 Monthly Auto-Fund Envelopes.json` | Auto-funds your budget categories on the 1st of each month |
| `03 🏷️ AI Transaction Categorizer.json` | Three-tier AI categorizer that learns your spending patterns |
| `04 💵 Friday Paycheck Summary.json` | Weekly paycheck detection + month-to-date budget snapshot |
| `05 🔄 Monthly Rule Digest.json` | Monthly analysis of categorization patterns, logged to Notion |
| `actual-template.zip` | Actual Budget budget template (import-ready) |
| `BRIDGE_SETUP.md` | SimpleFIN bridge setup guide (Docker Compose) |
| `README.md` | This file |

---

## Prerequisites

Before importing anything, make sure you have all of these running:

### Required
- **n8n** — self-hosted (Docker recommended) or n8n Cloud
  - Minimum version: `1.0`
  - [Install guide → n8n.io/docs](https://docs.n8n.io/hosting/)
- **Actual Budget** — self-hosted or Actual Budget Cloud
  - HTTP API must be enabled (default in self-hosted)
  - Note your **sync ID** and **server URL** — you'll need both
  - [Actual Budget docs](https://actualbudget.org/docs/)
- **SimpleFIN Bridge + actual-auto-sync** — for automatic bank transaction sync
  - ~$15/year for SimpleFIN, connects most US banks
  - **Full setup → see `BRIDGE_SETUP.md` in this bundle**
  - Without this running, workflows will see no new transactions

### Required for AI workflows (01, 03, 05)
- **Anthropic API account** — pay-per-use, ~$0.01 per 100 transactions
  - [console.anthropic.com](https://console.anthropic.com)

### Optional — Notion (Workflow 05 logging only)
- **Notion account + API key** — free, but not required
  - [notion.so/my-integrations](https://www.notion.so/my-integrations)
  - Only needed if you want rule suggestions logged to a Notion database
  - If you skip this, Workflow 05 still runs and sends its digest via Telegram — the Notion logging nodes are simply bypassed
  - See [Removing Notion from Workflow 05](#removing-notion-from-workflow-05) for setup-free instructions

### Optional (for notifications)
- **Telegram Bot** — free, takes 5 minutes via @BotFather
  - You need: Bot Token + your personal Chat ID

---

## Setup Overview

Complete these steps in order.

1. [Configure n8n credentials](#step-1-configure-n8n-credentials)
2. [Set up the SimpleFIN bridge](#step-2-set-up-the-simplefin-bridge)
3. [Import the Actual Budget template](#step-3-import-the-actual-budget-template)
4. [Import workflows](#step-4-import-workflows)
5. [Run Workflow 00 — Discovery](#step-5-run-workflow-00--discovery) ← do this before configuring anything else
6. [Configure each workflow](#step-6-configure-each-workflow)
7. [Test and activate](#step-7-test-and-activate)

---

## Step 1: Configure n8n Credentials

In n8n → **Settings → Credentials**, create the following. To name a credential, click the name at the top of the credential dialog — it's editable inline.

> **Already have Anthropic or Notion credentials?** Reuse them. When importing a workflow, n8n will prompt you to select a credential for each node — pick your existing one from the dropdown. No need to create duplicates.

---

### Actual Budget Bridge
The only service without an n8n native credential type. Use Custom Auth.

- Type: `Custom Auth`
- Name: `Actual Budget Bridge`
- JSON:
```json
{
  "headers": {
    "x-bridge-key": "YOUR_BRIDGE_KEY"
  }
}
```

---

### Anthropic API (Workflows 01, 03, 05)
n8n has a native Anthropic credential type — use it, not Custom Auth.

- Type: `Anthropic`
- Name: `Anthropic API`
- Field: API Key → your `sk-ant-api03-...` key

Get your key at: [console.anthropic.com](https://console.anthropic.com)

> **Using OpenRouter instead of Anthropic?** See [Swapping AI Providers](#swapping-ai-providers). You will use a Custom Auth credential and will need to rewire the Ask Claude nodes.

---

### Notion API (Workflow 05 only)
n8n has a native Notion credential type — use it, not Custom Auth.

- Type: `Notion API`
- Name: `Notion API`
- Field: Internal Integration Secret → your `ntn_...` key

Get your key at: [notion.so/my-integrations](https://www.notion.so/my-integrations)

---

### Telegram Bot (all workflows)
n8n has a native Telegram credential type — use it.

- Type: `Telegram API`
- Name: `Telegram Bot`
- Field: Access Token → your bot token from @BotFather

---

## Step 2: Set up the SimpleFIN Bridge

See **`BRIDGE_SETUP.md`** for the complete Docker Compose setup.

The bridge must be running before any workflow will see your transactions. The n8n workflows communicate with Actual Budget on port 5006 — the bridge runs separately and keeps Actual Budget populated.

---

## Step 3: Import the Actual Budget Template

The included `actual-template.zip` has a generic budget structure with common category groups. Import it as a starting point, then adjust categories to match your actual spending.

**To import:** Actual Budget → File → Import budget → select `actual-template.zip`

> You don't have to use this template. The workflows work with any Actual Budget setup. The template just gets you started faster.

---

## Step 4: Import Workflows

In n8n → **Workflows → Add Workflow → Import from file**

Import each `.json` file. **Do not activate any workflow yet** — configure first, test second, activate last.

---

## Step 5: Run Workflow 00 — Discovery

**Do this before touching any other Config node.** Every workflow needs account and category IDs specific to your Actual Budget instance.

Open Workflow 00 and edit the **Config** node — fill in only these two values:

```javascript
bridgeUrl: 'http://actual-bridge:3788',  // your Actual Budget bridge URL
bridgeKey: 'REPLACE_WITH_YOUR_BRIDGE_KEY',
```

Click **Test workflow**. The output shows a formatted table of every account and category in your budget, with their IDs. Keep this open — you'll reference it constantly in the next step.

---

## Step 6: Configure Each Workflow

Every workflow has a single **Config** node at the top. Edit only that node. All other nodes pull values from it automatically.

### Workflow 01 — Sunday Financial Briefing

Runs every Sunday at 7pm. Sends an AI-generated budget summary to Telegram.

```javascript
bridgeUrl:        'http://actual-bridge:3788',
bridgeKey:        'REPLACE_WITH_YOUR_BRIDGE_KEY',
anthropicApiKey:  'REPLACE_WITH_YOUR_ANTHROPIC_API_KEY',
telegramBotToken: 'REPLACE_WITH_YOUR_TELEGRAM_BOT_TOKEN',
telegramChatId:   'REPLACE_WITH_YOUR_TELEGRAM_CHAT_ID',
```

No other configuration required.

---

### Workflow 02 — Monthly Auto-Fund Envelopes

Runs on the 1st of each month at 6am. Automatically funds your Actual Budget categories based on your `fundingTemplate`.

Key values to set in the Config node:

```javascript
monthlyIncome: 0,  // your expected monthly net (take-home) income
```

Then fill in the `fundingTemplate` array. For each category:
- Copy the `categoryId` from your Workflow 00 output
- Set the `amount` to your monthly budget for that category
- Use `type: 'fixed'` for set amounts, `type: 'remainder'` for your debt attack / overflow category

The template ships with placeholder entries covering the most common budget categories. Delete any that don't apply to you and add any that are missing.

---

### Workflow 03 — AI Transaction Categorizer

Runs every 4 hours. Fetches uncategorized transactions and uses Claude to categorize them automatically.

**Confidence tiers:**
- `AUTO_APPLY_THRESHOLD` (default 0.85) — applies the category automatically
- `AUTO_RULE_THRESHOLD` (default 0.95) — applies AND creates a permanent payee rule in Actual Budget (that payee is never sent to Claude again)
- Below `AUTO_APPLY_THRESHOLD` — sends a Telegram alert for manual review

**Fill in the categories array** using your Workflow 00 output. Each entry:
```javascript
{ id: 'GET_FROM_WF00', name: 'Groceries supermarket warehouse club' },
```
- `id`: the category ID from Discovery
- `name`: a descriptive label sent to Claude — the more descriptive, the more accurate

The template ships with ~28 common categories. Adjust to match your actual budget.

---

### Workflow 04 — Friday Paycheck Summary

Runs every Friday at 6pm. Checks for a paycheck deposit and sends a budget snapshot.

```javascript
checkingAccountId: 'GET_FROM_WF00',  // your primary checking account ID
expectedPaycheck:  0,     // your typical net paycheck amount
paycheckTolerance: 200,   // wiggle room in dollars (covers tax/benefit changes)
```

If no deposit matching `expectedPaycheck ± paycheckTolerance` is found, the message will note that no paycheck was detected so you can check manually.

---

### Workflow 05 — Monthly Rule Digest

Runs on the 1st of each month at 7pm. Analyzes 60 days of transactions, uses Claude to spot categorization patterns, and sends a digest via Telegram. By default it also logs suggestions to a Notion database — but Notion is optional. See [Removing Notion from Workflow 05](#removing-notion-from-workflow-05) if you don't use it.

```javascript
anthropicApiKey:  'REPLACE_WITH_YOUR_ANTHROPIC_API_KEY',
notionApiKey:     'REPLACE_WITH_YOUR_NOTION_API_KEY',   // leave blank if not using Notion
notionDatabaseId: 'REPLACE_WITH_YOUR_NOTION_RULES_DB_ID', // leave blank if not using Notion
```

**Notion database setup (skip if not using Notion):**
Create a database in Notion with these properties:
| Property | Type |
|---|---|
| Name | Title |
| Suggestion | Text |
| Month | Text |
| Status | Select (New / Applied / Dismissed) |

Share the database with your Notion integration, then copy the database ID into `notionDatabaseId`.

Fill in `accountIds` with your on-budget account IDs from Workflow 00 (checking + all credit cards you track in Actual).

---

## Step 7: Test and Activate

Test in this order — manual trigger each one before activating:

| # | Workflow | What to verify |
|---|---|---|
| 00 | Discovery | Output shows your accounts and categories with IDs |
| 03 | Categorizer | Uncategorized transactions get categories applied |
| 01 | Briefing | Telegram message arrives with budget summary |
| 02 | Auto-Fund | Categories get funded (run on a test basis — check Actual after) |
| 04 | Paycheck | Message arrives; paycheck detected if a deposit exists this week |
| 05 | Rule Digest | Notion entry created; Telegram message sent |

Once a workflow tests successfully, toggle it **Active**. The schedule takes over from there.

---

## Removing Notion from Workflow 05

If you don't use Notion, two options depending on how much you want to simplify.

### Option A — Skip the credential, disable the nodes (5 minutes)

This is the quickest path. The Telegram digest still runs in full — you just won't get Notion logging.

1. Import Workflow 05 as normal
2. When n8n prompts you to select a credential for the Notion nodes, click **Skip** or select any placeholder
3. In the workflow canvas, find these two nodes and **disable** each one (right-click → Disable):
   - `Get Rules Memory`
   - `Create Notion Entry`
4. The workflow will route around them automatically via the existing `If` node

No code changes needed. The Telegram digest runs exactly as before.

---

### Option B — Remove the Notion nodes entirely (10 minutes)

Cleaner if you want no Notion references at all.

1. Import Workflow 05
2. Delete these nodes from the canvas:
   - `Get Rules Memory`
   - `Create Notion Entry`
3. Rewire the connections:
   - Connect `Detect Patterns` → `Ask Claude` (was previously connected through `Get Rules Memory`)
   - Connect `Parse Suggestions` → `Build Telegram Digest` (was previously connected through `Create Notion Entry`)
4. Delete the `Notion API` credential reference from the workflow (it will show as unlinked after node deletion)

The workflow now runs: fetch transactions → detect patterns → ask Claude → build digest → send Telegram. No Notion dependency anywhere.

---

### Option C — Replace Notion with a local log (for advanced users)

If you want to keep a record of rule suggestions but not in Notion, swap the `Create Notion Entry` node for one of these:

- **Google Sheets** — replace with a Google Sheets append row node
- **Airtable** — replace with an Airtable create record node  
- **Plain text file** — replace with a Write Binary File node logging to a mounted volume
- **n8n static data** — store suggestions in n8n's built-in key-value store (no external service needed)

All of these are standard n8n nodes. The only change is the destination node — the data shape coming out of `Parse Suggestions` stays the same.

---

## Swapping AI Providers

The workflows ship configured for Anthropic Claude (`claude-haiku-4-5` by default — fast and cheap). If you prefer OpenAI, Gemini, or want to use OpenRouter to switch models freely, here's what changes.

### Option 1 — OpenRouter (recommended for flexibility)

OpenRouter gives you access to Claude, GPT-4o, Gemini, Mistral, and others through a single API key. You switch models by changing one line in each Config node — no node rewiring needed.

**Credential:** Create the OpenRouter Custom Auth credential as shown in Step 1.

**Config node change** — in Workflows 01, 03, and 05, find this line in the Config node and update it:

```javascript
// Change this:
anthropicApiKey: 'REPLACE_WITH_YOUR_ANTHROPIC_API_KEY',

// To this — set your preferred model:
openRouterModel: 'anthropic/claude-haiku-4-5',  // or 'openai/gpt-4o-mini', 'google/gemini-flash-1.5'
```

**Ask Claude node change** — in each AI workflow, find the `Ask Claude` node and update:
- URL: change `https://api.anthropic.com/v1/messages` → `https://openrouter.ai/api/v1/chat/completions`
- Body: OpenRouter uses OpenAI's message format (`{"model": "...", "messages": [...]}`) rather than Anthropic's format

> **Honest note:** Swapping from Anthropic to OpenRouter requires a body format change in 3 nodes across 3 workflows. It's about 20 minutes of work. If you're comfortable with n8n, it's straightforward — if not, stick with Anthropic or reach out in the Gumroad comments.

### Option 2 — OpenAI directly

Same as OpenRouter but:
- URL: `https://api.openai.com/v1/chat/completions`
- Credential header: `Authorization: Bearer sk-...`
- Body format: OpenAI chat completions format

### Option 3 — Stay with Anthropic, change the model

The cheapest path. In the Config node of Workflows 01, 03, 05 — the model is set in the `Ask Claude` node body. Common swaps:

| Model | Speed | Cost | Best for |
|---|---|---|---|
| `claude-haiku-4-5` | Fastest | ~$0.01/100 tx | Categorization (default) |
| `claude-sonnet-4-5` | Balanced | ~$0.15/100 tx | Briefing summaries |
| `claude-opus-4-5` | Slowest | ~$0.75/100 tx | Not needed for this use case |

---

## Known Limitations & Caveats

Read this before you start. These are not bugs — they are by-design constraints you should understand upfront.

### This is not a plug-and-play app
Setup requires comfort with n8n, Docker, reading error logs, and copying IDs between tools. The README is thorough but it assumes you're the kind of person who runs a self-hosted stack. If you've never used n8n before, budget a few hours for the learning curve.

### Actual Budget version compatibility
These workflows are tested against Actual Budget 24.x and the `actual-auto-sync` bridge. The bridge API changes occasionally between major versions. If you're on a significantly older or newer version and something breaks, check the comments — I'll post fixes there.

### Bridge container name
Every Config node uses `bridgeUrl: 'http://actual-bridge:3788'`. The hostname `actual-bridge` must match your Docker container name exactly. If you named your container something different, update `bridgeUrl` in every Config node before testing.

### Importing updated workflows
When you import a new version of a workflow into an existing n8n instance, **delete the old workflow first** before importing the replacement. If you import alongside an existing one, n8n renames conflicting node names with a number suffix (e.g. `Config + Funding Template1`), which silently breaks all expressions that reference that node by name.

### n8n Cloud execution limits
If you're on n8n Cloud, be aware that some plans have execution time limits. Workflow 02 (Auto-Fund) loops over every category in your funding template — if your template is large, it may approach those limits. Self-hosted has no such constraint.

### Workflow 02 runs on the 1st regardless of income timing
The Auto-Fund workflow fires on the 1st of each month at 6am. It funds categories from whatever balance is available at that moment. If your paycheck lands after the 1st, the funding runs against your existing balance — which may be fine or may cause issues depending on how you manage cash flow. Adjust the schedule in the trigger node if needed.

### Workflow 03 may flag everything on first run
The AI Categorizer has no learned rules on first run. It will flag most transactions for manual review — that's normal. After 2–3 weeks of normal use, it builds enough rules that 90%+ categorize automatically. Don't judge the workflow by the first run.

### Workflow 03 runs every 4 hours — empty runs are normal
If Actual Budget hasn't synced new transactions since the last run, the workflow processes zero transactions and exits cleanly. That's not an error.

### AI categorization accuracy depends on your category names
The AI receives your category names as context. Vague names like "Misc" or "Other" will get mis-categorized more often than descriptive names like "Restaurants fast food coffee delivery". Take 10 minutes to write good category names in your Config node — it pays off.

### Workflow 05 Notion logging is optional — but no other tools are officially supported
Workflow 05 can log rule suggestions to Notion. If you don't use Notion, disable or remove those two nodes and the Telegram digest runs exactly as before — see [Removing Notion from Workflow 05](#removing-notion-from-workflow-05). If you want to log to a different tool (Joplin, AppFlowy, Airtable, a local file, etc.), you can swap the Notion nodes for any n8n-compatible node — but that customization is outside the scope of this bundle and support. The data shape coming out of `Parse Suggestions` is well-documented in the README and straightforward to redirect.

### n8n Cloud vs self-hosted Telegram behavior
On some n8n versions, the native Telegram node behaves slightly differently between cloud and self-hosted. If Telegram messages aren't arriving, check that your bot has been started (send it `/start`) and that the chat ID in your Config node is your personal user ID, not the bot's ID.

---

## Troubleshooting

### "Cannot connect to Actual Budget bridge"
- Confirm `bridgeUrl` matches your container name exactly — `actual-bridge` is the default
- Both n8n and the bridge must be on the same Docker network
- Check the bridge is running: `docker logs actual-auto-sync`
- If using an IP address instead of container name, confirm port 3788 is accessible from the n8n container

### No transactions appearing
- Confirm SimpleFIN bridge has synced at least once: `docker logs actual-auto-sync`
- Check your bank accounts are connected in SimpleFIN's dashboard
- New bank connections can take 24–48 hours to populate
- Manually trigger a sync in Actual Budget to confirm the bridge is working

### "Bad Request: chat not found" from Telegram
- Your chat ID is wrong or missing in the Config node
- Message `@userinfobot` on Telegram to get your correct chat ID
- Make sure you've sent your bot at least one message (`/start`) before it can message you

### "Bad Request: chat_id is empty" from Telegram
- `telegramChatId` in the Config node is blank or still set to the placeholder value
- If you imported a new workflow version over an old one without deleting first, check for renamed nodes — see [Known Limitations](#importing-updated-workflows) above

### AI categorization is consistently wrong
- Make category `name` values more descriptive in the Config node
- Lower `AUTO_APPLY_THRESHOLD` to 0.75 to build rules faster
- Raise it to 0.90+ if you prefer more manual review and higher accuracy

### Workflow 05 Notion entries not appearing
- Confirm you didn't disable or remove the Notion nodes — see [Removing Notion from Workflow 05](#removing-notion-from-workflow-05)
- Confirm your Notion integration has access to the database (Share → Invite integration)
- Check the database ID is the 32-character hex string with no dashes
- The Telegram digest still arrives even if Notion logging fails — check the `If` node output to see which path executed

### Workflow runs fine manually but fails on schedule
- Check that the workflow is set to Active (toggle in top-right of the workflow editor)
- Verify the schedule trigger shows a valid next run time
- On n8n Cloud, check your execution quota hasn't been exhausted for the month

---

## Getting Updates

When updates are released, you'll receive a Gumroad download notification.

**To update a workflow — do this in order:**
1. Note your current Config node values (screenshot or copy to a text file)
2. Deactivate the existing workflow in n8n
3. **Delete the old workflow** — do not import alongside it (see [Known Limitations](#importing-updated-workflows))
4. Import the new JSON
5. Re-enter your Config values
6. Test with manual trigger
7. Re-activate

Your data in Actual Budget is never affected by workflow updates.

---

## License

Single-user license. You may use and modify these workflows for personal use.
Redistribution, resale, or repackaging — in original or modified form — is prohibited.
© 2026. All rights reserved.

---

*n8n Personal Finance Automation Bundle v1.0*
*Compatible with: n8n 1.x, Actual Budget 24.x+*
