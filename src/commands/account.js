import Table from "cli-table3";
import chalk from "chalk";
import { db } from "../db.js";

const VALID_TYPES = ["asset", "liability", "equity", "income", "expense"];

export function registerAccountCommands(program) {
  const account = program.command("account").description("Manage a client's chart of accounts");

  account
    .command("add")
    .description("Add an account to a client's chart of accounts")
    .requiredOption("-c, --client <id>", "Client ID")
    .requiredOption("--code <code>", "Account code")
    .requiredOption("-n, --name <name>", "Account name")
    .requiredOption("-t, --type <type>", `Account type (${VALID_TYPES.join("|")})`)
    .action((opts) => {
      if (!VALID_TYPES.includes(opts.type)) {
        console.error(chalk.red(`Invalid type "${opts.type}". Must be one of: ${VALID_TYPES.join(", ")}`));
        process.exitCode = 1;
        return;
      }
      db.prepare(
        "INSERT INTO accounts (client_id, code, name, type) VALUES (?, ?, ?, ?)",
      ).run(Number(opts.client), opts.code, opts.name, opts.type);
      console.log(chalk.green(`Account ${opts.code} "${opts.name}" added for client #${opts.client}.`));
    });

  account
    .command("list")
    .description("List a client's chart of accounts")
    .requiredOption("-c, --client <id>", "Client ID")
    .action((opts) => {
      const rows = db
        .prepare("SELECT id, code, name, type FROM accounts WHERE client_id = ? ORDER BY code")
        .all(Number(opts.client));
      if (rows.length === 0) {
        console.log("No accounts found for this client.");
        return;
      }
      const table = new Table({ head: ["ID", "Code", "Name", "Type"] });
      for (const r of rows) table.push([r.id, r.code, r.name, r.type]);
      console.log(table.toString());
    });
}
