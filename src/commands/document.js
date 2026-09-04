import fs from "node:fs";
import path from "node:path";
import Table from "cli-table3";
import chalk from "chalk";
import { db } from "../db.js";
import { documentsDir } from "../lib/paths.js";
import { extractDocument, CATEGORY_ACCOUNT_MAP } from "../extraction/extractDocument.js";
import { postLedgerEntry, resolveAccount } from "./ledger.js";
import { money, today } from "../lib/format.js";

function printExtraction(data, method) {
  console.log(chalk.bold(`\nExtracted fields (method: ${method}):`));
  const table = new Table();
  for (const [key, value] of Object.entries(data)) {
    table.push([key, value === null || value === undefined ? "-" : String(value)]);
  }
  console.log(table.toString());
}

export function registerDocumentCommands(program) {
  const doc = program.command("doc").description("Upload and AI-extract accounting documents");

  doc
    .command("extract <file>")
    .description("Extract structured data from an invoice/receipt/bill (AI when configured, OCR/heuristics otherwise)")
    .requiredOption("-c, --client <id>", "Client ID")
    .option("--post", "Also post the suggested journal entry to the ledger")
    .option("-d, --date <date>", "Entry date to use if posting (defaults to today, or the extracted invoice date)")
    .action(async (file, opts) => {
      const clientId = Number(opts.client);
      const absPath = path.resolve(file);
      if (!fs.existsSync(absPath)) {
        console.error(chalk.red(`File not found: ${absPath}`));
        process.exitCode = 1;
        return;
      }
      const clientRow = db.prepare("SELECT id FROM clients WHERE id = ?").get(clientId);
      if (!clientRow) {
        console.error(chalk.red(`No client with id ${clientId} found.`));
        process.exitCode = 1;
        return;
      }

      console.log(`Extracting ${path.basename(absPath)} for client #${clientId}...`);
      const { method, data } = await extractDocument(absPath);
      printExtraction(data, method);

      const clientDocsDir = path.join(documentsDir, String(clientId));
      fs.mkdirSync(clientDocsDir, { recursive: true });
      const storedName = `${Date.now()}-${path.basename(absPath)}`;
      const storedPath = path.join(clientDocsDir, storedName);
      fs.copyFileSync(absPath, storedPath);

      const result = db
        .prepare(
          `INSERT INTO documents (client_id, original_name, stored_path, extracted_json, extraction_method)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(clientId, path.basename(absPath), storedPath, JSON.stringify(data), method);
      const documentId = Number(result.lastInsertRowid);
      console.log(chalk.green(`\nDocument #${documentId} saved.`));

      const mapping = CATEGORY_ACCOUNT_MAP[data.category_guess] ?? CATEGORY_ACCOUNT_MAP.other;
      const debit = resolveAccount(clientId, mapping.debit);
      const credit = resolveAccount(clientId, mapping.credit);
      if (!data.total_amount || !debit || !credit) {
        console.log(chalk.yellow("Could not build a suggested journal entry (missing amount or chart-of-account mapping)."));
        return;
      }

      const entryDate = opts.date ?? data.invoice_date ?? today();
      console.log(
        chalk.cyan(
          `\nSuggested entry: Dr ${debit.code} ${debit.name} / Cr ${credit.code} ${credit.name} — ${money(
            data.total_amount,
          )} on ${entryDate} (category: ${data.category_guess}, confidence: ${data.confidence})`,
        ),
      );

      if (opts.post) {
        const { id } = postLedgerEntry({
          clientId,
          date: entryDate,
          debitCode: mapping.debit,
          creditCode: mapping.credit,
          amount: data.total_amount,
          narration: `${data.vendor_name ?? "Unknown vendor"} — ${data.document_type} ${data.invoice_number ?? ""}`.trim(),
          documentId,
        });
        console.log(chalk.green(`Posted as ledger entry #${id}.`));
      } else {
        console.log(chalk.dim("Re-run with --post to record this entry, or use `casuite ledger add` to post manually."));
      }
    });

  doc
    .command("list")
    .description("List documents uploaded for a client")
    .requiredOption("-c, --client <id>", "Client ID")
    .action((opts) => {
      const rows = db
        .prepare(
          "SELECT id, original_name, extraction_method, status, uploaded_at FROM documents WHERE client_id = ? ORDER BY id DESC",
        )
        .all(Number(opts.client));
      if (rows.length === 0) {
        console.log("No documents uploaded for this client yet.");
        return;
      }
      const table = new Table({ head: ["ID", "File", "Method", "Status", "Uploaded"] });
      for (const r of rows) table.push([r.id, r.original_name, r.extraction_method, r.status, r.uploaded_at]);
      console.log(table.toString());
    });

  doc
    .command("show <id>")
    .description("Show the extracted data for a stored document")
    .action((id) => {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
      if (!row) {
        console.error(chalk.red(`No document with id ${id} found.`));
        process.exitCode = 1;
        return;
      }
      console.log(chalk.bold(`Document #${row.id}: ${row.original_name}`));
      printExtraction(JSON.parse(row.extracted_json), row.extraction_method);
    });
}
