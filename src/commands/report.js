import Table from "cli-table3";
import chalk from "chalk";
import { computePnl, computeBalanceSheet } from "../lib/reportEngine.js";
import { money, today, isValidDate } from "../lib/format.js";

export function registerReportCommands(program) {
  const report = program.command("report").description("Generate financial reports");

  report
    .command("pnl")
    .description("Profit & Loss statement for a client over a period")
    .requiredOption("-c, --client <id>", "Client ID")
    .option("--from <date>", "Period start (YYYY-MM-DD)", "1900-01-01")
    .option("--to <date>", "Period end (YYYY-MM-DD)", today())
    .action((opts) => {
      for (const d of [opts.from, opts.to]) {
        if (!isValidDate(d)) {
          console.error(chalk.red(`Invalid date "${d}". Use YYYY-MM-DD.`));
          process.exitCode = 1;
          return;
        }
      }
      const clientId = Number(opts.client);
      const { income, expense, totalIncome, totalExpense, net } = computePnl(clientId, opts);

      console.log(chalk.bold(`\nProfit & Loss — Client #${clientId} (${opts.from} to ${opts.to})\n`));

      const incomeTable = new Table({ head: ["Income Account", "Amount"] });
      for (const a of income) incomeTable.push([`${a.code} ${a.name}`, money(a.balance)]);
      incomeTable.push([chalk.bold("Total Income"), chalk.bold(money(totalIncome))]);
      console.log(incomeTable.toString());

      const expenseTable = new Table({ head: ["Expense Account", "Amount"] });
      for (const a of expense) expenseTable.push([`${a.code} ${a.name}`, money(a.balance)]);
      expenseTable.push([chalk.bold("Total Expense"), chalk.bold(money(totalExpense))]);
      console.log(expenseTable.toString());

      const label = net >= 0 ? "Net Profit" : "Net Loss";
      console.log(chalk.bold(`\n${label}: ${money(Math.abs(net))}\n`));
    });

  report
    .command("bs")
    .description("Balance Sheet for a client as of a date")
    .requiredOption("-c, --client <id>", "Client ID")
    .option("--as-of <date>", "As-of date (YYYY-MM-DD)", today())
    .action((opts) => {
      if (!isValidDate(opts.asOf)) {
        console.error(chalk.red(`Invalid date "${opts.asOf}". Use YYYY-MM-DD.`));
        process.exitCode = 1;
        return;
      }
      const clientId = Number(opts.client);
      const { assets, liabilities, equity, retainedEarnings, totalAssets, totalLiabilities, totalEquity, balances } =
        computeBalanceSheet(clientId, { asOf: opts.asOf });

      console.log(chalk.bold(`\nBalance Sheet — Client #${clientId} (as of ${opts.asOf})\n`));

      const assetTable = new Table({ head: ["Asset Account", "Amount"] });
      for (const a of assets) assetTable.push([`${a.code} ${a.name}`, money(a.balance)]);
      assetTable.push([chalk.bold("Total Assets"), chalk.bold(money(totalAssets))]);
      console.log(assetTable.toString());

      const liabEquityTable = new Table({ head: ["Liabilities / Equity Account", "Amount"] });
      for (const a of liabilities) liabEquityTable.push([`${a.code} ${a.name}`, money(a.balance)]);
      for (const a of equity) liabEquityTable.push([`${a.code} ${a.name}`, money(a.balance)]);
      liabEquityTable.push(["Retained Earnings (Net Profit to date)", money(retainedEarnings)]);
      liabEquityTable.push([chalk.bold("Total Liabilities + Equity"), chalk.bold(money(totalLiabilities + totalEquity))]);
      console.log(liabEquityTable.toString());

      if (balances) {
        console.log(chalk.green("\nBalance Sheet balances."));
      } else {
        const diff = totalAssets - (totalLiabilities + totalEquity);
        console.log(chalk.red(`\nWarning: Balance Sheet does not balance (difference: ${money(diff)}).`));
      }
    });
}
