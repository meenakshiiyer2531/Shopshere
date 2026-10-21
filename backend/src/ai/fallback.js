/**
 * fallback.js — deterministic natural-language parser.
 *
 * Converts common shopping phrasings into the same loose intent shape the LLM
 * produces, using keywords and regexes. This guarantees every AI feature works
 * with no network, no credentials and zero cost — so a live demo never breaks.
 * The result is still passed through validateIntent() before use.
 */

const CATEGORY_WORDS = {
  Electronics: ["electronic", "gadget", "headphone", "speaker", "camera", "watch", "keyboard", "tech", "laptop", "phone", "stream"],
  Fashion: ["fashion", "shoe", "clothes", "clothing", "jacket", "sweater", "sunglass", "backpack", "wear", "apparel"],
  Home: ["home", "kitchen", "lamp", "plant", "duvet", "skillet", "decor", "furniture", "pour-over", "coffee"],
  Books: ["book", "novel", "read", "journal", "reading"],
};

function detectCategory(text) {
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
    if (words.some((w) => text.includes(w))) return cat;
  }
  return null;
}

function num(match) {
  return match ? Number(match.replace(/[,\s]/g, "")) : null;
}

/**
 * @param {string} nl    raw user text
 * @param {string} feature  'ask' | 'budget' | 'vibe'
 */
function parse(nl, feature = "ask") {
  const text = (nl || "").toLowerCase();

  // Price bounds: "under 3000", "below 5k", "between 2000 and 5000", "over 1000"
  const k = (s) => s.replace(/(\d+)\s*k\b/g, (_, d) => d + "000");
  const t = k(text);
  let priceMax = null;
  let priceMin = null;
  const between = t.match(/between\s+([\d,]+)\s+and\s+([\d,]+)/);
  if (between) {
    priceMin = num(between[1]);
    priceMax = num(between[2]);
  } else {
    const under = t.match(/(?:under|below|less than|upto|up to|cheaper than|within)\s*(?:₹|rs\.?)?\s*([\d,]+)/);
    if (under) priceMax = num(under[1]);
    const over = t.match(/(?:over|above|more than|at least)\s*(?:₹|rs\.?)?\s*([\d,]+)/);
    if (over) priceMin = num(over[1]);
  }

  // Rating: "rated above 4", "4 stars", "4+"
  const rating = t.match(/(?:rated|rating|stars?)\D*(\d(?:\.\d)?)/) || t.match(/(\d(?:\.\d)?)\s*\+?\s*stars?/);
  const ratingMin = rating ? Number(rating[1]) : null;

  // Sort
  let sort = null;
  if (/cheap|low(est)? price|budget|affordable/.test(t)) sort = "price_asc";
  else if (/expensive|premium|high(est)? price|costl/.test(t)) sort = "price_desc";
  else if (/best|top rated|highly rated|popular|rating/.test(t)) sort = "rating_desc";
  else if (/new|latest/.test(t)) sort = "newest";

  // Budget: "I have 15000", "budget of 15000", "for 15000"
  const budgetM = t.match(/(?:budget|have|for|with|spend)\D*?([\d,]{3,})/);
  const budget = feature === "budget" ? num(budgetM && budgetM[1]) || priceMax : null;

  // Cart verbs
  let action = "search";
  let quantity = 1;
  if (feature === "budget") action = "budget_basket";
  else if (feature === "vibe") action = "vibe";
  else if (/\b(add|buy|put)\b/.test(t)) {
    action = "add_to_cart";
    const qm = t.match(/\b(\d+)\b/);
    if (qm) quantity = Number(qm[1]);
  } else if (/\b(remove|delete|drop|take out)\b/.test(t)) {
    action = "remove_from_cart";
  }

  const category = detectCategory(t);

  // Free-text term: strip out the structural words so a keyword search is useful.
  const term = text
    .replace(/(under|below|less than|upto|up to|over|above|more than|between|and|rated|rating|stars?|cheapest|cheap|best|top|add|remove|buy|₹|rs\.?|budget|for a|for|the|me|show|find|a|an|with|of|under)\b/g, " ")
    .replace(/[\d,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    action,
    filters: { category, text: term || null, priceMin, priceMax, ratingMin },
    sort,
    limit: 20,
    quantity,
    budget,
    vibe: feature === "vibe" ? nl : null,
  };
}

module.exports = { parse };
