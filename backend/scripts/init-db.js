/**
 * init-db.js — create the Neon Postgres schema and seed it with products.
 *
 * Run with:  npm run db:init   (from the backend folder)
 *
 * Safe to re-run: tables are created IF NOT EXISTS and products are only
 * seeded when the table is empty, so existing data/orders are preserved.
 */
require("dotenv").config();
const pool = require("../src/pool");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    price       INTEGER NOT NULL,
    category    TEXT NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0,
    rating      NUMERIC(2,1) NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS orders (
    id        TEXT PRIMARY KEY,
    items     JSONB NOT NULL,
    customer  JSONB NOT NULL,
    total     INTEGER NOT NULL,
    status    TEXT NOT NULL DEFAULT 'Confirmed',
    date      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const PRODUCTS = [
  ["Aurora Wireless Headphones", 8999, "Electronics", 24, 4.7, "Immersive over-ear headphones with active noise cancellation, 40-hour battery life, and plush memory-foam ear cushions."],
  ["Nebula Smart Watch", 12499, "Electronics", 15, 4.5, "AMOLED always-on display, heart-rate and SpO2 tracking, 7-day battery, and 100+ sport modes."],
  ["Pixel Pro Mirrorless Camera", 64999, "Electronics", 8, 4.9, "24MP APS-C sensor, 4K60 video, in-body stabilisation, and a compact weather-sealed body."],
  ["Sonic Bluetooth Speaker", 3499, "Electronics", 38, 4.4, "360° room-filling sound, 20-hour playtime, IPX7 waterproofing, and USB-C fast charging."],
  ["Vortex Mechanical Keyboard", 6299, "Electronics", 27, 4.6, "Hot-swappable switches, per-key RGB, aluminium frame, and a satisfying tactile typing feel."],
  ["Quantum 4K Streaming Stick", 3999, "Electronics", 44, 4.3, "Stream in 4K HDR with a voice remote, Wi-Fi 6, and instant access to every major app."],
  ["Cloudstep Running Shoes", 4599, "Fashion", 40, 4.4, "Ultra-light knit uppers with responsive foam midsole for all-day comfort and long runs."],
  ["Heritage Leather Backpack", 5999, "Fashion", 22, 4.6, "Full-grain leather, padded 15-inch laptop sleeve, and antique brass hardware built to last."],
  ["Meridian Aviator Sunglasses", 2499, "Fashion", 55, 4.2, "Polarised UV400 lenses with a lightweight titanium frame and a scratch-resistant coating."],
  ["Terra Merino Wool Sweater", 3899, "Fashion", 31, 4.5, "Breathable, temperature-regulating merino knit in a relaxed modern fit for every season."],
  ["Cascade Waterproof Jacket", 6799, "Fashion", 19, 4.7, "3-layer shell with taped seams, pit-zip venting, and a packable hood for unpredictable weather."],
  ["Ember Ceramic Pour-Over Set", 3299, "Home", 30, 4.8, "Hand-glazed ceramic dripper and server with a reusable stainless filter for the perfect brew."],
  ["Lumen Smart Desk Lamp", 3799, "Home", 18, 4.3, "Tunable warm-to-cool light, wireless charging base, and touch dimming with memory presets."],
  ["Verdant Indoor Plant Trio", 1899, "Home", 47, 4.5, "A curated set of low-maintenance air-purifying plants in matte stoneware pots."],
  ["Nordic Linen Duvet Set", 5499, "Home", 26, 4.6, "Stonewashed pure-linen duvet cover and pillowcases that get softer with every wash."],
  ["Cast Iron Chef's Skillet", 2999, "Home", 34, 4.8, "Pre-seasoned 12-inch cast iron pan for searing, baking and everything in between."],
  ["The Art of Clean Code", 1299, "Books", 60, 4.9, "A modern guide to writing readable, maintainable software with practical real-world examples."],
  ["Atlas of the Cosmos", 2199, "Books", 33, 4.7, "A stunning hardcover journey through galaxies, nebulae and the frontiers of astronomy."],
  ["Mindful Mornings Journal", 899, "Books", 75, 4.4, "A guided 90-day journal with prompts for gratitude, focus and intentional living."],
  ["Foundations of Databases", 1799, "Books", 41, 4.6, "A clear, example-driven introduction to relational design, SQL and query optimisation."],
  ["The Midnight Library", 999, "Books", 52, 4.5, "A moving novel about the infinite lives we could have lived, and the one we choose."],
];

function makeId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8);
}

async function main() {
  console.log("Creating schema…");
  await pool.query(SCHEMA);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM products");
  if (rows[0].n > 0) {
    console.log(`Products table already has ${rows[0].n} rows — skipping seed.`);
  } else {
    console.log(`Seeding ${PRODUCTS.length} products…`);
    for (const [name, price, category, stock, rating, description] of PRODUCTS) {
      await pool.query(
        `INSERT INTO products (id, name, price, category, stock, rating, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [makeId("p"), name, price, category, stock, rating, description]
      );
    }
    console.log("Seed complete.");
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});
