import fs from "node:fs";
import path from "node:path";
import { heuristicExtract } from "./heuristics.js";
import { extractWithAI } from "./aiExtract.js";

const IMAGE_MEDIA_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Extracts structured accounting fields (vendor, amount, date, GSTIN, category, ...)
 * from an invoice/receipt/bill file. Uses Claude vision/document understanding when
 * API credentials are configured, and falls back to local OCR/text-parsing +
 * regex heuristics otherwise, so the tool works fully offline.
 */
export async function extractDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = fs.readFileSync(filePath);

  if (IMAGE_MEDIA_TYPES[ext]) {
    if (hasCredentials()) {
      try {
        const data = await extractWithAI({ imageBase64: buf.toString("base64"), mediaType: IMAGE_MEDIA_TYPES[ext] });
        return { method: "ai-vision", data };
      } catch (err) {
        console.warn(`AI extraction failed (${err.message}); falling back to OCR + heuristics.`);
      }
    }
    const { default: Tesseract } = await import("tesseract.js");
    const { data: ocrResult } = await Tesseract.recognize(buf, "eng");
    return { method: "ocr-heuristic", data: heuristicExtract(ocrResult.text) };
  }

  if (ext === ".pdf") {
    if (hasCredentials()) {
      try {
        const data = await extractWithAI({ pdfBase64: buf.toString("base64") });
        return { method: "ai-pdf", data };
      } catch (err) {
        console.warn(`AI extraction failed (${err.message}); falling back to PDF text extraction + heuristics.`);
      }
    }
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buf);
    return { method: "pdf-heuristic", data: heuristicExtract(parsed.text) };
  }

  const text = buf.toString("utf8");
  if (hasCredentials()) {
    try {
      const data = await extractWithAI({ text });
      return { method: "ai-text", data };
    } catch (err) {
      console.warn(`AI extraction failed (${err.message}); falling back to heuristics.`);
    }
  }
  return { method: "text-heuristic", data: heuristicExtract(text) };
}

export const CATEGORY_ACCOUNT_MAP = {
  sales: { debit: "1100", credit: "4001" },
  purchases: { debit: "5001", credit: "2001" },
  office_expense: { debit: "5100", credit: "1002" },
  travel: { debit: "5200", credit: "1002" },
  rent: { debit: "5300", credit: "1002" },
  utilities: { debit: "5400", credit: "1002" },
  professional_fees: { debit: "5500", credit: "1002" },
  bank_charges: { debit: "5600", credit: "1002" },
  other: { debit: "5900", credit: "1002" },
};
