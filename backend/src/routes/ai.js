/**
 * ai.js — ShopSphere AI endpoints (the glass-box AI layer).
 *
 * The unified /chat endpoint powers the chatbot: it auto-detects whether the
 * message is shopping (search / vibe / budget) or customer care (refund /
 * return / track) and responds with a reply, product results, and the real SQL.
 * The legacy per-feature endpoints remain for direct use and tests.
 *
 * Safety: the language model never executes SQL. It returns a validated intent
 * and the backend builds a PARAMETERISED query (see src/ai/intent.js).
 */
const express = require("express");
const db = require("../db");
const ai = require("../ai");
const support = require("../ai/support");
const config = require("../../config");
const { buildSearchQuery, buildVibeQuery } = require("../ai/intent");

const router = express.Router();

const REFUNDABLE = new Set(["Confirmed", "Processing", "Shipped"]);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

/* ---------------- shared feature helpers ---------------- */

// Natural-language product search (with a recall retry).
async function doSearch(intent) {
  let { params, text, rendered } = buildSearchQuery(intent);
  let results = await db.runSelect(text, params);
  if (results.length === 0 && intent.filters.category && intent.filters.text) {
    const relaxed = { ...intent, filters: { ...intent.filters, text: null } };
    const q = buildSearchQuery(relaxed);
    const retry = await db.runSelect(q.text, q.params);
    if (retry.length) {
      results = retry;
      rendered = q.rendered;
    }
  }
  return { results, sql: rendered, mode: "search" };
}

// Mood/occasion search via Postgres full-text (with ILIKE recall fallback).
async function doVibe(intent, nl) {
  if (!intent.vibe) intent.vibe = nl;
  const hasFts = await db.hasFts();
  let { params, text, rendered } = buildVibeQuery(intent, hasFts);
  let results = await db.runSelect(text, params);
  let mode = hasFts ? "full-text" : "keyword";
  if (results.length === 0 && hasFts) {
    const kw = buildVibeQuery(intent, false);
    const retry = await db.runSelect(kw.text, kw.params);
    if (retry.length) {
      results = retry;
      rendered = kw.rendered;
      mode = "keyword";
    }
  }
  return { results, sql: rendered, mode };
}

// Assemble a complementary basket within a total budget.
async function doBudget(intent) {
  const budget = intent.budget || intent.filters.priceMax || 10000;
  const category = intent.filters.category || null;
  const candidates = await db.budgetCandidates({ category, maxPrice: budget, limit: 120 });

  const scored = candidates
    .map((p) => ({ p, score: (Number(p.rating) || 1) / Math.max(1, p.price) }))
    .sort((a, b) => b.score - a.score);

  const basket = [];
  let spent = 0;
  const seenCats = new Set();
  for (const { p } of scored) {
    if (spent + p.price <= budget && !seenCats.has(p.category)) {
      basket.push(p);
      spent += p.price;
      seenCats.add(p.category);
    }
  }
  for (const { p } of scored) {
    if (basket.some((b) => b.id === p.id)) continue;
    if (spent + p.price <= budget) {
      basket.push(p);
      spent += p.price;
    }
  }

  const rendered =
    `SELECT * FROM products` +
    (category ? ` WHERE category = '${category}' AND price <= ${budget}` : ` WHERE price <= ${budget}`) +
    ` ORDER BY rating DESC NULLS LAST, price ASC;  -- then greedy fill under ₹${budget}`;
  return { basket, spent, budget, sql: rendered };
}

