/**
 * config.js — centralised configuration.
 *
 * Values are read from environment variables (loaded from .env by dotenv in
 * server.js). Secrets like the Razorpay key secret must NEVER be committed to
 * version control — see .env.example for the required keys.
 */
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
};
