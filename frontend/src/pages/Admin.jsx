import { useEffect, useState } from "react";
import { api, inr, monogram } from "../api.js";

const BLANK = {
  name: "",
  price: "",
  category: "Electronics",
  stock: "",
  description: "",
};
const CATEGORIES = ["Electronics", "Fashion", "Home", "Books"];
const STATUSES = ["Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
const AUTH_KEY = "shopsphere_admin";

export default function Admin({ notify }) {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === "1"
  );

  if (!authed)
    return <AdminLogin onSuccess={() => setAuthed(true)} notify={notify} />;
  return <AdminPanel notify={notify} onSignOut={() => setAuthed(false)} />;
}

/* ---------- Login gate ---------- */
function AdminLogin({ onSuccess, notify }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.login({ userId, password });
      sessionStorage.setItem(AUTH_KEY, "1");
      notify("Signed in as admin");
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Sign in</h1>
        <p className="sub">Admin access is required to manage the store.</p>
        <form onSubmit={submit}>
          <label>
            User ID
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="state state-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="login-hint">
          Demo credentials — User ID: <strong>admin</strong>, Password:{" "}
          <strong>1234</strong>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dashboard shell ---------- */
function AdminPanel({ notify, onSignOut }) {
  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const loadProducts = () =>
    api.listProducts().then(setProducts).catch((e) => setError(e.message));
  const loadOrders = () =>
    api.listOrders().then(setOrders).catch((e) => setError(e.message));

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, []);

  const signOut = () => {
    sessionStorage.removeItem(AUTH_KEY);
    onSignOut();
  };

  const revenue = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>Admin dashboard</h1>
        <span className="muted">
          Signed in as <strong>admin</strong> &middot;{" "}
          <button className="link-btn" onClick={signOut}>
            Sign out
          </button>
        </span>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{products.length}</div>
          <div className="stat-label">Products listed</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{orders.length}</div>
          <div className="stat-label">Orders recorded</div>
        </div>
        <div className="stat-card">
          <div className="stat-num accent">{inr(revenue)}</div>
          <div className="stat-label">Revenue (excl. cancelled)</div>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === "products" ? "active" : ""}`}
          onClick={() => setTab("products")}
        >
          Products <span className="tab-count">{products.length}</span>
        </button>
        <button
          className={`admin-tab ${tab === "orders" ? "active" : ""}`}
          onClick={() => setTab("orders")}
        >
          Orders <span className="tab-count">{orders.length}</span>
        </button>
      </div>

      {error && <div className="state state-error">{error}</div>}

      {tab === "products" ? (
        <ProductsTab
          products={products}
          notify={notify}
          reload={loadProducts}
          setError={setError}
        />
      ) : (
        <OrdersTab
          orders={orders}
          notify={notify}
          reload={loadOrders}
          setError={setError}
        />
      )}
    </div>
  );
}

/* ---------- Products CRUD ---------- */
function ProductsTab({ products, notify, reload, setError }) {
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const reset = () => {
    setForm(BLANK);
    setEditingId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.updateProduct(editingId, form);
        notify(`Updated "${form.name}"`);
      } else {
        await api.createProduct(form);
        notify(`Added "${form.name}"`);
      }
      reset();
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: p.price,
      category: p.category,
      stock: p.stock,
      description: p.description,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.deleteProduct(p.id);
      notify(`Deleted "${p.name}"`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <form className="form admin-form" onSubmit={submit}>
        <h3>{editingId ? "Edit product" : "Add new product"}</h3>
        <label>
          Name
          <input required value={form.name} onChange={set("name")} />
        </label>
        <div className="form-row">
          <label>
            Price (₹)
            <input
              required
              type="number"
              min="0"
              value={form.price}
              onChange={set("price")}
            />
          </label>
          <label>
            Stock
            <input
              required
              type="number"
              min="0"
              value={form.stock}
              onChange={set("stock")}
            />
          </label>
          <label>
            Category
            <select value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Description
          <textarea
            rows={2}
            value={form.description}
            onChange={set("description")}
          />
        </label>

        <div className="row-btns">
          <button type="submit" className="btn btn-primary">
            {editingId ? "Save changes" : "Add product"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="admin-table">
        <div className="admin-tr admin-th">
          <span>Product</span>
          <span>Category</span>
          <span>Price</span>
          <span>Stock</span>
          <span></span>
        </div>
        {products.map((p) => (
          <div key={p.id} className="admin-tr">
            <span className="admin-name">
              <span className="admin-mono">{monogram(p.name)}</span> {p.name}
            </span>
            <span>{p.category}</span>
            <span>{inr(p.price)}</span>
            <span>{p.stock}</span>
            <span className="admin-actions">
              <button className="link-btn" onClick={() => edit(p)}>
                Edit
              </button>
              <button className="link-btn danger" onClick={() => del(p)}>
                Delete
              </button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Orders management ---------- */
function OrdersTab({ orders, notify, reload, setError }) {
  const changeStatus = async (o, status) => {
    try {
      await api.updateOrderStatus(o.id, status);
      notify(`Order ${o.id} → ${status}`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const del = async (o) => {
    if (!confirm(`Delete order ${o.id}?`)) return;
    try {
      await api.deleteOrder(o.id);
      notify(`Deleted order ${o.id}`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!orders.length) {
    return (
      <div className="empty">
        <h2>No orders yet</h2>
        <p>Orders placed by customers will appear here as they come in.</p>
      </div>
    );
  }

  return (
    <div className="orders">
      {orders.map((o) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const customer = o.customer || {};
        return (
          <div key={o.id} className="order-card">
            <div className="order-head">
              <span>
                <strong>#{o.id}</strong> &middot;{" "}
                {new Date(o.date).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              <span className="status-badge" data-status={o.status}>
                {o.status}
              </span>
            </div>

            <div className="order-items">
              {items.map((it, i) => (
                <span key={i} className="order-chip">
                  {it.name} × {it.qty}
                </span>
              ))}
            </div>

            <div className="order-foot">
              <div>
                {customer.name && (
                  <div className="muted">
                    {customer.name}
                    {customer.email ? ` · ${customer.email}` : ""}
                  </div>
                )}
                <strong>{inr(o.total)}</strong>
              </div>
              <div className="order-controls">
                <select
                  className="status-select"
                  value={o.status}
                  onChange={(e) => changeStatus(o, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button className="link-btn danger" onClick={() => del(o)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
