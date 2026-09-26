/**
 * auth.js — admin authentication for the product manager.
 *
 * The admin panel is protected by a single set of credentials read from
 * config (backend/.env). On a correct user id and password the server issues
 * a short session token that the frontend keeps for the browser session.
 */
const express = require("express");
const crypto = require("crypto");
const config = require("../../config");

const router = express.Router();

// POST /api/auth/login  { userId, password }
router.post("/login", (req, res) => {
  const { userId, password } = req.body || {};

  if (userId === config.admin.userId && password === config.admin.password) {
    const token = crypto.randomBytes(16).toString("hex");
    return res.json({ ok: true, token, user: userId });
  }

  return res.status(401).json({ error: "Invalid user id or password." });
});

module.exports = router;
