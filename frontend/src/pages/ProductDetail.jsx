import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, inr, monogram } from "../api.js";
import { useCart } from "../context/CartContext.jsx";

export default function ProductDetail({ notify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getProduct(id).then(setProduct).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="state state-error">{error}</div>;
  if (!product) return <div className="state">Loading…</div>;

  const inStock = product.stock > 0;

  return (
    <div className="detail">
      <Link to="/" className="back">
        ← Back to results
      </Link>

      <div className="detail-grid">
        <div className="detail-art" data-cat={product.category}>
          <span className="detail-mono">{monogram(product.name)}</span>
        </div>

        <div className="detail-info">
          <h1>{product.name}</h1>
          <span className="detail-cat">Category: {product.category}</span>
          <div className="detail-meta">
            <span className="stars">★ {product.rating || "—"}</span>
            <span className={inStock ? "in-stock" : "out-stock"}>
              {inStock ? `${product.stock} available` : "Currently unavailable"}
            </span>
          </div>
          <p className="detail-desc">{product.description}</p>
        </div>

        <div className="buy-box">
          <span className="buy-price">
            <span className="cur">₹</span>
            {inr(product.price).replace("₹", "")}
          </span>
          <span className={`buy-stock ${inStock ? "" : "out"}`}>
            {inStock ? "In stock" : "Out of stock"}
          </span>

          <div className="qty">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)}>+</button>
          </div>

          <button
            className="btn btn-primary btn-lg"
            disabled={!inStock}
            onClick={() => {
              add(product, qty);
              notify(`Added ${qty} x "${product.name}" to cart`);
            }}
          >
            Add to Cart
          </button>
          <button
            className="btn btn-secondary btn-lg"
            disabled={!inStock}
            onClick={() => {
              add(product, qty);
              navigate("/cart");
            }}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
