import test from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "../src/extraction/heuristics.js";

test("extracts amount, date, GSTIN and category from invoice text", () => {
  const text = `ABC Office Supplies Pvt Ltd
Tax Invoice
GSTIN: 27ABCDE1234F1Z5
Date: 15/07/2026
Description: office supplies and stationery
Grand Total: Rs. 5,310.00`;

  const result = heuristicExtract(text);
  assert.equal(result.total_amount, 5310);
  assert.equal(result.invoice_date, "2026-07-15");
  assert.equal(result.gstin, "27ABCDE1234F1Z5");
  assert.equal(result.category_guess, "office_expense");
  assert.equal(result.confidence, "low");
});

test("falls back to null/other when nothing recognizable is present", () => {
  const result = heuristicExtract("hello world, nothing to see here");
  assert.equal(result.total_amount, null);
  assert.equal(result.invoice_date, null);
  assert.equal(result.gstin, null);
  assert.equal(result.category_guess, "other");
});

test("picks up ISO-formatted dates and rent keyword", () => {
  const result = heuristicExtract("Invoice date: 2026-03-05\nOffice rent payment due");
  assert.equal(result.invoice_date, "2026-03-05");
  assert.equal(result.category_guess, "rent");
});

test("picks the largest labelled total when multiple amounts are present", () => {
  const result = heuristicExtract("Subtotal: Rs. 4,500.00\nGST (18%): Rs. 810.00\nGrand Total: Rs. 5,310.00");
  assert.equal(result.total_amount, 5310);
});
