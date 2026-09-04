import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

export const ExtractionSchema = z.object({
  document_type: z.enum(["invoice", "receipt", "bill", "bank_statement", "other"]),
  vendor_name: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable().describe("ISO date YYYY-MM-DD if determinable"),
  total_amount: z.number().nullable(),
  currency: z.string().nullable(),
  gstin: z.string().nullable(),
  tax_amount: z.number().nullable(),
  category_guess: z.enum([
    "sales",
    "purchases",
    "office_expense",
    "travel",
    "rent",
    "utilities",
    "professional_fees",
    "bank_charges",
    "other",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().nullable(),
});

const SYSTEM_PROMPT = `You are an accounting document extraction assistant inside a chartered accountant's practice-management tool.
Given a scanned invoice, receipt, bill, or bank statement, extract structured fields precisely.
If a field cannot be determined, return null for it — never guess. Amounts must be plain numbers with no currency symbols or thousands separators.
Dates must be ISO format YYYY-MM-DD. Choose category_guess from the accountant's perspective: an outgoing purchase invoice is "purchases", an electricity/water/internet bill is "utilities", an invoice the client issued to their own customer is "sales", a CA/legal/consulting fee is "professional_fees".`;

export async function extractWithAI({ imageBase64, mediaType, pdfBase64, text }) {
  const client = new Anthropic();
  const content = [];
  if (imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } });
  } else if (pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } });
  }
  content.push({
    type: "text",
    text: text
      ? `Extract the accounting fields from this document text:\n\n${text}`
      : "Extract the accounting fields from this document.",
  });

  const response = await client.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_format: betaZodOutputFormat(ExtractionSchema),
  });

  if (!response.parsed) {
    throw new Error("AI extraction did not return parseable output.");
  }
  return response.parsed;
}
