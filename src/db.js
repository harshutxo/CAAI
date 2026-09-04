import { DatabaseSync } from "node:sqlite";
import { dbPath } from "./lib/paths.js";

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gstin TEXT,
  pan TEXT,
  contact TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','income','expense')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(client_id, code)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  extracted_json TEXT,
  extraction_method TEXT,
  status TEXT NOT NULL DEFAULT 'extracted',
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  entry_date TEXT NOT NULL,
  debit_account_id INTEGER NOT NULL REFERENCES accounts(id),
  credit_account_id INTEGER NOT NULL REFERENCES accounts(id),
  amount REAL NOT NULL,
  narration TEXT,
  document_id INTEGER REFERENCES documents(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES clients(id),
  title TEXT NOT NULL,
  category TEXT,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const DEFAULT_ACCOUNTS = [
  ["1001", "Cash", "asset"],
  ["1002", "Bank", "asset"],
  ["1100", "Sundry Debtors", "asset"],
  ["1200", "GST Input Credit", "asset"],
  ["2001", "Sundry Creditors", "liability"],
  ["2100", "GST Output Payable", "liability"],
  ["3001", "Capital / Equity", "equity"],
  ["4001", "Sales", "income"],
  ["4002", "Other Income", "income"],
  ["5001", "Purchases", "expense"],
  ["5100", "Office Expenses", "expense"],
  ["5200", "Travel Expenses", "expense"],
  ["5300", "Rent Expense", "expense"],
  ["5400", "Utilities Expense", "expense"],
  ["5500", "Professional Fees", "expense"],
  ["5600", "Bank Charges", "expense"],
  ["5900", "Miscellaneous Expense", "expense"],
];

export function seedDefaultAccounts(clientId) {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO accounts (client_id, code, name, type) VALUES (?, ?, ?, ?)",
  );
  for (const [code, name, type] of DEFAULT_ACCOUNTS) {
    insert.run(clientId, code, name, type);
  }
}
