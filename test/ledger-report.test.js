import test from "node:test";
import assert from "node:assert/strict";

// Must be set before src/db.js is first imported (it opens the DB at import
// time), so we set it here and import everything dynamically below.
process.env.CASUITE_DB_PATH = ":memory:";

const { db, seedDefaultAccounts } = await import("../src/db.js");
const { postLedgerEntry, resolveAccount } = await import("../src/commands/ledger.js");
const { computePnl, computeBalanceSheet } = await import("../src/lib/reportEngine.js");

function makeClient(name) {
  const result = db.prepare("INSERT INTO clients (name) VALUES (?)").run(name);
  const clientId = Number(result.lastInsertRowid);
  seedDefaultAccounts(clientId);
  return clientId;
}

test("resolveAccount finds a seeded account by code", () => {
  const clientId = makeClient("Test Co");
  const acc = resolveAccount(clientId, "1002");
  assert.equal(acc.name, "Bank");
});

test("postLedgerEntry rejects an unknown account code", () => {
  const clientId = makeClient("Test Co 2");
  assert.throws(
    () => postLedgerEntry({ clientId, date: "2026-01-01", debitCode: "9999", creditCode: "1002", amount: 100 }),
    /No account/,
  );
});

test("P&L totals income and expense correctly and Balance Sheet balances", () => {
  const clientId = makeClient("Acme Pvt Ltd");
  postLedgerEntry({ clientId, date: "2026-06-15", debitCode: "1002", creditCode: "4001", amount: 50000, narration: "Sale" });
  postLedgerEntry({ clientId, date: "2026-06-20", debitCode: "5300", creditCode: "1002", amount: 12000, narration: "Rent" });
  postLedgerEntry({ clientId, date: "2026-07-05", debitCode: "5001", creditCode: "2001", amount: 8000, narration: "Purchase" });

  const pnl = computePnl(clientId, { from: "2026-04-01", to: "2026-09-04" });
  assert.equal(pnl.totalIncome, 50000);
  assert.equal(pnl.totalExpense, 20000);
  assert.equal(pnl.net, 30000);

  const bs = computeBalanceSheet(clientId, { asOf: "2026-09-04" });
  assert.equal(bs.totalAssets, 38000);
  assert.equal(bs.retainedEarnings, 30000);
  assert.equal(bs.totalLiabilities + bs.totalEquity, 38000);
  assert.ok(bs.balances, "balance sheet should balance");
});

test("Balance Sheet respects the as-of date cutoff", () => {
  const clientId = makeClient("Cutoff Co");
  postLedgerEntry({ clientId, date: "2026-01-10", debitCode: "1002", creditCode: "4001", amount: 1000 });
  postLedgerEntry({ clientId, date: "2026-05-10", debitCode: "1002", creditCode: "4001", amount: 2000 });

  assert.equal(computeBalanceSheet(clientId, { asOf: "2026-02-01" }).totalAssets, 1000);
  assert.equal(computeBalanceSheet(clientId, { asOf: "2026-12-31" }).totalAssets, 3000);
});

test("clients are isolated from each other's ledger entries", () => {
  const clientA = makeClient("Client A");
  const clientB = makeClient("Client B");
  postLedgerEntry({ clientId: clientA, date: "2026-01-01", debitCode: "1002", creditCode: "4001", amount: 100 });

  assert.equal(computePnl(clientA, {}).totalIncome, 100);
  assert.equal(computePnl(clientB, {}).totalIncome, 0);
});
