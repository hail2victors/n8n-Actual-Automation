# n8n Personal Finance Automation Bundle
### Actual Budget Edition — v1.0

> **Built and maintained by a real person running this stack daily.**
> If something's broken or confusing, [open an issue](../../issues) — I respond within 48 hours.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-☕-yellow)](https://ko-fi.com/hail2victors)

---

## What's in This Repo

| File | Description |
|---|---|
| `workflows/00 🔍 Actual Budget - Discovery (Run Once).json` | **Run first.** Fetches all your account/category IDs |
| `workflows/01 📅 Sunday Financial Briefing.json` | Weekly AI-generated budget summary via Telegram |
| `workflows/02 💸 Monthly Auto-Fund Envelopes.json` | Auto-funds your budget categories on the 1st of each month |
| `workflows/03 🏷️ AI Transaction Categorizer.json` | Three-tier AI categorizer that learns your spending patterns |
| `workflows/04 💵 Friday Paycheck Summary.json` | Weekly paycheck detection + month-to-date budget snapshot |
| `workflows/05 🔄 Monthly Rule Digest.json` | Monthly analysis of categorization patterns, logged to Notion |
| `BRIDGE_SETUP.md` | SimpleFIN bridge setup guide (Docker Compose) |

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
  - **Full setup → see `BRIDGE_SETUP.md`**
  - Without this running, workflows will see no new transactions

