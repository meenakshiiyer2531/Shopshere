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
};
