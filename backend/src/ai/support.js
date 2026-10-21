/**
 * support.js — intent classifier for the AI customer-care assistant.
 *
 * Classifies a shopper's support message into a topic and extracts an order id
 * and reason. Uses SAP AI Core when available, with a deterministic keyword
 * classifier as fallback so support always works. The backend (routes/ai.js)
 * performs the actual database actions (refund, ticket) deterministically from
 * this classification — the model never mutates data directly.
 */
const aicore = require("./aicore");
const config = require("../../config");

const TOPICS = ["track", "refund", "cancel", "return", "damaged", "general"];

const SYSTEM = `You are ShopSphere's customer-care triage. Classify the user's message and return STRICT JSON only (no prose, no markdown):
{ "topic": "track" | "refund" | "cancel" | "return" | "damaged" | "general",
  "orderId": string|null,   // e.g. "oab12cd" if the user mentions one
  "reason": string|null }   // short phrase describing the problem
Pick "refund" for money-back requests, "cancel" to stop an order, "return" to send an item back, "damaged" for broken/wrong items (which also warrants a refund), "track" for delivery status, "general" for everything else.`;

function stripFences(s) {
  return s.replaceAll(/```(?:json)?/gi, "").replaceAll("```", "").trim();
}

// Extract a ShopSphere order id like "oab12cd" (prefix o + 6 base36 chars).
function findOrderId(text) {
  const m = text.match(/\bo[a-z0-9]{5,8}\b/i);
  return m ? m[0] : null;
}

function keywordClassify(message) {
  const t = message.toLowerCase();
  let topic = "general";
  if (/\b(refund|money back|reimburse|charged|double charge)\b/.test(t)) topic = "refund";
  else if (/\b(damag|broken|defect|wrong item|not working|faulty)\b/.test(t)) topic = "damaged";
  else if (/\b(cancel)\b/.test(t)) topic = "cancel";
  else if (/\b(return|send back|exchange)\b/.test(t)) topic = "return";
  else if (/\b(track|where|status|delivery|shipped|arrive|when will)\b/.test(t)) topic = "track";
  return { topic, orderId: findOrderId(message), reason: null };
}

async function classify(message) {
  if (config.ai.enabled) {
    try {
      const raw = await aicore.complete(SYSTEM, message);
      const parsed = JSON.parse(stripFences(raw));
      const topic = TOPICS.includes(parsed.topic) ? parsed.topic : "general";
      return {
        topic,
        orderId: parsed.orderId || findOrderId(message),
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 160) : null,
        engine: "aicore",
      };
    } catch {
      /* fall through */
    }
  }
  return { ...keywordClassify(message), engine: "fallback" };
}

module.exports = { classify, TOPICS };
