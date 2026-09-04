import { Command } from "commander";
import { registerClientCommands } from "./commands/client.js";
import { registerAccountCommands } from "./commands/account.js";
import { registerLedgerCommands } from "./commands/ledger.js";
import { registerDocumentCommands } from "./commands/document.js";
import { registerDeadlineCommands } from "./commands/deadline.js";
import { registerReportCommands } from "./commands/report.js";

const program = new Command();

program
  .name("casuite")
  .description(
    "AI Chartered Accountant Suite — multi-client bookkeeping, AI document extraction, compliance deadlines, and financial reports.",
  )
  .version("0.1.0");

registerClientCommands(program);
registerAccountCommands(program);
registerLedgerCommands(program);
registerDocumentCommands(program);
registerDeadlineCommands(program);
registerReportCommands(program);

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
