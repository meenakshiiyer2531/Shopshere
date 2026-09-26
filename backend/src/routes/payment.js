/**
 * payment.js — Razorpay payment integration.
 *
 * Flow:
 *   1. POST /api/payment/order  — create a Razorpay order for a given amount.
 *   2. Frontend opens the Razorpay Checkout widget with that order id.
 *   3. POST /api/payment/verify — verify the payment signature (HMAC-SHA256).
 *      On success the order is persisted to the database and returned.
 */
const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const config = require("../../config");
const db = require("../db");

const router = express.Router();

const configured = Boolean(config.razorpay.keyId && config.razorpay.keySecret);
const razorpay = configured
  ? new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    })
  : null;

// Expose the public key id so the frontend can open Checkout.
router.get("/config", (_req, res) => {
  res.json({ keyId: config.razorpay.keyId, configured });
});

// 1. Create a Razorpay order. Amount comes in rupees; Razorpay expects paise.
router.post("/order", async (req, res) => {
  if (!razorpay) {
    return res
      .status(503)
      .json({ error: "Payments are not configured. Set Razorpay keys in .env" });
  }
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "A positive amount is required" });
  }
  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: config.razorpay.currency,
      receipt: "rcpt_" + Date.now(),
    });
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
    });
  } catch (err) {
    console.error("Razorpay order error:", err?.error || err);
    res.status(502).json({ error: "Could not create payment order" });
  }
});

// 2. Verify the payment signature and, if valid, persist the order.
router.post("/verify", async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      customer,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification fields" });
    }

    // Signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const expected = crypto
      .createHmac("sha256", config.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    if (!Array.isArray(items) || items.length === 0 || !customer?.name || !customer?.email) {
      return res.status(400).json({ error: "Order details are incomplete" });
    }

    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const order = await db.addOrder({ items, customer, total });

    res.status(201).json({ verified: true, order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
