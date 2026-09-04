import Table from "cli-table3";
import chalk from "chalk";
import { db } from "../db.js";
import { isValidDate, today } from "../lib/format.js";

export function registerDeadlineCommands(program) {
  const deadline = program.command("deadline").description("Track compliance deadlines (GST, TDS, ITR, ROC, ...)");

  deadline
    .command("add")
    .description("Add a compliance deadline")
    .requiredOption("-t, --title <title>", "Deadline title, e.g. \"GSTR-3B Aug 2026\"")
    .requiredOption("--due <date>", "Due date (YYYY-MM-DD)")
    .option("-c, --client <id>", "Client ID (omit for a firm-wide deadline)")
    .option("--category <category>", "Category, e.g. GST, TDS, ITR, ROC", "General")
    .action((opts) => {
      if (!isValidDate(opts.due)) {
        console.error(chalk.red(`Invalid date "${opts.due}". Use YYYY-MM-DD.`));
        process.exitCode = 1;
        return;
      }
      const result = db
        .prepare("INSERT INTO deadlines (client_id, title, category, due_date) VALUES (?, ?, ?, ?)")
        .run(opts.client ? Number(opts.client) : null, opts.title, opts.category, opts.due);
      console.log(chalk.green(`Deadline #${Number(result.lastInsertRowid)} "${opts.title}" due ${opts.due} added.`));
    });

  deadline
    .command("list")
    .description("List compliance deadlines")
    .option("-c, --client <id>", "Filter by client ID")
    .option("--upcoming <days>", "Only show deadlines due within N days")
    .option("--all", "Include completed deadlines")
    .action((opts) => {
      let sql = `
        SELECT d.id, d.title, d.category, d.due_date, d.status, c.name AS client_name
        FROM deadlines d
        LEFT JOIN clients c ON c.id = d.client_id
        WHERE 1=1`;
      const params = [];
      if (opts.client) {
        sql += " AND d.client_id = ?";
        params.push(Number(opts.client));
      }
      if (!opts.all) {
        sql += " AND d.status != 'done'";
      }
      if (opts.upcoming) {
        const cutoff = new Date(Date.now() + Number(opts.upcoming) * 86400000).toISOString().slice(0, 10);
        sql += " AND d.due_date <= ?";
        params.push(cutoff);
      }
      sql += " ORDER BY d.due_date";
      const rows = db.prepare(sql).all(...params);
      if (rows.length === 0) {
        console.log("No matching deadlines.");
        return;
      }
      const todayStr = today();
      const table = new Table({ head: ["ID", "Due", "Title", "Category", "Client", "Status"] });
      for (const r of rows) {
        const overdue = r.due_date < todayStr && r.status !== "done";
        const due = overdue ? chalk.red(r.due_date + " (overdue)") : r.due_date;
        table.push([r.id, due, r.title, r.category ?? "-", r.client_name ?? "Firm-wide", r.status]);
      }
      console.log(table.toString());
    });

  deadline
    .command("done <id>")
    .description("Mark a deadline as completed")
    .action((id) => {
      const result = db.prepare("UPDATE deadlines SET status = 'done' WHERE id = ?").run(Number(id));
      if (result.changes === 0) {
        console.log(chalk.yellow(`No deadline with id ${id} found.`));
      } else {
        console.log(chalk.green(`Deadline #${id} marked done.`));
      }
    });
}
