import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, inr, loadRazorpay } from "../api.js";
import { useCart } from "../context/CartContext.jsx";

export default function Checkout({ notify }) {
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "" });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");

  const shipping = total >= 4999 ? 0 : 99;
  const grandTotal = total + shipping;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Full Razorpay flow: create order -> open Checkout -> verify -> persist.
  const pay = async (e) => {
    e.preventDefault();
    setError("");
    setPlacing(true);

    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load Razorpay. Check your connection.");

      const rzpOrder = await api.createPaymentOrder(grandTotal);

      const options = {
        key: rzpOrder.keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: "ShopSphere",
        description: `Order of ${items.length} item(s)`,
        order_id: rzpOrder.orderId,
        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },
        notes: { address: `${form.address}, ${form.city}` },
        theme: { color: "#7c5cff" },
        handler: async (response) => {
          try {
            const { order } = await api.verifyPayment({
              ...response,
              items,
              customer: form,
            });
            clear();
            setDone(order);
            notify("Payment successful");
          } catch (err) {
            setError(err.message);
          } finally {
            setPlacing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            setError("Payment cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) => {
        setPlacing(false);
        setError(resp.error?.description || "Payment failed.");
      });
      rzp.open();
    } catch (err) {
      setError(err.message);
      setPlacing(false);
    }
  };

  if (done) {
    return (
      <div className="empty">
        <h2>Thank you, {done.customer.name.split(" ")[0]}!</h2>
        <p>
          Your order <strong>#{done.id}</strong> for <strong>{inr(done.total)}</strong> is
          confirmed and paid.
        </p>
        {done.payment && (
          <p className="muted">Payment ID: {done.payment.paymentId}</p>
        )}
        <div className="row-btns">
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/orders")}>
            View my orders
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => navigate("/")}>
            Keep shopping
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <h2>Nothing to check out</h2>
        <button className="btn btn-primary btn-lg" onClick={() => navigate("/")}>
          Browse products
        </button>
      </div>
    );
  }

  return (
    <div className="checkout">
      <h1>Checkout</h1>
      <div className="checkout-grid">
        <form className="form" onSubmit={pay}>
          <h3>Shipping details</h3>
          <label>
            Full name
            <input required value={form.name} onChange={set("name")} placeholder="V Meenakshi Iyer" />
          </label>
          <div className="form-row">
            <label>
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Phone
              <input
                required
                value={form.phone}
                onChange={set("phone")}
                placeholder="9876543210"
              />
            </label>
          </div>
          <label>
            Address
            <input required value={form.address} onChange={set("address")} placeholder="Street, area" />
          </label>
          <label>
            City
            <input required value={form.city} onChange={set("city")} placeholder="City" />
          </label>

          {error && <div className="state state-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={placing}>
            {placing ? "Processing…" : `Pay ${inr(grandTotal)} with Razorpay`}
          </button>
          <p className="muted center">
            Secure test payment via Razorpay · use card 4111 1111 1111 1111, any future
            expiry & CVV.
          </p>
        </form>

        <aside className="summary">
          <h3>Order summary</h3>
          {items.map((i) => (
            <div key={i.id} className="summary-row">
              <span>
                {i.name} × {i.qty}
              </span>
              <span>{inr(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : inr(shipping)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{inr(grandTotal)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
