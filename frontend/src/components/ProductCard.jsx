import { Link } from "react-router-dom";
import { inr, monogram } from "../api.js";
import { useCart } from "../context/CartContext.jsx";

export default function ProductCard({ product, onAdded }) {
  const { add } = useCart();

  const handleAdd = (e) => {
    e.preventDefault();
    add(product);
    onAdded?.(product);
  };

  const price = inr(product.price);

  return (
    <Link to={`/product/${product.id}`} className="card">
      <div className="card-art" data-cat={product.category}>
        <span className="card-mono">{monogram(product.name)}</span>
        <span className="card-tag">{product.category}</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{product.name}</h3>
        <div className="card-meta">
          <span className="stars">★ {product.rating || "—"}</span>
          <span className="rating-count">
            {product.stock > 0 ? "In stock" : "Currently unavailable"}
          </span>
        </div>
        <div className="card-foot">
          <span className="price">
            <span className="cur">₹</span>
            {price.replace("₹", "")}
          </span>
          <button
            className="btn btn-add"
            onClick={handleAdd}
            disabled={product.stock <= 0}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </Link>
  );
}
