import { db } from "../db.js";

export function accountBalances(clientId, types, { from, to } = {}) {
  let sql = `
    SELECT a.id, a.code, a.name, a.type,
           COALESCE(SUM(CASE WHEN le.debit_account_id = a.id THEN le.amount ELSE 0 END), 0) AS total_debit,
           COALESCE(SUM(CASE WHEN le.credit_account_id = a.id THEN le.amount ELSE 0 END), 0) AS total_credit
    FROM accounts a
    LEFT JOIN ledger_entries le
      ON (le.debit_account_id = a.id OR le.credit_account_id = a.id)
      AND le.client_id = a.client_id`;
  const params = [];
  if (from) {
    sql += " AND le.entry_date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND le.entry_date <= ?";
    params.push(to);
  }
  sql += ` WHERE a.client_id = ? AND a.type IN (${types.map(() => "?").join(",")})
    GROUP BY a.id ORDER BY a.code`;
  params.push(clientId, ...types);
  return db.prepare(sql).all(...params);
}

/** Debit-normal balance (assets, expenses): debit - credit. */
function debitBalance(row) {
  return row.total_debit - row.total_credit;
}

/** Credit-normal balance (liabilities, equity, income): credit - debit. */
function creditBalance(row) {
  return row.total_credit - row.total_debit;
}

/**
 * Profit & Loss for a client over [from, to]. Returns account-level balances
 * (credit-normal for income, debit-normal for expense) plus totals and net.
 */
export function computePnl(clientId, { from, to } = {}) {
  const income = accountBalances(clientId, ["income"], { from, to }).map((a) => ({ ...a, balance: creditBalance(a) }));
  const expense = accountBalances(clientId, ["expense"], { from, to }).map((a) => ({ ...a, balance: debitBalance(a) }));
  const totalIncome = income.reduce((s, a) => s + a.balance, 0);
  const totalExpense = expense.reduce((s, a) => s + a.balance, 0);
  return { income, expense, totalIncome, totalExpense, net: totalIncome - totalExpense };
}

/**
 * Balance Sheet for a client as of `asOf`. Retained earnings is the net
 * profit accumulated from all ledger history up to that date, folded into
 * equity so Assets == Liabilities + Equity.
 */
export function computeBalanceSheet(clientId, { asOf } = {}) {
  const range = { to: asOf };
  const assets = accountBalances(clientId, ["asset"], range).map((a) => ({ ...a, balance: debitBalance(a) }));
  const liabilities = accountBalances(clientId, ["liability"], range).map((a) => ({ ...a, balance: creditBalance(a) }));
  const equity = accountBalances(clientId, ["equity"], range).map((a) => ({ ...a, balance: creditBalance(a) }));
  const { totalIncome, totalExpense } = computePnl(clientId, range);
  const retainedEarnings = totalIncome - totalExpense;

  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
  const totalEquity = equity.reduce((s, a) => s + a.balance, 0) + retainedEarnings;

  return {
    assets,
    liabilities,
    equity,
    retainedEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balances: Math.abs(totalAssets - (totalLiabilities + totalEquity)) <= 0.005,
  };
}
