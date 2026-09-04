import test from "node:test";
import assert from "node:assert/strict";
import { money, isValidDate } from "../src/lib/format.js";

test("money formats with two decimals and thousands grouping", () => {
  assert.equal(money(50000), "50,000.00");
  assert.equal(money(0), "0.00");
  assert.equal(money("1234.5"), "1,234.50");
});

test("money treats non-numeric input as zero", () => {
  assert.equal(money("not a number"), "0.00");
  assert.equal(money(undefined), "0.00");
});

test("isValidDate accepts only well-formed YYYY-MM-DD dates", () => {
  assert.equal(isValidDate("2026-09-04"), true);
  assert.equal(isValidDate("04-09-2026"), false);
  assert.equal(isValidDate("not-a-date"), false);
  assert.equal(isValidDate("2026-13-40"), false);
});
