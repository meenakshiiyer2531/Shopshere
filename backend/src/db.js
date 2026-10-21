/**
 * db.js — Postgres (Neon) data-access layer.
 *
 * All persistence goes through this module. Every method is async and returns
 * plain objects shaped exactly like the old file-based layer, so the route
 * handlers only needed to add `await`. Storage is now a real DBMS (Neon
 * Postgres) instead of db.json.
 */
const pool = require("./pool");

// Generate a short unique id with a prefix, e.g. "p" -> "p1a2b3c".
function makeId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  // ---- Products ----
  async getProducts() {
    const { rows } = await pool.query(
      "SELECT * FROM products ORDER BY created_at ASC, id ASC"
    );
    return rows;
  },

  async getProduct(id) {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async addProduct(product) {
    const id = makeId("p");
    const { rows } = await pool.query(
      `INSERT INTO products (id, name, price, category, stock, rating, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        product.name,
        product.price,
        product.category,
        product.stock ?? 0,
        product.rating ?? 0,
        product.description ?? "",
      ]
    );
    return rows[0];
  },

  async updateProduct(id, patch) {
    const fields = ["name", "price", "category", "stock", "rating", "description"];
    const sets = [];
    const values = [];
    let i = 1;
    for (const f of fields) {
      if (patch[f] !== undefined) {
        sets.push(`${f} = $${i++}`);
        values.push(patch[f]);
      }
    }
    if (sets.length === 0) return this.getProduct(id);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE products SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return rows[0] || null;
  },

  async deleteProduct(id) {
    const { rowCount } = await pool.query("DELETE FROM products WHERE id = $1", [id]);
    return rowCount > 0;
  },

  // ---- Orders ----
  async getOrders() {
    const { rows } = await pool.query(
      "SELECT * FROM orders ORDER BY date DESC"
    );
    return rows;
  },

  async addOrder(order) {
    const id = makeId("o");
    const { rows } = await pool.query(
      `INSERT INTO orders (id, items, customer, total, status, date)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        id,
        JSON.stringify(order.items),
        JSON.stringify(order.customer),
        order.total,
        order.status || "Confirmed",
      ]
    );
    return rows[0];
  },

  async updateOrderStatus(id, status) {
    const { rows } = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );
    return rows[0] || null;
  },

  async deleteOrder(id) {
    const { rowCount } = await pool.query("DELETE FROM orders WHERE id = $1", [id]);
    return rowCount > 0;
  },

  // ---- AI layer ----

  /**
   * Run a trusted, already-parameterised SELECT built by src/ai/intent.js.
   * The SQL text is produced only by our own query builder; all user/model
   * input arrives via `params`, never interpolated into the string.
   */
  async runSelect(text, params) {
    const { rows } = await pool.query(text, params);
    return rows;
  },

  // Does the products table have the full-text search_vector column? Cached.
  _ftsChecked: undefined,
  async hasFts() {
    if (this._ftsChecked !== undefined) return this._ftsChecked;
    try {
      const { rows } = await pool.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'products' AND column_name = 'search_vector'`
      );
      this._ftsChecked = rows.length > 0;
    } catch {
      this._ftsChecked = false;
    }
    return this._ftsChecked;
  },

  // F4 — Fair-Price Meter: percentile of a product's price within its category
  // using a SQL window function, plus category min/avg/max.
  priceMeterSql:
    `WITH ranked AS (\n` +
    `  SELECT id, category, price,\n` +
    `         PERCENT_RANK() OVER (PARTITION BY category ORDER BY price) AS pr\n` +
    `  FROM products\n` +
    `),\n` +
    `agg AS (\n` +
    `  SELECT category, MIN(price) min_p, ROUND(AVG(price)) avg_p,\n` +
    `         MAX(price) max_p, COUNT(*) n\n` +
    `  FROM products GROUP BY category\n` +
    `)\n` +
    `SELECT r.price, r.category, r.pr, a.min_p, a.avg_p, a.max_p, a.n\n` +
    `FROM ranked r JOIN agg a ON a.category = r.category\n` +
    `WHERE r.id = $1`,
  async priceMeter(productId) {
    const { rows } = await pool.query(this.priceMeterSql, [productId]);
    return rows[0] || null;
  },

  // F3 — Taste DNA: products frequently bought in the same orders as productId,
  // mined from the orders.items JSONB array with a self-referential subquery.
  coPurchaseSql:
    `SELECT p.*, cp.freq\n` +
    `FROM (\n` +
    `  SELECT elem->>'id' AS pid, COUNT(*)::int AS freq\n` +
    `  FROM orders o, jsonb_array_elements(o.items) AS elem\n` +
    `  WHERE o.id IN (\n` +
    `    SELECT o2.id FROM orders o2, jsonb_array_elements(o2.items) e2\n` +
    `    WHERE e2->>'id' = $1\n` +
    `  ) AND elem->>'id' <> $1\n` +
    `  GROUP BY elem->>'id'\n` +
    `) cp JOIN products p ON p.id = cp.pid\n` +
    `ORDER BY cp.freq DESC, p.rating DESC NULLS LAST\n` +
    `LIMIT $2`,
  async coPurchase(productId, limit = 4) {
    const { rows } = await pool.query(this.coPurchaseSql, [productId, limit]);
    return rows;
  },

  // Cold-start recommendation fallback: top-rated products (optionally in a
  // category), excluding one product.
  async topRated({ category, excludeId, limit = 4 }) {
    const params = [];
    const where = [];
    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (excludeId) {
      params.push(excludeId);
      where.push(`id <> $${params.length}`);
    }
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT * FROM products` +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        ` ORDER BY rating DESC NULLS LAST, price ASC LIMIT $${params.length}`,
      params
    );
    return rows;
  },

  // F2 — Budget basket candidates within a per-item price ceiling.
  async budgetCandidates({ category, maxPrice, limit = 60 }) {
    const params = [];
    const where = [];
    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (maxPrice != null) {
      params.push(maxPrice);
      where.push(`price <= $${params.length}`);
    }
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT * FROM products` +
        (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
        ` ORDER BY rating DESC NULLS LAST, price ASC LIMIT $${params.length}`,
      params
    );
    return rows;
  },

  // Audit/analytics: record every AI interaction. Never throws into the request
  // path (the table may not exist yet on an un-migrated database).
  async logAiQuery(entry) {
    try {
      await pool.query(
        `INSERT INTO ai_query_log (feature, nl_text, intent, generated_sql, result_count, engine)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.feature,
          entry.nl_text || null,
          entry.intent ? JSON.stringify(entry.intent) : null,
          entry.generated_sql || null,
          entry.result_count ?? null,
          entry.engine || null,
        ]
      );
    } catch (err) {
      if (process.env.AI_DEBUG) console.warn("ai_query_log insert skipped:", err.message);
    }
  },

  async getAiLog(limit = 50) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM ai_query_log ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return rows;
    } catch {
      return [];
    }
  },

  // ---- Customer care (AI support assistant) ----

  async getOrder(id) {
    const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async createTicket(entry) {
    const { rows } = await pool.query(
      `INSERT INTO support_ticket (order_id, topic, message, resolution, status, refund_amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        entry.order_id || null,
        entry.topic,
        entry.message || null,
        entry.resolution || null,
        entry.status || "Open",
        entry.refund_amount ?? null,
      ]
    );
    return rows[0];
  },

  async getTickets(limit = 50) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM support_ticket ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return rows;
    } catch {
      return [];
    }
  },
};
