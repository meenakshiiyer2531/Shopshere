/**
 * intent.js — the safety core of ShopSphere AI.
 *
 * The LLM never writes SQL we execute. It returns a loose "intent" object; this
 * module validates it against a strict allowlist and then builds a fully
 * PARAMETERISED SQL query. Only the parameterised query is ever sent to
 * Postgres, so user/model text can never be interpreted as SQL (injection
 * prevention). A human-readable rendering is produced separately, for display
 * in the glass-box panel only.
 */

const ACTIONS = ["search", "add_to_cart", "remove_from_cart", "budget_basket", "vibe"];

// Common words to drop when turning a "vibe" phrase into search keywords.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "some", "any", "gift", "want",
  "need", "looking", "something", "give", "buy", "under", "over", "from", "who",
  "likes", "love", "loves", "lover", "into", "good", "nice", "best",
]);

// Sort keys are NOT parameterisable (they are SQL fragments), so they must come
// from this fixed allowlist — never from raw model output.
const SORTS = {
  price_asc: "price ASC",
  price_desc: "price DESC",
  rating_desc: "rating DESC NULLS LAST",
  newest: "created_at DESC",
  relevance: null, // handled per-feature
};

function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

// Like clampNum, but treats 0 (and blanks) as "unset" -> null. LLMs often fill
// unused numeric fields with 0, which must NOT become a real filter such as
// `price <= 0` (which would match nothing).
function optNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(max, Math.max(min, n));
}

function cleanText(v, maxLen = 120) {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, maxLen);
  return t.length ? t : null;
}

/**
 * Normalise a raw intent (from the LLM or the fallback parser) into a safe,
 * fully-validated intent. Unknown fields are dropped; numbers are clamped.
 */
function validateIntent(raw = {}) {
  const action = ACTIONS.includes(raw.action) ? raw.action : "search";
  const f = raw.filters || {};
  const filters = {
    category: cleanText(f.category, 40),
    text: cleanText(f.text, 80),
    priceMin: optNum(f.priceMin, 0, 100_000_000),
    priceMax: optNum(f.priceMax, 0, 100_000_000),
    ratingMin: optNum(f.ratingMin, 0, 5),
  };
  const sort = Object.hasOwn(SORTS, raw.sort) ? raw.sort : null;

  return {
    action,
    filters,
    sort,
    limit: clampNum(raw.limit, 1, 50) || 20,
    quantity: clampNum(raw.quantity, 1, 99) || 1,
    budget: optNum(raw.budget, 0, 100_000_000),
    vibe: cleanText(raw.vibe || raw.filters?.vibe, 120),
  };
}

/** Build a parameterised product-search query from a validated intent. */
function buildSearchQuery(intent) {
  const where = [];
  const params = [];
  const { filters } = intent;

  if (filters.category) {
    params.push(filters.category);
    where.push(`LOWER(category) = LOWER($${params.length})`);
  }
  if (filters.priceMin != null) {
    params.push(filters.priceMin);
    where.push(`price >= $${params.length}`);
  }
  if (filters.priceMax != null) {
    params.push(filters.priceMax);
    where.push(`price <= $${params.length}`);
  }
  if (filters.ratingMin != null) {
    params.push(filters.ratingMin);
    where.push(`rating >= $${params.length}`);
  }
  if (filters.text) {
    params.push(`%${filters.text}%`);
    where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }

  const orderBy = SORTS[intent.sort] || "rating DESC NULLS LAST";
  params.push(intent.limit);
  const limitIdx = params.length;

  const text =
    `SELECT * FROM products` +
    (where.length ? `\nWHERE ${where.join("\n  AND ")}` : "") +
    `\nORDER BY ${orderBy}\nLIMIT $${limitIdx}`;

  return { text, params, rendered: render(text, params) };
}

/**
 * Build a parameterised full-text "vibe" query. Falls back to ILIKE when the
 * products table has no search_vector column (hasFts = false). Uses OR
 * semantics so a mood like "cosy coffee gift" matches any of its keywords.
 */
function buildVibeQuery(intent, hasFts) {
  const source = intent.filters.text || intent.vibe || "";
  const words = source
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8);
  const params = [];

  if (hasFts && words.length) {
    params.push(words.join(" | ")); // OR-ed tsquery terms
    const q = `to_tsquery('english', $1)`;
    const priceClause = priceWhere(intent, params);
    const where = [`search_vector @@ ${q}`].concat(priceClause);
    const text =
      `SELECT *, ts_rank(search_vector, ${q}) AS rank\n` +
      `FROM products\nWHERE ${where.join("\n  AND ")}\n` +
      `ORDER BY rank DESC, rating DESC NULLS LAST\nLIMIT ${intent.limit}`;
    return { text, params, rendered: render(text, params) };
  }

  // Fallback: match any keyword with ILIKE.
  const likeOr = words
    .map((w) => {
      params.push(`%${w}%`);
      return `name ILIKE $${params.length} OR description ILIKE $${params.length}`;
    })
    .join(" OR ");
  const text =
    `SELECT * FROM products` +
    (likeOr ? `\nWHERE (${likeOr})` : "") +
    `\nORDER BY rating DESC NULLS LAST\nLIMIT ${intent.limit}`;
  return { text, params, rendered: render(text, params) };
}

function priceWhere(intent, params) {
  const clauses = [];
  if (intent.filters.priceMax != null) {
    params.push(intent.filters.priceMax);
    clauses.push(`price <= $${params.length}`);
  }
  if (intent.filters.priceMin != null) {
    params.push(intent.filters.priceMin);
    clauses.push(`price >= $${params.length}`);
  }
  return clauses;
}

/** Inline params into the SQL for READ-ONLY display (never executed). */
function render(text, params) {
  return text.replace(/\$(\d+)/g, (_, n) => {
    const v = params[Number(n) - 1];
    return typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`;
  });
}

module.exports = {
  ACTIONS,
  SORTS,
  validateIntent,
  buildSearchQuery,
  buildVibeQuery,
  render,
};
