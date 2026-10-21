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

// ---- Unified chatbot classifier ----

const CATS =
  "Electronics (gadgets, audio, computers, cameras, wearables), " +
  "Fashion (clothing, shoes & footwear, bags, watches, sunglasses, accessories), " +
  "Home (kitchen, cookware, decor, bedding, lamps, appliances), " +
  "Books, " +
  "Beauty (skincare, makeup, fragrance, haircare), " +
  "Sports (fitness equipment, outdoor & game gear), " +
  "Toys (kids' toys & games), " +
  "Grocery (food & drink)";

const CHAT_SYSTEM = `You are ShopSphere's shopping assistant. Read the user's message and reply with STRICT JSON only (no prose, no markdown):
{
  "kind": "shop" | "support",
  "reply": "<one short, friendly sentence to show the user>",
  "shop": {
    "action": "search" | "budget_basket" | "vibe" | "add_to_cart" | "remove_from_cart",
    "filters": { "category": string|null, "text": string|null, "priceMin": number|null, "priceMax": number|null, "ratingMin": number|null },
    "sort": "price_asc" | "price_desc" | "rating_desc" | "newest" | null,
    "limit": number, "quantity": number|null, "budget": number|null, "vibe": string|null
  },
  "support": { "topic": "track"|"refund"|"cancel"|"return"|"damaged"|"general", "orderId": string|null, "reason": string|null }
}
Rules:
- kind = "support" for order status, refunds, returns, cancellations, damaged/wrong items. Otherwise kind = "shop".
- category must be one of ${CATS} or null.
- Prices are plain integers in rupees ("3k" -> 3000). Use null (NOT 0) for any price/rating/budget the user did not state.
- action = "budget_basket" when the user gives a total amount to spend on a set/kit; "vibe" for a mood/occasion/gift; "add_to_cart" for "add N of ..."; else "search".
- For "vibe", put 3-6 concrete catalog keywords (expand synonyms) in filters.text and the user's words in vibe.
- "reply" is natural and specific, e.g. "Here are some great wireless headphones under ₹5,000." For support, confirm what you'll do.`;

function routeFallback(nl) {
  const text = (nl || "").toLowerCase();
  const isSupport = /\b(refund|return|cancel|damag|broken|defect|track|where is|delivery|order\s+o[a-z0-9]{4,}|money back)\b/.test(text);
  if (isSupport) {
    let topic = "general";
    if (/refund|money back/.test(text)) topic = "refund";
    else if (/damag|broken|defect|wrong/.test(text)) topic = "damaged";
    else if (/cancel/.test(text)) topic = "cancel";
    else if (/return|exchange/.test(text)) topic = "return";
    else if (/track|where|status|delivery/.test(text)) topic = "track";
    const m = nl.match(/\bo[a-z0-9]{5,8}\b/i);
    return { kind: "support", support: { topic, orderId: m ? m[0] : null, reason: null }, reply: null, engine: "fallback" };
  }
  const feature = /\bbudget|setup|kit|spend|build me|for \d/.test(text) ? "budget" : "ask";
  const intent = validateIntent(fallback.parse(nl, feature));
  return { kind: "shop", intent, reply: null, engine: "fallback" };
}

async function interpretChat(nl) {
  if (config.ai.enabled) {
    try {
      const raw = await aicore.complete(CHAT_SYSTEM, nl);
      const p = JSON.parse(stripFences(raw));
      if (p.kind === "support") {
        const s = p.support || {};
        return {
          kind: "support",
          support: { topic: s.topic || "general", orderId: s.orderId || null, reason: s.reason || null },
          reply: typeof p.reply === "string" ? p.reply : null,
          engine: "aicore",
        };
      }
      return {
        kind: "shop",
        intent: validateIntent(p.shop || {}),
        reply: typeof p.reply === "string" ? p.reply : null,
        engine: "aicore",
      };
    } catch {
      /* fall through */
    }
  }
  return routeFallback(nl);
}

module.exports = { interpret, interpretChat, phrase, SYSTEM_PROMPT };
