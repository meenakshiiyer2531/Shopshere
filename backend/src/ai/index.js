/**
 * index.js — the AI facade used by the routes.
 *
 * interpret() asks SAP AI Core to turn natural language into an intent object;
 * if the model is unavailable or returns junk, it transparently falls back to
 * the deterministic parser. Either way the output is validated before use, and
 * the caller learns which engine answered ('aicore' | 'fallback').
 */
const aicore = require("./aicore");
const fallback = require("./fallback");
const { validateIntent } = require("./intent");
const config = require("../../config");

const SYSTEM_PROMPT = `You convert a shopper's request into a STRICT JSON object for an e-commerce database. Respond with JSON ONLY, no prose, no markdown.
Schema:
{
  "action": "search" | "add_to_cart" | "remove_from_cart" | "budget_basket" | "vibe",
  "filters": { "category": string|null, "text": string|null, "priceMin": number|null, "priceMax": number|null, "ratingMin": number|null },
  "sort": "price_asc" | "price_desc" | "rating_desc" | "newest" | null,
  "limit": number,
  "quantity": number|null,
  "budget": number|null,
  "vibe": string|null
}
Rules: category must be one of Electronics, Fashion, Home, Books or null. Prices are plain integers in rupees (e.g. "3k" -> 3000). For "add N of ..." use action add_to_cart and set quantity. For a total-budget request use action budget_basket and set budget. Keep "text" to the core product keywords only.`;

function stripFences(s) {
  return s
    .replaceAll(/```(?:json)?/gi, "")
    .replaceAll("```", "")
    .trim();
}

function vibeHint(feature) {
  if (feature === "budget") return "\nThis is a budget-basket request.";
  if (feature === "vibe") {
    return "\nThis is a mood/occasion search. Expand it into 3-6 concrete product keywords a catalog would use (e.g. 'coffee lover' -> 'coffee brew mug pour-over kettle'; 'cosy reading' -> 'book blanket lamp journal'). Put those space-separated keywords in filters.text, and set vibe to the user's original words.";
  }
  return "";
}

async function interpret(nl, feature = "ask") {
  if (config.ai.enabled) {
    try {
      const raw = await aicore.complete(SYSTEM_PROMPT + vibeHint(feature), nl);
      const parsed = JSON.parse(stripFences(raw));
      return { intent: validateIntent(parsed), engine: "aicore" };
    } catch (err) {
      // fall through to deterministic parser
      if (process.env.AI_DEBUG) console.warn("AI Core fell back:", err.message);
    }
  }
  return { intent: validateIntent(fallback.parse(nl, feature)), engine: "fallback" };
}

/** Optional natural-language phrasing of an explanation (never required). */
async function phrase(prompt) {
  if (!config.ai.enabled) return null;
  try {
    return (await aicore.complete("You are a concise shopping assistant. One short sentence, no markdown.", prompt)).trim();
  } catch {
    return null;
  }
}

module.exports = { interpret, phrase, SYSTEM_PROMPT };
