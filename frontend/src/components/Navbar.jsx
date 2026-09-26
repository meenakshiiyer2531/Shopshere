import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Books"];

export default function Navbar() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const search = (e) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  };

  return (
    <header className="az-header">
      <div className="az-top">
        <Link to="/" className="az-logo">
          ShopSphere<span className="az-logo-dot">.in</span>
        </Link>

        <form className="az-search" onSubmit={search} role="search">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search ShopSphere"
            aria-label="Search products"
          />
          <button className="az-search-btn" type="submit" aria-label="Search">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>

        <div className="az-actions">
          <Link to="/admin" className="az-act">
            <span className="az-act-1">Hello, sign in</span>
            <span className="az-act-2">Admin</span>
          </Link>
          <Link to="/orders" className="az-act">
            <span className="az-act-1">Returns</span>
            <span className="az-act-2">& Orders</span>
          </Link>
          <Link to="/cart" className="az-cart" aria-label="Cart">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="az-cart-count">{count}</span>
            <span className="az-cart-label">Cart</span>
          </Link>
        </div>
      </div>

      <nav className="az-sub">
        {CATEGORIES.map((c) => (
          <NavLink
            key={c}
            to={c === "All" ? "/" : `/?category=${encodeURIComponent(c)}`}
            end={c === "All"}
          >
            {c === "All" ? "All" : c}
          </NavLink>
        ))}
        <NavLink to="/admin" className="az-sub-admin">
          Product manager
        </NavLink>
      </nav>
    </header>
  );
}
