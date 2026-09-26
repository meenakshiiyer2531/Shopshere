/** Order routes — create an order, list history, and admin status/delete. */
const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/orders
router.get("/", async (_req, res, next) => {
  try {
    res.json(await db.getOrders());
  } catch (err) {
    next(err);
  }
});

// POST /api/orders
router.post("/", async (req, res, next) => {
  try {
    const { items, customer } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order must contain at least one item" });
    }
    if (!customer || !customer.name || !customer.email) {
      return res.status(400).json({ error: "Customer name and email are required" });
    }

    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const created = await db.addOrder({ items, customer, total });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id  (admin — update status)
router.patch("/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    }
    const updated = await db.updateOrderStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: "Order not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id  (admin — delete)
router.delete("/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteOrder(req.params.id);
    if (!ok) return res.status(404).json({ error: "Order not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
