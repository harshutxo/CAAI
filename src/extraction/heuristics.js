const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]\b/;
const AMOUNT_LABEL_RE = /(grand\s*total|total\s*amount|amount\s*payable|net\s*amount|invoice\s*total|balance\s*due|total)[:\s₹rs.]*([\d,]+\.?\d{0,2})/gi;
const CURRENCY_AMOUNT_RE = /(?:₹|rs\.?|inr)\s*([\d,]+\.?\d{0,2})/gi;

const DATE_PATTERNS = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/, order: ["y", "m", "d"] },
  { re: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/, order: ["d", "m", "y"] },
  {
    re: /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i,
    order: ["d", "mon", "y"],
  },
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const CATEGORY_KEYWORDS = [
  ["rent", "rent"],
  ["lease", "rent"],
  ["electricity", "utilities"],
  ["water bill", "utilities"],
  ["internet", "utilities"],
  ["broadband", "utilities"],
  ["utility", "utilities"],
  ["uber", "travel"],
  ["ola", "travel"],
  ["taxi", "travel"],
  ["flight", "travel"],
  ["airlines", "travel"],
  ["hotel", "travel"],
  ["travel", "travel"],
  ["professional fee", "professional_fees"],
  ["consulting", "professional_fees"],
  ["audit fee", "professional_fees"],
  ["legal fee", "professional_fees"],
  ["bank charge", "bank_charges"],
  ["service charge", "bank_charges"],
  ["office supplies", "office_expense"],
  ["stationery", "office_expense"],
  ["purchase order", "purchases"],
  ["purchase", "purchases"],
  ["goods received", "purchases"],
  ["sales invoice", "sales"],
];

function normalizeAmount(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractAmount(text) {
  let best = null;
  for (const m of text.matchAll(AMOUNT_LABEL_RE)) {
    const val = normalizeAmount(m[2]);
    if (val !== null && (best === null || val > best)) best = val;
  }
  if (best !== null) return best;
  for (const m of text.matchAll(CURRENCY_AMOUNT_RE)) {
    const val = normalizeAmount(m[1]);
    if (val !== null && (best === null || val > best)) best = val;
  }
  return best;
}

function extractDate(text) {
  for (const { re, order } of DATE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const parts = {};
    order.forEach((key, i) => {
      parts[key] = m[i + 1];
    });
    const year = parts.y;
    const month = parts.mon ? MONTHS[parts.mon.toLowerCase().slice(0, 3)] : Number(parts.m);
    const day = Number(parts.d);
    if (!year || !month || !day) continue;
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
  return null;
}

function extractCategory(text) {
  const lower = text.toLowerCase();
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (lower.includes(keyword)) return category;
  }
  return "other";
}

function extractVendorName(text) {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 2 && !/^\d/.test(l));
  return line ?? null;
}

export function heuristicExtract(text) {
  const gstinMatch = text.match(GSTIN_RE);
  return {
    document_type: "other",
    vendor_name: extractVendorName(text),
    invoice_number: null,
    invoice_date: extractDate(text),
    total_amount: extractAmount(text),
    currency: "INR",
    gstin: gstinMatch ? gstinMatch[0] : null,
    tax_amount: null,
    category_guess: extractCategory(text),
    confidence: "low",
    notes: "Extracted with offline heuristics (no AI credentials configured) — please verify all fields.",
  };
}
