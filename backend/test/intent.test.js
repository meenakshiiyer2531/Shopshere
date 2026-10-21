/**
 * Tests for the AI safety core (intent validation + parameterised SQL builder).
 * Run with:  npm test   (uses the built-in node:test runner — no dependencies).
 */
const { test } = require("node:test");
const assert = require("node:assert");
const {
  validateIntent,
  buildSearchQuery,
  buildVibeQuery,
} = require("../src/ai/intent");

test("validateIntent treats 0 price/rating/budget as unset (not a real filter)", () => {
  const v = validateIntent({
    filters: { category: "Electronics", priceMin: 0, priceMax: 0, ratingMin: 0 },
    budget: 0,
  });
  assert.equal(v.filters.priceMin, null);
  assert.equal(v.filters.priceMax, null);
  assert.equal(v.filters.ratingMin, null);
  assert.equal(v.budget, null);
  // ...and the built query must not contain a "price <= 0" clause.
  const { text } = buildSearchQuery(v);
  assert.ok(!text.includes("price <="));
});

test("validateIntent defaults unknown action to search", () => {
  assert.equal(validateIntent({ action: "DROP TABLE" }).action, "search");
});

test("validateIntent clamps rating and limit to safe ranges", () => {
  const v = validateIntent({ filters: { ratingMin: 99 }, limit: 9999 });
  assert.equal(v.filters.ratingMin, 5);
  assert.equal(v.limit, 50);
});

test("validateIntent rejects non-allowlisted sort keys", () => {
  assert.equal(validateIntent({ sort: "price_asc; DROP TABLE products" }).sort, null);
  assert.equal(validateIntent({ sort: "price_asc" }).sort, "price_asc");
});

test("buildSearchQuery fully parameterises values (no interpolation)", () => {
  const intent = validateIntent({
    filters: { category: "Electronics", priceMax: 3000, text: "headphones" },
    sort: "price_asc",
  });
  const { text, params } = buildSearchQuery(intent);
  // The SQL text must contain only placeholders, never the literal values.
  assert.match(text, /\$1/);
  assert.ok(!text.includes("Electronics"));
  assert.ok(!text.includes("3000"));
  assert.ok(params.includes("Electronics"));
  assert.ok(params.includes(3000));
});

test("buildSearchQuery neutralises SQL injection in the text filter", () => {
  const intent = validateIntent({
    filters: { text: "x'; DROP TABLE products; --" },
  });
  const { text, params } = buildSearchQuery(intent);
  // The malicious string travels as a bound parameter, never as SQL.
  assert.ok(!text.includes("DROP TABLE"));
  assert.ok(params.some((p) => String(p).includes("DROP TABLE")));
});

test("buildSearchQuery only emits allowlisted ORDER BY fragments", () => {
  const { text } = buildSearchQuery(validateIntent({ sort: "rating_desc" }));
  assert.match(text, /ORDER BY rating DESC/);
});

test("buildVibeQuery uses OR-ed to_tsquery terms when FTS is available", () => {
  const intent = validateIntent({ vibe: "cosy coffee gift", filters: { text: "coffee brew mug" } });
  const { text, params } = buildVibeQuery(intent, true);
  assert.match(text, /to_tsquery/);
  assert.match(text, /@@/);
  assert.equal(params[0], "coffee | brew | mug");
});

test("buildVibeQuery falls back to ILIKE when FTS is unavailable", () => {
  const intent = validateIntent({ vibe: "coffee brew", filters: { text: "coffee brew" } });
  const { text, params } = buildVibeQuery(intent, false);
  assert.match(text, /ILIKE/);
  assert.ok(params.every((p) => String(p).startsWith("%")));
});
