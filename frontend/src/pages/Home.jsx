import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";
import GlassBox from "../components/GlassBox.jsx";

const CATEGORIES = ["All", "Electronics", "Fashion", "Home", "Books", "Beauty", "Sports", "Toys", "Grocery"];

export default function Home({ notify }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";
  const q = searchParams.get("q") || "";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ai, setAi] = useState(null); // { sql, engine } when an AI search ran

  useEffect(() => {
    setLoading(true);
    setAi(null);

    // Natural-language search: route the top search bar through the AI, which
    // compiles it to safe SQL. Falls back to a plain keyword search on error.
    if (q) {
      (async () => {
        try {
          const r = await api.ai.ask(q);
          setProducts(r.results);
          setAi({ sql: r.sql });
          setError("");
        } catch {
          try {
            setProducts(await api.listProducts({ q }));
            setError("");
          } catch (e) {
            setError(e.message);
          }
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    api
      .listProducts({ category })
      .then((data) => {
        setProducts(data);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, q]);

  const pickCategory = (c) => {
    const next = new URLSearchParams(searchParams);
    next.delete("q"); // switching category starts a fresh browse
    if (c === "All") next.delete("category");
    else next.set("category", c);
    setSearchParams(next);
  };

  let heading = "Today's picks";
  if (q) heading = `Results for "${q}"`;
  else if (category !== "All") heading = category;

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>
            Great deals, <span className="accent">delivered fast.</span>
          </h1>
          <p>
            Shop electronics, fashion, home, books and more at ShopSphere — or
            just tell our AI what you need. Free delivery on orders over Rs. 4,999.
          </p>
          <a href="#catalog" className="btn btn-primary btn-lg">
            Shop all deals
          </a>
        </div>
        <div className="hero-tiles" aria-hidden>
          <span data-cat="Electronics">Electronics</span>
          <span data-cat="Fashion">Fashion</span>
          <span data-cat="Home">Home</span>
          <span data-cat="Books">Books</span>
        </div>
      </section>

      <section id="catalog" className="catalog">
        <div className="catalog-head">
          <h2>{heading}</h2>
          {!loading && !error && (
            <span className="result-note">{products.length} items</span>
          )}
        </div>

        {q && ai && (
          <div className="ai-search-note">
            <span className="ai-search-badge">✨ AI search</span>
            <GlassBox sql={ai.sql} label="See the SQL this search generated" />
          </div>
        )}

        <div className="chips">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`chip ${category === c && !q ? "chip-active" : ""}`}
              onClick={() => pickCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {loading && <div className="state">Searching…</div>}
        {error && <div className="state state-error">{error}</div>}
        {!loading && !error && products.length === 0 && (
          <div className="state">No products match your search. Try the ✨ Ask AI assistant.</div>
        )}

        <div className="grid">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAdded={(prod) => notify(`Added "${prod.name}" to cart`)}
            />
          ))}
        </div>
      </section>
    </>
  );
}
