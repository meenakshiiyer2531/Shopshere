/**
 * ShopSphere API server
 * DBMS Assignment 1 — V Meenakshi Iyer (2025SL70043), Mercy Mary (2025SL70043)
 *
 * A small Express REST API. Product/order data is persisted to db.json through
 * src/db.js (the database layer). Payments are handled via Razorpay.
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const config = require("./config");

const productsRouter = require("./src/routes/products");
const ordersRouter = require("./src/routes/orders");
const paymentRouter = require("./src/routes/payment");
const authRouter = require("./src/routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

// Simple request logger so you can see the DB being hit during the demo.
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

app.get("/", (_req, res) => {
  res.json({ service: "ShopSphere API", status: "ok", version: "1.1.0" });
});

app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/auth", authRouter);

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Central JSON error handler so DB/route failures never crash the process.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// On Vercel the app is imported as a serverless handler (see api/index.js),
// so we only call listen() when this file is run directly (local dev).
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`ShopSphere API running at http://localhost:${config.port}`);
    console.log(
      config.razorpay.keyId
        ? `Razorpay configured (key ${config.razorpay.keyId})`
        : `Razorpay keys missing - set them in backend/.env`
    );
  });
}

module.exports = app;
