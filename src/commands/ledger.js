import Table from "cli-table3";
import chalk from "chalk";
import { db } from "../db.js";
import { money, today, isValidDate } from "../lib/format.js";

export function resolveAccount(clientId, codeOrId) {
  return (
    db.prepare("SELECT * FROM accounts WHERE client_id = ? AND code = ?").get(clientId, codeOrId) ??
    db.prepare("SELECT * FROM accounts WHERE client_id = ? AND id = ?").get(clientId, Number(codeOrId))
  );
}

export function postLedgerEntry({ clientId, date, debitCode, creditCode, amount, narration, documentId = null }) {
  const debit = resolveAccount(clientId, debitCode);
  const credit = resolveAccount(clientId, creditCode);
  if (!debit) throw new Error(`No account "${debitCode}" found for client #${clientId}`);
  if (!credit) throw new Error(`No account "${creditCode}" found for client #${clientId}`);
  const result = db
    .prepare(
      `INSERT INTO ledger_entries (client_id, entry_date, debit_account_id, credit_account_id, amount, narration, document_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(clientId, date, debit.id, credit.id, amount, narration ?? null, documentId);
  return { id: Number(result.lastInsertRowid), debit, credit };
}

export function registerLedgerCommands(program) {
  const ledger = program.command("ledger").description("Record and view journal entries");

  ledger
    .command("add")
    .description("Post a journal entry (one debit account, one credit account)")
    .requiredOption("-c, --client <id>", "Client ID")
    .requiredOption("--debit <code>", "Account code/id to debit")
    .requiredOption("--credit <code>", "Account code/id to credit")
    .requiredOption("-a, --amount <amount>", "Amount")
    .option("-d, --date <date>", "Entry date (YYYY-MM-DD)", today())
    .option("--note <narration>", "Narration / description")
    .action((opts) => {
      if (!isValidDate(opts.date)) {
        console.error(chalk.red(`Invalid date "${opts.date}". Use YYYY-MM-DD.`));
        process.exitCode = 1;
        return;
      }
      const amount = Number(opts.amount);
      if (!(amount > 0)) {
        console.error(chalk.red("Amount must be a positive number."));
        process.exitCode = 1;
        return;
      }
      try {
        const { id, debit, credit } = postLedgerEntry({
          clientId: Number(opts.client),
          date: opts.date,
          debitCode: opts.debit,
          creditCode: opts.credit,
          amount,
          narration: opts.note,
        });
        console.log(
          chalk.green(
            `Entry #${id}: Dr ${debit.name} / Cr ${credit.name} — ${money(amount)} on ${opts.date}`,
          ),
        );
      } catch (err) {
        console.error(chalk.red(err.message));
        process.exitCode = 1;
      }
    });

  ledger
    .command("list")
    .description("List journal entries for a client")
    .requiredOption("-c, --client <id>", "Client ID")
    .option("--from <date>", "Start date (YYYY-MM-DD)")
    .option("--to <date>", "End date (YYYY-MM-DD)")
    .action((opts) => {
      const clientId = Number(opts.client);
      let sql = `
        SELECT le.id, le.entry_date, da.code AS debit_code, da.name AS debit_name,
               ca.code AS credit_code, ca.name AS credit_name, le.amount, le.narration
        FROM ledger_entries le
        JOIN accounts da ON da.id = le.debit_account_id
        JOIN accounts ca ON ca.id = le.credit_account_id
        WHERE le.client_id = ?`;
      const params = [clientId];
      if (opts.from) {
        sql += " AND le.entry_date >= ?";
        params.push(opts.from);
      }
      if (opts.to) {
        sql += " AND le.entry_date <= ?";
        params.push(opts.to);
      }
      sql += " ORDER BY le.entry_date, le.id";
      const rows = db.prepare(sql).all(...params);
      if (rows.length === 0) {
        console.log("No ledger entries found.");
        return;
      }
      const table = new Table({ head: ["ID", "Date", "Debit", "Credit", "Amount", "Narration"] });
      for (const r of rows) {
        table.push([
          r.id,
          r.entry_date,
          `${r.debit_code} ${r.debit_name}`,
          `${r.credit_code} ${r.credit_name}`,
          money(r.amount),
          r.narration ?? "",
        ]);
      }
      console.log(table.toString());
    });
}
