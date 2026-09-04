# AI CA Suite

A command-line practice-management tool for chartered accountants: manage multiple
clients, keep a double-entry ledger, extract invoices/receipts with AI, track
compliance deadlines, and generate P&L / Balance Sheet reports — all stored locally
in a SQLite database on your machine.

## Setup

```
npm install
npm link          # optional: makes the `casuite` command available globally
```

Without `npm link`, run every command as `node bin/casuite.js ...` from this folder.

### Enabling AI document extraction (optional)

Document extraction works fully offline out of the box (local OCR via Tesseract +
regex heuristics for PDFs/images/text). To get much more accurate extraction using
Claude, provide an API key one of two ways:

```
cp .env.example .env       # then edit .env and paste in your key — picked up automatically
```

or set it in your shell instead:

```
setx ANTHROPIC_API_KEY "sk-ant-..."      # Windows, persists for new shells
$env:ANTHROPIC_API_KEY = "sk-ant-..."    # PowerShell, current session only
```

If no key is set, extraction automatically falls back to OCR/text parsing and
flags the result with `confidence: low` so you know to double-check it.

## Quick start

```
casuite client add -n "Sharma Textiles Pvt Ltd" -g 27AAAAA0000A1Z5 -p AAAAA0000A
casuite client list

casuite account list -c 1                     # every new client gets a starter chart of accounts

casuite ledger add -c 1 --debit 1002 --credit 4001 -a 50000 --note "Sale to XYZ"
casuite ledger list -c 1

casuite doc extract ./invoice.pdf -c 1 --post  # AI-extract + post a suggested entry
casuite doc list -c 1

casuite deadline add -c 1 -t "GSTR-3B Aug" --category GST --due 2026-09-20
casuite deadline list --upcoming 30

casuite report pnl -c 1 --from 2026-04-01 --to 2026-09-30
casuite report bs  -c 1 --as-of 2026-09-30
```

Run `casuite <command> --help` for full options on any command.

## Testing

```
npm test
```

Runs Node's built-in test runner over `test/` — covers formatting/date
validation, the offline extraction heuristics, and ledger posting + P&L /
Balance Sheet math (against an in-memory SQLite database, so it never
touches your real `data/casuite.db`).

## Data storage

Everything lives under `data/` in this project folder:

- `data/casuite.db` — SQLite database (clients, accounts, ledger, deadlines, document metadata)
- `data/documents/<client-id>/` — copies of every uploaded source document

Back up the `data/` folder to back up the entire practice.

## Commands

| Command | Purpose |
|---|---|
| `client add/list/remove` | Manage clients (each gets a default chart of accounts) |
| `account add/list` | Manage a client's chart of accounts |
| `ledger add/list` | Post and view double-entry journal entries |
| `doc extract/list/show` | AI/OCR-extract data from an invoice, receipt, or bill and optionally post it |
| `deadline add/list/done` | Track GST/TDS/ITR/ROC and other compliance due dates |
| `report pnl/bs` | Profit & Loss and Balance Sheet for a client over a period / as of a date |
