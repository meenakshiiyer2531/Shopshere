/**
 * ai.js — ShopSphere AI endpoints (the glass-box AI layer).
 *
 * Every handler: validate input -> interpret intent (SAP AI Core or fallback)
 * -> build a PARAMETERISED query -> run it -> log to ai_query_log -> respond
 * with both the results AND the SQL, so the UI can show the database work.
 */
const express = require("express");
const db = require("../db");
const ai = require("../ai");
const support = require("../ai/support");
const { buildSearchQuery, buildVibeQuery } = require("../ai/intent");

const router = express.Router();

// POST /api/ai/ask — natural-language product search + conversational cart.
router.post("/ask", async (req, res, next) => {
  try {
    const nl = (req.body?.nl || "").toString();
    if (!nl.trim()) return res.status(400).json({ error: "nl is required" });

    const { intent, engine } = await ai.interpret(nl, "ask");

    // Cart actions resolve to matching products; the client performs the
    // actual add/remove against its localStorage cart.
    const { text, params, rendered } = buildSearchQuery(intent);
    const results = await db.runSelect(text, params);

    await db.logAiQuery({
      feature: "ask",
      nl_text: nl,
      intent,
      generated_sql: rendered,
      result_count: results.length,
      engine,
    });

    res.json({ intent, engine, sql: rendered, results });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/vibe — mood/occasion search via Postgres full-text search.
router.post("/vibe", async (req, res, next) => {
  try {
    const nl = (req.body?.nl || "").toString();
    if (!nl.trim()) return res.status(400).json({ error: "nl is required" });

    const { intent, engine } = await ai.interpret(nl, "vibe");
    if (!intent.vibe) intent.vibe = nl;

    const hasFts = await db.hasFts();
    let { text, params, rendered } = buildVibeQuery(intent, hasFts);
    let results = await db.runSelect(text, params);
    let mode = hasFts ? "full-text" : "keyword";

    // Recall fallback: if full-text found nothing, retry with keyword ILIKE.
    if (results.length === 0 && hasFts) {
      const kw = buildVibeQuery(intent, false);
      results = await db.runSelect(kw.text, kw.params);
      if (results.length) {
        rendered = kw.rendered;
        mode = "keyword";
      }
    }

    await db.logAiQuery({
      feature: "vibe",
      nl_text: nl,
      intent,
      generated_sql: rendered,
      result_count: results.length,
      engine,
    });

    res.json({ intent, engine, mode, sql: rendered, results });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/budget — assemble a complementary cart within a total budget.
router.post("/budget", async (req, res, next) => {
  try {
    const nl = (req.body?.nl || "").toString();
    if (!nl.trim()) return res.status(400).json({ error: "nl is required" });

    const { intent, engine } = await ai.interpret(nl, "budget");
    const budget = intent.budget || intent.filters.priceMax || 10000;
    const category = intent.filters.category || null;

    const candidates = await db.budgetCandidates({
      category,
      maxPrice: budget,
      limit: 80,
    });

    // Greedy selection: best value-per-rupee first, one per product, until the
    // budget is spent. Simple, explainable, and always terminates.
    const scored = candidates
      .map((p) => ({ p, score: (Number(p.rating) || 1) / Math.max(1, p.price) }))
      .sort((a, b) => b.score - a.score);

    const basket = [];
    let spent = 0;
    const seenCats = new Set();
    // First pass: diversify across categories for a useful "setup".
    for (const { p } of scored) {
      if (spent + p.price <= budget && !seenCats.has(p.category)) {
        basket.push(p);
        spent += p.price;
        seenCats.add(p.category);
      }
    }
    // Second pass: fill remaining budget with the next best items.
    for (const { p } of scored) {
      if (basket.some((b) => b.id === p.id)) continue;
      if (spent + p.price <= budget) {
        basket.push(p);
        spent += p.price;
      }
    }

    let explanation =
      `Picked ${basket.length} item(s) totalling ₹${spent.toLocaleString("en-IN")} ` +
      `(within your ₹${budget.toLocaleString("en-IN")} budget), favouring the best ` +
      `rating for the price` + (category ? ` in ${category}` : " across categories") + ".";
    const phrased = await ai.phrase(
      `In one short sentence, describe this budget shopping basket for the shopper: ` +
        basket.map((b) => `${b.name} (₹${b.price})`).join(", ") +
        `. Total ₹${spent}, budget ₹${budget}.`
    );
    if (phrased) explanation = phrased;

    const rendered =
      `SELECT * FROM products` +
      (category ? ` WHERE category = '${category}' AND price <= ${budget}` : ` WHERE price <= ${budget}`) +
      ` ORDER BY rating DESC NULLS LAST, price ASC;  -- then greedy fill under ₹${budget}`;

    await db.logAiQuery({
      feature: "budget",
      nl_text: nl,
      intent,
      generated_sql: rendered,
      result_count: basket.length,
      engine,
    });

    res.json({ intent, engine, budget, spent, basket, explanation, sql: rendered });
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
      // Cold start: recommend top-rated items from the same category.
      const seed = await db.getProduct(productId);
      items = await db.topRated({
        category: seed?.category,
        excludeId: productId,
        limit,
      });
      reason = seed
        ? `Top-rated picks in ${seed.category}.`
        : "Top-rated picks for you.";
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

    const pr = Number(row.pr); // 0 = cheapest in category, 1 = most expensive
    const cheaperThanPct = Math.round((1 - pr) * 100);
    res.json({
      category: row.category,
      price: row.price,
      min: Number(row.min_p),
      avg: Number(row.avg_p),
      max: Number(row.max_p),
      count: Number(row.n),
      percentile: pr,
      cheaperThanPct,
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

// GET /api/ai/status — which engine is active (handy for the UI badge).
router.get("/status", (_req, res) => {
  const config = require("../../config");
  res.json({ engine: config.ai.enabled ? "aicore" : "fallback", model: config.ai.enabled ? config.ai.model : null });
});

// Statuses that can still be cancelled/refunded before the parcel is delivered.
const REFUNDABLE = ["Confirmed", "Processing", "Shipped"];
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

// POST /api/ai/support — AI customer-care assistant with real issue resolution.
// Body: { message, orderId? }. Classifies the issue, looks up the order, and
// performs the appropriate action (refund/cancel/return/track) against the DB.
router.post("/support", async (req, res, next) => {
  try {
    const message = (req.body?.message || "").toString();
    if (!message.trim()) return res.status(400).json({ error: "message is required" });

    const cls = await support.classify(message);
    const orderId = (req.body?.orderId || cls.orderId || "").toString().trim() || null;
    const order = orderId ? await db.getOrder(orderId) : null;

    let reply;
    let action = null;
    let ticket = null;
    let sql = null;

    // Helper to open a support ticket row.
    const openTicket = (topic, resolution, status, refundAmount) =>
      db.createTicket({
        order_id: order ? order.id : null,
        topic,
        message,
        resolution,
        status,
        refund_amount: refundAmount ?? null,
      });

    if (["refund", "cancel", "damaged"].includes(cls.topic)) {
      if (!order) {
        reply =
          "I can help with that refund. Could you share your order ID (it looks like " +
          "\"oab12cd\" and is on your Orders page)?";
      } else if (!REFUNDABLE.includes(order.status) && order.status !== "Delivered") {
        reply = `Order ${order.id} is already marked "${order.status}", so a new refund isn't needed. Anything else I can help with?`;
        ticket = await openTicket(cls.topic, `No action — status ${order.status}`, "Closed");
      } else {
        // Initiate the refund: update the order status and record the amount.
        const updated = await db.updateOrderStatus(order.id, "Refund Initiated");
        sql = `UPDATE orders SET status = 'Refund Initiated' WHERE id = '${order.id}';`;
        ticket = await openTicket(
          cls.topic,
          `Refund of ${inr(order.total)} initiated to original payment method`,
          "Resolved",
          order.total
        );
        action = { type: "refund", orderId: order.id, amount: order.total, newStatus: updated.status };
        reply =
          `Done — I've initiated a full refund of ${inr(order.total)} for order ${order.id}. ` +
          `The amount returns to your original payment method in 5–7 business days, and the ` +
          `order is now marked "Refund Initiated". Your ticket #${ticket.id} is logged. ` +
          `Is there anything else I can help with?`;
      }
    } else if (cls.topic === "return") {
      if (!order) {
        reply = "Sure, I can set up a return. What's your order ID?";
      } else {
        ticket = await openTicket("return", "Return pickup scheduled (2–3 days)", "In Progress");
        action = { type: "return", orderId: order.id };
        reply =
          `I've scheduled a free return pickup for order ${order.id} in the next 2–3 business ` +
          `days. Once we receive the item, your refund of ${inr(order.total)} is processed ` +
          `automatically. Ticket #${ticket.id} is logged.`;
      }
    } else if (cls.topic === "track") {
      if (!order) {
        reply = "I can track that for you — what's your order ID?";
      } else {
        sql = `SELECT id, status, date, total FROM orders WHERE id = '${order.id}';`;
        const when = new Date(order.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const stageMsg = {
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
      // General FAQ — let the model answer within policy, else a canned reply.
      const phrased = await ai.phrase(
        `You are ShopSphere support. Answer this shopper politely in 1–2 sentences using these policies: ` +
          `free delivery over ₹4,999; 7-day easy returns; refunds in 5–7 business days to the original ` +
          `payment method; pay by card/UPI via Razorpay. Question: "${message}"`
      );
      reply =
        phrased ||
        "Happy to help! We offer free delivery over ₹4,999, 7-day returns, and refunds within " +
          "5–7 business days. Ask me about an order, a refund, or a return anytime.";
    }

    await db.logAiQuery({
      feature: "support",
      nl_text: message,
      intent: { topic: cls.topic, orderId },
      generated_sql: sql,
      result_count: ticket ? 1 : 0,
      engine: cls.engine,
    });

    res.json({ topic: cls.topic, engine: cls.engine, order: order || null, action, ticket, reply, sql });
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

module.exports = router;
