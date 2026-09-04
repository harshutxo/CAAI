import Table from "cli-table3";
import chalk from "chalk";
import { db, seedDefaultAccounts } from "../db.js";

export function registerClientCommands(program) {
  const client = program.command("client").description("Manage CA firm clients");

  client
    .command("add")
    .description("Add a new client")
    .requiredOption("-n, --name <name>", "Client name")
    .option("-g, --gstin <gstin>", "GSTIN")
    .option("-p, --pan <pan>", "PAN")
    .option("-c, --contact <contact>", "Contact info (email/phone)")
    .action((opts) => {
      const stmt = db.prepare(
        "INSERT INTO clients (name, gstin, pan, contact) VALUES (?, ?, ?, ?)",
      );
      const result = stmt.run(opts.name, opts.gstin ?? null, opts.pan ?? null, opts.contact ?? null);
      const clientId = Number(result.lastInsertRowid);
      seedDefaultAccounts(clientId);
      console.log(chalk.green(`Client #${clientId} "${opts.name}" created with a default chart of accounts.`));
    });

  client
    .command("list")
    .description("List all clients")
    .action(() => {
      const rows = db.prepare("SELECT id, name, gstin, pan, contact FROM clients ORDER BY id").all();
      if (rows.length === 0) {
        console.log("No clients yet. Add one with: casuite client add -n \"Client Name\"");
        return;
      }
      const table = new Table({ head: ["ID", "Name", "GSTIN", "PAN", "Contact"] });
      for (const r of rows) table.push([r.id, r.name, r.gstin ?? "-", r.pan ?? "-", r.contact ?? "-"]);
      console.log(table.toString());
    });

  client
    .command("remove <id>")
    .description("Remove a client and all its data")
    .action((id) => {
      const clientId = Number(id);
      db.exec("BEGIN");
      try {
        db.prepare("DELETE FROM ledger_entries WHERE client_id = ?").run(clientId);
        db.prepare("DELETE FROM documents WHERE client_id = ?").run(clientId);
        db.prepare("DELETE FROM deadlines WHERE client_id = ?").run(clientId);
        db.prepare("DELETE FROM accounts WHERE client_id = ?").run(clientId);
        const result = db.prepare("DELETE FROM clients WHERE id = ?").run(clientId);
        db.exec("COMMIT");
        if (result.changes === 0) {
          console.log(chalk.yellow(`No client with id ${clientId} found.`));
        } else {
          console.log(chalk.green(`Client #${clientId} and all related records removed.`));
        }
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    });
}
