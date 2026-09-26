/** Product routes — full CRUD over the products collection. */
const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/products  (optional ?category= & ?q= filters)
router.get("/", async (req, res, next) => {
  try {
    let products = await db.getProducts();
    const { category, q } = req.query;

    if (category && category !== "All") {
      products = products.filter((p) => p.category === category);
    }
    if (q) {
      const term = q.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const product = await db.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/products  (admin — create)
router.post("/", async (req, res, next) => {
  try {
    const { name, price, category } = req.body;
    if (!name || price == null || !category) {
      return res
        .status(400)
        .json({ error: "name, price and category are required" });
    }
    const created = await db.addProduct({
      name,
      price: Number(price),
      category,
      stock: Number(req.body.stock ?? 0),
      description: req.body.description || "",
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id  (admin — update)
router.put("/:id", async (req, res, next) => {
  try {
    const patch = { ...req.body };
    if (patch.price != null) patch.price = Number(patch.price);
    if (patch.stock != null) patch.stock = Number(patch.stock);
    const updated = await db.updateProduct(req.params.id, patch);
    if (!updated) return res.status(404).json({ error: "Product not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id  (admin — delete)
router.delete("/:id", async (req, res, next) => {
  try {
    const ok = await db.deleteProduct(req.params.id);
    if (!ok) return res.status(404).json({ error: "Product not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
