/**
 * pool.js — shared Neon Postgres connection pool.
 *
 * The whole app talks to Postgres through this single pg.Pool. The connection
 * string is read from DATABASE_URL (Neon pooled endpoint) so the same code runs
 * locally and on Vercel serverless functions.
 */
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    "[pool] DATABASE_URL is not set — the API cannot reach Postgres. " +
      "Set it in backend/.env (Neon connection string)."
  );
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

module.exports = pool;
