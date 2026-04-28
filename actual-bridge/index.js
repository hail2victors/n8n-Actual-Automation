const actual = require('@actual-app/api');
const express = require('express');
const fs = require('fs');

const app = express();
app.use(express.json());

const ACTUAL_SERVER   = process.env.ACTUAL_SERVER_URL  || 'http://actual_server:5006';
const ACTUAL_PASSWORD = process.env.ACTUAL_PASSWORD;
const BUDGET_SYNC_ID  = process.env.ACTUAL_BUDGET_SYNC_ID;
const BRIDGE_KEY      = process.env.BRIDGE_API_KEY     || 'changeme';
const DATA_DIR        = '/tmp/actual-data';
const PORT            = 3788;
const RETRY_DELAY_MS  = 10000;
const MAX_RETRIES     = 12;

let initialized  = false;
let initializing = false;

app.use((req, res, next) => {
  if (req.path === '/health') return next();
  if (req.headers['x-bridge-key'] !== BRIDGE_KEY)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
});

async function tryInit() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  await actual.init({ serverURL: ACTUAL_SERVER, password: ACTUAL_PASSWORD, dataDir: DATA_DIR });
  await actual.downloadBudget(BUDGET_SYNC_ID);
  initialized = true;
  console.log('✅ Actual budget ready');
}

async function ensureReady() {
  if (initialized) return;
  if (initializing) {
    while (initializing) await new Promise(r => setTimeout(r, 100));
    return;
  }
  initializing = true;
  try   { await tryInit(); }
  catch (err) { initialized = false; throw err; }
  finally     { initializing = false; }
}

async function withActual(fn) {
  try { await ensureReady(); return await fn(); }
  catch (err) {
    console.error('Actual error, resetting:', err.message);
    initialized = false;
    await ensureReady();
    return await fn();
  }
}

