import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api.js";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="state">Loading orders…</div>;
  if (error) return <div className="state state-error">{error}</div>;

  if (orders.length === 0) {
    return (
      <div className="empty">
        <h2>No orders yet</h2>
        <p>Your placed orders will appear here.</p>
        <Link to="/" className="btn btn-primary btn-lg">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="orders">
      <h1>Order history</h1>
      {orders.map((o) => (
        <div key={o.id} className="order-card">
          <div className="order-head">
            <div>
              <strong>#{o.id}</strong>
              <span className="muted">
                {" "}
                · {new Date(o.date).toLocaleString("en-IN")}
              </span>
            </div>
            <span className="badge">{o.status}</span>
          </div>
          <div className="order-items">
            {o.items.map((i) => (
              <span key={i.id} className="order-chip">
                {i.name} × {i.qty}
              </span>
            ))}
          </div>
          <div className="order-foot">
            <span className="muted">
              {o.customer.name}
              {o.payment?.paymentId && ` · Paid · ${o.payment.paymentId}`}
            </span>
            <strong>{inr(o.total)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
