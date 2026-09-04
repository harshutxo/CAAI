export function money(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(Date.parse(str));
}