### Required for AI workflows (01, 03, 05)
- **Anthropic API account** — pay-per-use, ~$0.01 per 100 transactions
  - [console.anthropic.com](https://console.anthropic.com)

### Optional — Notion (Workflow 05 logging only)
- **Notion account + API key** — free, but not required
  - [notion.so/my-integrations](https://www.notion.so/my-integrations)
  - Only needed if you want rule suggestions logged to a Notion database
  - If you skip this, Workflow 05 still runs and sends its digest via Telegram
  - See [Removing Notion from Workflow 05](#removing-notion-from-workflow-05)

### Optional (for notifications)
- **Telegram Bot** — free, takes 5 minutes via @BotFather
  - You need: Bot Token + your personal Chat ID

---

## Setup Overview

Complete these steps in order.

1. [Configure n8n credentials](#step-1-configure-n8n-credentials)
2. [Set up the SimpleFIN bridge](#step-2-set-up-the-simplefin-bridge)
3. [Import workflows](#step-3-import-workflows)
4. [Run Workflow 00 — Discovery](#step-4-run-workflow-00--discovery) ← do this before configuring anything else
5. [Configure each workflow](#step-5-configure-each-workflow)
6. [Test and activate](#step-6-test-and-activate)

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

> **Using OpenRouter instead of Anthropic?** See [Swapping AI Providers](#swapping-ai-providers).

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

## Step 3: Import Workflows

In n8n → **Workflows → Add Workflow → Import from file**

Import each `.json` file from the `workflows/` folder. **Do not activate any workflow yet** — configure first, test second, activate last.

---

## Step 4: Run Workflow 00 — Discovery

**Do this before touching any other Config node.** Every workflow needs account and category IDs specific to your Actual Budget instance.

Open Workflow 00 and edit the **Config** node — fill in only these two values:

```javascript
bridgeUrl: 'http://actual-bridge:3788',  // your Actual Budget bridge URL
bridgeKey: 'REPLACE_WITH_YOUR_BRIDGE_KEY',
```

Click **Test workflow**. The output shows a formatted table of every account and category in your budget, with their IDs. Keep this open — you'll reference it constantly in the next step.

---

## Step 5: Configure Each Workflow

Every workflow has a single **Config** node at the top. Edit only that node. All other nodes pull values from it automatically.

### Workflow 01 — Sunday Financial Briefing

Runs every Sunday at 7pm. Sends an AI-generated budget summary to Telegram.

```javascript
bridgeUrl:      'http://actual-bridge:3788',
telegramChatId: 'YOUR_TELEGRAM_CHAT_ID',
```

No other configuration required — credentials are handled by n8n's credential store.

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
telegramChatId:    'YOUR_TELEGRAM_CHAT_ID',
```

---

### Workflow 05 — Monthly Rule Digest

Runs on the 1st of each month at 7pm. Analyzes 60 days of transactions, uses Claude to spot categorization patterns, and sends a digest via Telegram. Notion logging is optional — see [Removing Notion from Workflow 05](#removing-notion-from-workflow-05).

```javascript
notionDatabaseId: 'REPLACE_WITH_YOUR_NOTION_RULES_DB_ID', // leave blank if not using Notion
telegramChatId:   'YOUR_TELEGRAM_CHAT_ID',
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

## Step 6: Test and Activate

Test in this order — manual trigger each one before activating:

| # | Workflow | What to verify |
|---|---|---|
| 00 | Discovery | Output shows your accounts and categories with IDs |
| 03 | Categorizer | Uncategorized transactions get categories applied |
| 01 | Briefing | Telegram message arrives with budget summary |
| 02 | Auto-Fund | Categories get funded (run on a test basis — check Actual after) |
| 04 | Paycheck | Message arrives; paycheck detected if a deposit exists this week |
| 05 | Rule Digest | Notion entry created (if using); Telegram message sent |

Once a workflow tests successfully, toggle it **Active**. The schedule takes over from there.

---

## Removing Notion from Workflow 05

### Option A — Disable the nodes (5 minutes)

The Telegram digest still runs in full — you just won't get Notion logging.

1. Import Workflow 05 as normal
2. In the workflow canvas, find these two nodes and **disable** each one (right-click → Disable):
   - `Get Rules Memory`
   - `Create Notion Entry`
3. The workflow routes around them automatically via the existing `If` node

---

### Option B — Remove the Notion nodes entirely (10 minutes)

1. Import Workflow 05
2. Delete these nodes from the canvas:
   - `Get Rules Memory`
   - `Create Notion Entry`
3. Rewire the connections:
   - Connect `Detect Patterns` → `Ask Claude`
   - Connect `Parse Suggestions` → `Build Telegram Digest`

---

### Option C — Replace Notion with another logging destination

Swap the `Create Notion Entry` node for any n8n-compatible node:
- **Google Sheets** — append row node
- **Airtable** — create record node
- **Plain text file** — Write Binary File node to a mounted volume
- **n8n static data** — built-in key-value store (no external service)

The data shape coming out of `Parse Suggestions` stays the same regardless of destination.

---

## Swapping AI Providers

The workflows ship configured for Anthropic Claude (`claude-haiku-4-5` — fast and cheap).

### Option 1 — OpenRouter (use any model)

Single API key, access to Claude, GPT-4o, Gemini, Mistral, and more.

**Credential:**
- Type: `Custom Auth`
- Name: `Anthropic API` ← use this exact name
- JSON:
```json
{
  "headers": {
    "Authorization": "Bearer sk-or-...",
    "HTTP-Referer": "https://github.com/hail2victors/n8n-Actual-Automation"
  }
}
```

**Ask Claude node change** — update URL and body format in Workflows 01, 03, 05:
- URL: `https://openrouter.ai/api/v1/chat/completions`
- Body format: OpenAI chat completions (`{"model": "...", "messages": [...]}`)

> Note: Swapping requires a body format change in 3 nodes across 3 workflows — about 20 minutes of work.

### Option 2 — Stay with Anthropic, change the model

| Model | Speed | Cost | Best for |
|---|---|---|---|
| `claude-haiku-4-5` | Fastest | ~$0.01/100 tx | Categorization (default) |
| `claude-sonnet-4-5` | Balanced | ~$0.15/100 tx | Briefing summaries |

---

## Known Limitations & Caveats

### This is not a plug-and-play app
Setup requires comfort with n8n, Docker, reading error logs, and copying IDs between tools. If you've never used n8n before, budget a few hours for the learning curve.

### Actual Budget version compatibility
Tested against Actual Budget 24.x and the `actual-auto-sync` bridge. If something breaks on a newer version, [open an issue](../../issues).

### Bridge container name
Every Config node uses `bridgeUrl: 'http://actual-bridge:3788'`. The hostname must match your Docker container name exactly. Update `bridgeUrl` in every Config node if yours differs.

### Importing updated workflows
When importing a new version, **delete the old workflow first** before importing the replacement. Importing alongside an existing workflow causes n8n to rename node names with a number suffix (e.g. `Config + Funding Template1`), silently breaking all expressions that reference that node.

### n8n Cloud execution limits
Workflow 02 (Auto-Fund) loops over every category in your funding template. On n8n Cloud plans with execution time limits, a large template may hit those limits. Self-hosted has no such constraint.

### Workflow 02 runs on the 1st regardless of income timing
If your paycheck lands after the 1st, the funding runs against your existing balance. Adjust the schedule trigger if needed.

### Workflow 03 — first run flags everything
The AI Categorizer has no learned rules on first run. Most transactions will flag for manual review — that's normal. After 2–3 weeks, 90%+ categorize automatically.

### AI categorization accuracy depends on category names
Descriptive names like `"Restaurants fast food coffee delivery"` perform significantly better than `"Misc"` or `"Food"`. Take 10 minutes to write good category names in your Config node.

### Workflow 05 Notion logging is optional
If you don't use Notion, disable those two nodes — the Telegram digest runs unchanged. Adapting to other tools (Joplin, Obsidian, etc.) is possible but outside the scope of this repo.

---

## Troubleshooting

### "Cannot connect to Actual Budget bridge"
- Confirm `bridgeUrl` matches your container name exactly
- Both n8n and the bridge must be on the same Docker network
- Check the bridge is running: `docker logs actual-auto-sync`

### No transactions appearing
- Confirm SimpleFIN bridge has synced: `docker logs actual-auto-sync`
- New bank connections can take 24–48 hours to populate
- Manually trigger a sync in Actual Budget to confirm

### "Bad Request: chat not found" from Telegram
- Your chat ID is wrong or missing in the Config node
- Message `@userinfobot` on Telegram to get your correct chat ID
- Send your bot `/start` before it can message you

### "Bad Request: chat_id is empty" from Telegram
- `telegramChatId` in the Config node is blank or still a placeholder
- Check for renamed nodes if you imported over an existing workflow without deleting first

### AI categorization is consistently wrong
- Make category `name` values more descriptive in the Config node
- Lower `AUTO_APPLY_THRESHOLD` to 0.75 to build rules faster
- Raise to 0.90+ for more manual review and higher accuracy

### Workflow 05 Notion entries not appearing
- Confirm your Notion integration has access to the database (Share → Invite integration)
- Check the database ID is the 32-character hex string with no dashes
- The Telegram digest still arrives even if Notion logging fails

### Workflow runs fine manually but fails on schedule
- Confirm the workflow is set to **Active**
- Verify the schedule trigger shows a valid next run time

---

## Getting Updates

Watch this repo to get notified of new releases — click **Watch → Custom → Releases** in the top right.

**To update a workflow:**
1. Note your current Config node values (screenshot or text file)
2. Deactivate the existing workflow in n8n
3. **Delete the old workflow** — do not import alongside it
4. Download the new JSON from this repo
5. Import and re-enter your Config values
6. Test with manual trigger, then re-activate

Your data in Actual Budget is never affected by workflow updates.

---

## Contributing

Found a bug? Have an improvement? [Open an issue](../../issues) or submit a pull request. All contributions welcome.

If this saved you time, a ⭐ on the repo is appreciated and helps others find it.

---

## License

MIT — free to use, modify, and share. See [LICENSE](LICENSE) for details.

---

*n8n Personal Finance Automation Bundle v1.0*
*Compatible with: n8n 1.x, Actual Budget 24.x+*