async function warmWithRetry() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      console.log(`🔄 Connecting to Actual (attempt ${i}/${MAX_RETRIES})...`);
      await tryInit();
      return;
    } catch (err) {
      console.error(`   Attempt ${i} failed: ${err.message}`);
      if (i < MAX_RETRIES) {
        console.log(`   Retrying in ${RETRY_DELAY_MS/1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error('❌ Startup retries exhausted. Will retry on first request.');
      }
    }
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) =>
  res.json({ status: 'ok', initialized, server: ACTUAL_SERVER, budget: BUDGET_SYNC_ID })
);

app.get('/categories', async (req, res) => {
  try { res.json({ data: await withActual(() => actual.getCategoryGroups()) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/accounts', async (req, res) => {
  try { res.json({ data: await withActual(() => actual.getAccounts()) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/budget/:month', async (req, res) => {
  try { res.json({ data: await withActual(() => actual.getBudgetMonth(req.params.month)) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/budget/:month/categories/:categoryId', async (req, res) => {
  try {
    const dollars = parseFloat(req.body.amount);
    if (isNaN(dollars)) return res.status(400).json({ error: 'amount must be a number' });
    await withActual(() =>
      actual.setBudgetAmount(req.params.month, req.params.categoryId, Math.round(dollars * 100))
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/transactions', async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.query;
    if (!accountId || !startDate || !endDate)
      return res.status(400).json({ error: 'accountId, startDate, endDate required' });
    res.json({ data: await withActual(() => actual.getTransactions(accountId, startDate, endDate)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/transactions/uncategorized', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ error: 'startDate and endDate required' });
    const result = await withActual(async () => {
      await actual.sync();
      const accounts = await actual.getAccounts();
      const all = [];
      for (const acct of accounts) {
        if (acct.offbudget) continue;
        const txs = await actual.getTransactions(acct.id, startDate, endDate);
        for (const tx of txs) {
          if (!tx.category && !tx.is_parent && tx.amount < 0 &&
              !tx.transfer_id && !tx.starting_balance_flag) {
            all.push({ ...tx, accountName: acct.name });
          }
        }
      }
      return all;
    });
    res.json({ data: result, count: result.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/transactions/:id', async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) return res.status(400).json({ error: 'category required' });
    await withActual(async () => {
      await actual.updateTransaction(req.params.id, { category });
      await actual.sync();
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Split transaction endpoint ─────────────────────────────────────────────────
app.post('/transactions/:id/split', async (req, res) => {
  try {
    const { splits, accountId } = req.body;
    if (!accountId)
      return res.status(400).json({ error: 'accountId required' });
    if (!splits || !Array.isArray(splits) || splits.length < 2)
      return res.status(400).json({ error: 'splits must be an array of at least 2 items' });
    for (const s of splits) {
      if (typeof s.amount !== 'number')
        return res.status(400).json({ error: 'each split must have a numeric amount' });
      if (!s.category)
        return res.status(400).json({ error: 'each split must have a category id' });
    }
    const result = await withActual(async () => {
      // Fetch parent transaction to get its date
      const today = new Date().toISOString().slice(0, 10);
      const parentTxs = await actual.getTransactions(accountId, '2026-01-01', today);
      const parentTx = parentTxs.find(tx => tx.id === req.params.id);
      const txDate = parentTx ? parentTx.date : today;

      const subtransactions = splits.map(s => ({
        amount: Math.round(s.amount * 100),
        category: s.category,
        notes: s.notes || '',
        account: accountId,
        date: txDate,
      }));

      await actual.updateTransaction(req.params.id, { subtransactions });
      await actual.sync();
      return { ok: true, parentId: req.params.id, splitCount: splits.length };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Rules endpoint ─────────────────────────────────────────────────────────────
app.post('/rules', async (req, res) => {
  try {
    const { payeeName, categoryId, matchType } = req.body;
    if (!payeeName || !categoryId)
      return res.status(400).json({ error: 'payeeName and categoryId required' });

    const op = matchType === 'contains' ? 'contains' : 'is';

    const rule = await withActual(async () => {
      const existingRules = await actual.getRules();
      const alreadyExists = existingRules.some(r => {
        if (!r.conditions || !r.actions) return false;
        const hasPayeeCondition = r.conditions.some(
          c => c.field === 'imported_payee' && c.value === payeeName
        );
        const hasCategoryAction = r.actions.some(
          a => a.field === 'category' && a.value === categoryId
        );
        return hasPayeeCondition && hasCategoryAction;
      });

      if (alreadyExists) {
        return { ok: true, created: false, reason: 'Rule already exists for this payee+category' };
      }

      const newRule = await actual.createRule({
        stage: 'pre',
        conditionsOp: 'and',
        conditions: [{ field: 'imported_payee', op, value: payeeName }],
        actions: [{ op: 'set', field: 'category', value: categoryId }]
      });
      await actual.sync();
      return { ok: true, created: true, ruleId: newRule, payeeName, categoryId };
    });

    res.json(rule);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/rules', async (req, res) => {
  try {
    const rules = await withActual(() => actual.getRules());
    res.json({ data: rules, count: rules.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Create transaction endpoint ───────────────────────────────────────────────
// POST /transactions/create
// Creates a new transaction in Actual. Supports direct transactions and transfers.
//
// Body for DIRECT transaction (utility bills etc):
// {
//   accountId:         string  — source account UUID (required)
//   date:              string  — YYYY-MM-DD (required)
//   amount:            number  — positive dollar amount, stored as outflow (required)
//   payeeName:         string  — payee name (required)
//   notes:             string  — optional notes
//   categoryId:        string  — optional category UUID
//   cleared:           boolean — default false
// }
//
// Body for TRANSFER (CC payments):
// {
//   accountId:         string  — source account UUID, e.g. checking (required)
//   transferAccountId: string  — destination account UUID, e.g. CC account (required)
//   date:              string  — YYYY-MM-DD (required)
//   amount:            number  — positive dollar amount (required)
//   payeeName:         string  — payee name for reference (required)
//   notes:             string  — optional notes
//   cleared:           boolean — default false
// }
app.post('/transactions/create', async (req, res) => {
  try {
    const { accountId, date, amount, payeeName, notes, categoryId,
            cleared, transferAccountId } = req.body;

    if (!accountId || !date || amount === undefined || !payeeName)
      return res.status(400).json({ error: 'accountId, date, amount, payeeName required' });

    const result = await withActual(async () => {
      const amountCents = Math.round(amount * 100);
      const isCleared   = cleared === true;

      if (transferAccountId) {
        // ── Transfer: use the transfer payee for the destination account ────
        // Each account has a built-in transfer payee with transfer_acct set.
        // Assigning that payee to a transaction automatically creates the
        // linked transaction on the other side.
        const payees = await actual.getPayees();
        const transferPayee = payees.find(p => p.transfer_acct === transferAccountId);

        if (!transferPayee) {
          throw new Error(`No transfer payee found for account ${transferAccountId}`);
        }

        // importTransactions with the transfer payee is the correct approach —
        // it creates the linked transaction on the CC side automatically.
        // A unique imported_id prevents deduplication from killing the entry.
        const importedId = `bridge-${Date.now()}-${amountCents}`;

        const txns = await actual.importTransactions(accountId, [{
          date,
          amount: -amountCents,
          payee: transferPayee.id,
          notes: notes || payeeName,
          cleared: isCleared,
          imported_id: importedId,
        }]);

        await actual.sync();
        const txnId = txns && txns.added && txns.added.length > 0 ? txns.added[0] : null;
        return {
          ok: true,
          type: 'transfer',
          transactionId: txnId,
          amount: amountCents,
          date,
          payeeName,
        };

      } else {
        // ── Direct: single transaction with optional category ───────────────
        const txns = await actual.addTransactions(accountId, [{
          date,
          amount: -amountCents,
          payee_name: payeeName,
          notes: notes || '',
          category: categoryId || null,
          cleared: isCleared,
        }]);

        await actual.sync();
        const txnId = Array.isArray(txns) && txns.length > 0 ? txns[0] : null;
        return { ok: true, type: 'direct', transactionId: txnId, amount: amountCents, date, payeeName };
      }
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Bank sync endpoint ─────────────────────────────────────────────────────
// POST /sync/bank
// Triggers SimpleFIN bank sync — pulls new transactions from all linked accounts.
// Replaces actual-auto-sync container.
app.post('/sync/bank', async (req, res) => {
  try {
    await ensureReady();
    await actual.sync();
    
    // runBankSync can throw unhandled rejections — catch explicitly
    const syncPromise = actual.runBankSync();
    await syncPromise.catch(err => {
      console.error('Bank sync warning (non-fatal):', err.message);
    });
    
    await actual.sync();
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) { 
    console.error('Bank sync endpoint error:', err.message);
    res.status(500).json({ error: err.message }); 
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌉 Actual Bridge listening on :${PORT}`);
  console.log(`   Server: ${ACTUAL_SERVER}`);
  console.log(`   Budget: ${BUDGET_SYNC_ID}`);
  warmWithRetry();
});