/**
 * config.js — centralised configuration.
 *
 * Values are read from environment variables (loaded from .env by dotenv in
 * server.js). Secrets like the Razorpay key secret must NEVER be committed to
 * version control — see .env.example for the required keys.
 */
// Also load the project-root .env (SAP AI Core credentials live there). This is
// a no-op on Vercel (vars come from the dashboard) and never overrides values
// already set by backend/.env.
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const aiOrchestration = process.env.AICORE_ORCHESTRATION_ID || "da1aab8284d852ed";

module.exports = {
  port: process.env.PORT || 4100,
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    currency: "INR",
  },
  // Admin panel credentials. Defaults are used if not set in .env.
  admin: {
    userId: process.env.ADMIN_USER || "admin",
    password: process.env.ADMIN_PASSWORD || "1234",
  },
  // SAP AI Core (Generative AI Hub). When credentials are absent the AI layer
  // automatically uses its deterministic fallback engine.
  ai: {
    enabled: Boolean(
      process.env.AICORE_CLIENT_ID && process.env.AICORE_CLIENT_SECRET
    ),
    clientId: process.env.AICORE_CLIENT_ID || "",
    clientSecret: process.env.AICORE_CLIENT_SECRET || "",
    authUrl: process.env.AICORE_AUTH_URL || "",
    baseUrl: process.env.AICORE_BASE_URL || "",
    resourceGroup: process.env.AICORE_RESOURCE_GROUP || "default",
    orchestrationId: aiOrchestration,
    model: process.env.AICORE_MODEL || "gpt-4o-mini",
    timeoutMs: Number(process.env.AICORE_TIMEOUT_MS || 9000),
  },
};
