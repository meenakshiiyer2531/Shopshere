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

const CHAT_SYSTEM = `You are ShopSphere's friendly shopping assistant. Read the user's message and reply with STRICT JSON only (no prose, no markdown):
{
  "kind": "shop" | "support" | "chat",
  "reply": "<one warm, natural sentence to show the user>",
  "shop": {
    "action": "search" | "budget_basket" | "vibe" | "add_to_cart" | "remove_from_cart",
    "filters": { "category": string|null, "text": string|null, "priceMin": number|null, "priceMax": number|null, "ratingMin": number|null },
    "sort": "price_asc" | "price_desc" | "rating_desc" | "newest" | null,
    "limit": number, "quantity": number|null, "budget": number|null, "vibe": string|null
  },
  "support": { "topic": "track"|"refund"|"cancel"|"return"|"damaged"|"general", "orderId": string|null, "reason": string|null }
}
Departments (category): ${CATS}.
How to classify:
- kind="support": order status/tracking, refunds, returns, cancellations, damaged/wrong items, or questions about policies.
- kind="chat": greetings, thanks, or vague "what can you do" messages with NO concrete product need. Reply warmly and suggest what they can ask; omit shop/support.
- kind="shop": they want to find or buy products.
  * action="vibe" for a mood, occasion, gift, or recipient ("gift for a coffee lover", "something cosy for winter", "present for my mum"). Put 3-6 concrete catalog keywords in filters.text (expand synonyms, e.g. coffee -> "coffee brew mug pour-over kettle") and the user's words in vibe. A price like "under 3000" goes in filters.priceMax — NOT budget.
  * action="budget_basket" ONLY when they want MULTIPLE complementary items for a total spend — signalled by words like setup, kit, combo, bundle, outfit, wardrobe, "build me", "everything for". Put the amount in budget.
  * action="add_to_cart"/"remove_from_cart" for cart edits ("add 2 of ...").
  * otherwise action="search" (a specific product type, with any category/price/rating/sort).
Rules: category must be an exact department name or null. Prices are plain integers in rupees ("3k"->3000). Use null (NOT 0) for anything the user did not state. "reply" is specific and friendly, e.g. "Here are some lovely gifts a coffee lover would enjoy under ₹3,000."`;

function routeFallback(nl) {
  const text = (nl || "").toLowerCase();

  // Greetings / small talk / help.
  if (/^\s*(hi|hey|hello|yo|hiya|good (morning|evening|afternoon)|thanks|thank you|ok|okay|help|what can you do)\b/.test(text)) {
    return {
      kind: "chat",
      reply:
        "Hi! I can find products (\"wireless headphones under 5000\"), suggest gifts (\"something for a coffee lover\"), build a basket to a budget (\"home office setup for 15000\"), or help with an order or refund. What would you like?",
      engine: "fallback",
    };
  }

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

  // budget_basket only for real "set/kit/bundle" language; gifts are vibe.
  const isBudget = /\b(setup|kit|combo|bundle|outfit|wardrobe|build me|everything for)\b/.test(text);
  const isGift = /\b(gift|present|for (my|a|someone)|something (for|cosy|cozy|nice)|occasion|birthday|anniversary)\b/.test(text);
  const feature = isBudget ? "budget" : isGift ? "vibe" : "ask";
  const intent = validateIntent(fallback.parse(nl, feature));
  if (feature === "vibe" && !intent.vibe) intent.vibe = nl;
  return { kind: "shop", intent, reply: null, engine: "fallback" };
}

async function interpretChat(nl) {
  if (config.ai.enabled) {
    try {
      const raw = await aicore.complete(CHAT_SYSTEM, nl);
      const p = JSON.parse(stripFences(raw));
      if (p.kind === "chat") {
        return { kind: "chat", reply: typeof p.reply === "string" ? p.reply : "How can I help you shop today?", engine: "aicore" };
      }
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