// Customer-care resolution: tracks orders and runs refunds/returns.
async function doSupport(message, cls) {
  const orderId = (cls.orderId || "").toString().trim() || null;
  const order = orderId ? await db.getOrder(orderId) : null;
  let reply;
  let action = null;
  let ticket = null;
  let sql = null;

  // A general "how does X work / what is your policy" question should be
  // answered as FAQ, not treated as an actionable refund/return request.
  const asksPolicy =
    !order && /policy|how (do|long|can|does)|what('?s| is| are)|do you|can i|process|charged?|time/i.test(message);
  let topic = cls.topic;
  if (asksPolicy && topic !== "track") topic = "general";

  const openTicket = (tp, resolution, status, refundAmount) =>
    db.createTicket({
      order_id: order ? order.id : null,
      topic: tp,
      message,
      resolution,
      status,
      refund_amount: refundAmount ?? null,
    });

  if (["refund", "cancel", "damaged"].includes(topic)) {
    if (!order) {
      reply = 'I can help with that refund. What is your order ID? (It looks like "oab12cd" and is on your Orders page.)';
    } else if (!REFUNDABLE.has(order.status) && order.status !== "Delivered") {
      reply = `Order ${order.id} is already "${order.status}", so no new refund is needed. Anything else?`;
      ticket = await openTicket(cls.topic, `No action — status ${order.status}`, "Closed");
    } else {
      const updated = await db.updateOrderStatus(order.id, "Refund Initiated");
      sql = `UPDATE orders SET status = 'Refund Initiated' WHERE id = '${order.id}';`;
      ticket = await openTicket(cls.topic, `Refund of ${inr(order.total)} to original payment method`, "Resolved", order.total);
      action = { type: "refund", orderId: order.id, amount: order.total, newStatus: updated.status };
      reply =
        `Done — I've initiated a full refund of ${inr(order.total)} for order ${order.id}. ` +
        `It returns to your original payment method in 5–7 business days, and the order is now ` +
        `"Refund Initiated". Ticket #${ticket.id} is logged. Anything else?`;
    }
  } else if (topic === "return") {
    if (!order) {
      reply = "Sure, I can set up a return. What's your order ID?";
    } else {
      ticket = await openTicket("return", "Return pickup scheduled (2–3 days)", "In Progress");
      action = { type: "return", orderId: order.id };
      reply =
        `I've scheduled a free return pickup for order ${order.id} in 2–3 business days. ` +
        `Once we receive the item your refund of ${inr(order.total)} is processed automatically. ` +
        `Ticket #${ticket.id} is logged.`;
    }
  } else if (topic === "track") {
    if (!order) {
      reply = "I can track that for you — what's your order ID?";
    } else {
      sql = `SELECT id, status, date, total FROM orders WHERE id = '${order.id}';`;
      const when = new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const stageMsg =
        {
          Confirmed: "is confirmed and being prepared",
          Processing: "is being processed at our warehouse",
          Shipped: "has shipped and is on the way",
          Delivered: "has been delivered",
          Cancelled: "was cancelled",
          "Refund Initiated": "has a refund in progress",
        }[order.status] || `is "${order.status}"`;
      reply = `Order ${order.id} (placed ${when}, ${inr(order.total)}) ${stageMsg}.`;
    }
  } else {
    const phrased = await ai.phrase(
      `You are ShopSphere support. Answer this shopper politely in 1–2 sentences using these policies: ` +
        `free delivery over ₹4,999; 7-day easy returns; refunds in 5–7 business days to the original payment ` +
        `method; pay by card/UPI via Razorpay. Question: "${message}"`
    );
    reply =
      phrased ||
      "Happy to help! We offer free delivery over ₹4,999, 7-day returns, and refunds within 5–7 business days. " +
        "Ask me about an order, a refund, or a return anytime.";
  }
  return { reply, action, ticket, sql, order: order || null, topic };
}

/* ---------------- unified chatbot endpoint ---------------- */

// POST /api/ai/chat — one message in, a conversational reply + results out.
router.post("/chat", async (req, res, next) => {
  try {
    const message = (req.body?.message || req.body?.nl || "").toString();
    if (!message.trim()) return res.status(400).json({ error: "message is required" });

    const route = await ai.interpretChat(message);

    if (route.kind === "support") {
      const r = await doSupport(message, route.support);
      await db.logAiQuery({
        feature: "support",
        nl_text: message,
        intent: { topic: route.support.topic, orderId: route.support.orderId },
        generated_sql: r.sql,
        result_count: r.ticket ? 1 : 0,
        engine: route.engine,
      });
      return res.json({ kind: "support", engine: route.engine, reply: r.reply, ...r, products: [] });
    }

    // kind === "shop"
    const intent = route.intent;
    let payload;
    let feature = "ask";
    if (intent.action === "budget_basket") {
      const b = await doBudget(intent);
      payload = { kind: "shop", mode: "budget", products: b.basket, sql: b.sql, spent: b.spent, budget: b.budget };
      feature = "budget";
    } else if (intent.action === "vibe") {
      const v = await doVibe(intent, message);
      payload = { kind: "shop", mode: v.mode, products: v.results, sql: v.sql };
      feature = "vibe";
    } else {
      const s = await doSearch(intent);
      payload = { kind: "shop", mode: s.mode, products: s.results, sql: s.sql, cartAction: intent.action, quantity: intent.quantity };
    }

    // A friendly reply: use the model's, else synthesise one from the result.
    let reply = route.reply;
    if (!reply) {
      const n = payload.products.length;
      reply =
        feature === "budget"
          ? `Here's a basket of ${n} item(s) for about ${inr(payload.spent)} within your ${inr(payload.budget)} budget.`
          : n
          ? `Found ${n} product${n === 1 ? "" : "s"} for you.`
          : "I couldn't find a match — try different words or a higher budget.";
    }

    await db.logAiQuery({
      feature,
      nl_text: message,
      intent,
      generated_sql: payload.sql,
      result_count: payload.products.length,
      engine: route.engine,
    });

    res.json({ engine: route.engine, reply, ...payload });
  } catch (err) {
    next(err);
  }
});

/* ---------------- legacy per-feature endpoints ---------------- */

router.post("/ask", async (req, res, next) => {
  try {
    const nl = (req.body?.nl || "").toString();
    if (!nl.trim()) return res.status(400).json({ error: "nl is required" });
    const { intent, engine } = await ai.interpret(nl, "ask");
    const s = await doSearch(intent);
    await db.logAiQuery({ feature: "ask", nl_text: nl, intent, generated_sql: s.sql, result_count: s.results.length, engine });
    res.json({ intent, engine, sql: s.sql, results: s.results });
  } catch (err) {
    next(err);
  }
});

router.post("/vibe", async (req, res, next) => {
  try {
    const nl = (req.body?.nl || "").toString();
    if (!nl.trim()) return res.status(400).json({ error: "nl is required" });
    const { intent, engine } = await ai.interpret(nl, "vibe");
    const v = await doVibe(intent, nl);
    await db.logAiQuery({ feature: "vibe", nl_text: nl, intent, generated_sql: v.sql, result_count: v.results.length, engine });
    res.json({ intent, engine, mode: v.mode, sql: v.sql, results: v.results });
  } catch (err) {
    next(err);
  }
});

router.post("/budget", async (req, res, next) => {
  try {
    const nl = (req.body?.nl || "").toString();
    if (!nl.trim()) return res.status(400).json({ error: "nl is required" });
    const { intent, engine } = await ai.interpret(nl, "budget");
    const b = await doBudget(intent);
    let explanation = `Picked ${b.basket.length} item(s) totalling ${inr(b.spent)} within your ${inr(b.budget)} budget.`;
    const phrased = await ai.phrase(
      `In one short sentence, describe this budget basket: ${b.basket.map((x) => `${x.name} (₹${x.price})`).join(", ")}. Total ₹${b.spent}, budget ₹${b.budget}.`
    );
    if (phrased) explanation = phrased;
    await db.logAiQuery({ feature: "budget", nl_text: nl, intent, generated_sql: b.sql, result_count: b.basket.length, engine });
    res.json({ intent, engine, budget: b.budget, spent: b.spent, basket: b.basket, explanation, sql: b.sql });
  } catch (err) {
    next(err);
  }
});

router.post("/support", async (req, res, next) => {
  try {
    const message = (req.body?.message || "").toString();
    if (!message.trim()) return res.status(400).json({ error: "message is required" });
    const cls = await support.classify(message);
    if (req.body?.orderId) cls.orderId = req.body.orderId;
    const r = await doSupport(message, cls);
    await db.logAiQuery({
      feature: "support",
      nl_text: message,
      intent: { topic: cls.topic, orderId: cls.orderId },
      generated_sql: r.sql,
      result_count: r.ticket ? 1 : 0,
      engine: cls.engine,
    });
    res.json({ topic: r.topic, engine: cls.engine, order: r.order, action: r.action, ticket: r.ticket, reply: r.reply, sql: r.sql });
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/recommend?productId=&limit= — explainable co-purchase recommender.
router.get("/recommend", async (req, res, next) => {
  try {
    const { productId } = req.query;
    const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 4));
    if (!productId) return res.status(400).json({ error: "productId is required" });

    let items = await db.coPurchase(productId, limit);
    let reason = "People who bought this item also bought these.";
    let basis = "co-purchase";

    if (items.length === 0) {
      const seed = await db.getProduct(productId);
      items = await db.topRated({ category: seed?.category, excludeId: productId, limit });
      reason = seed ? `Top-rated picks in ${seed.category}.` : "Top-rated picks for you.";
      basis = "top-rated";
    }

    res.json({
      basis,
      reason,
      items,
      sql: basis === "co-purchase" ? db.coPurchaseSql : "SELECT * FROM products WHERE category = $1 AND id <> $2 ORDER BY rating DESC LIMIT $3",
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/price-meter/:productId — Fair-Price Meter (window function).
router.get("/price-meter/:productId", async (req, res, next) => {
  try {
    const row = await db.priceMeter(req.params.productId);
    if (!row) return res.status(404).json({ error: "Product not found" });
    const pr = Number(row.pr);
    res.json({
      category: row.category,
      price: row.price,
      min: Number(row.min_p),
      avg: Number(row.avg_p),
      max: Number(row.max_p),
      count: Number(row.n),
      percentile: pr,
      cheaperThanPct: Math.round((1 - pr) * 100),
      sql: db.priceMeterSql,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/log?limit= — recent AI interactions (admin "AI Insights").
router.get("/log", async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json(await db.getAiLog(limit));
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/tickets?limit= — recent support tickets (admin "AI Insights").
router.get("/tickets", async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json(await db.getTickets(limit));
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/status — which engine is active (handy for the UI badge).
router.get("/status", (_req, res) => {
  res.json({ engine: config.ai.enabled ? "aicore" : "fallback", model: config.ai.enabled ? config.ai.model : null });
});

module.exports = router;
