import { Link } from "react-router-dom";
import { inr, monogram } from "../api.js";
import { useCart } from "../context/CartContext.jsx";

export default function Cart() {
  const { items, setQty, remove, total, clear } = useCart();

  if (items.length === 0) {
    return (
      <div className="empty">
        <h2>Your cart is empty</h2>
        <p>Looks like you haven’t added anything yet.</p>
        <Link to="/" className="btn btn-primary btn-lg">
          Start shopping
        </Link>
      </div>
    );
  }

  const shipping = total >= 4999 ? 0 : 99;

  return (
    <div className="cart">
      <h1>Your cart</h1>
      <div className="cart-grid">
        <div className="cart-items">
          {items.map((i) => (
            <div key={i.id} className="cart-row">
              <div className="cart-thumb">{monogram(i.name)}</div>
              <div className="cart-row-info">
                <h3>{i.name}</h3>
                <span className="muted">{inr(i.price)} each</span>
              </div>
              <div className="qty">
                <button onClick={() => setQty(i.id, i.qty - 1)}>−</button>
                <span>{i.qty}</span>
                <button onClick={() => setQty(i.id, i.qty + 1)}>+</button>
              </div>
              <div className="cart-row-total">{inr(i.price * i.qty)}</div>
              <button className="remove" onClick={() => remove(i.id)}>
                ✕
              </button>
            </div>
          ))}
          <button className="btn btn-ghost cart-clear" onClick={clear}>
            Clear cart
          </button>
        </div>

        <aside className="summary">
          <h3>Order summary</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{inr(total)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : inr(shipping)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{inr(total + shipping)}</span>
          </div>
          <Link to="/checkout" className="btn btn-primary btn-lg btn-block">
            Proceed to checkout
          </Link>
        </aside>
      </div>
    </div>
  );
}
