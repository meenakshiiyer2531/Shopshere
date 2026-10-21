import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr, monogram } from "../api.js";
import GlassBox from "./GlassBox.jsx";

/**
 * TasteStrip — the explainable recommender (feature F3). Shows "frequently
 * bought together" products mined from the orders.items JSONB with a
 * self-referential SQL query, falling back to top-rated picks (cold start).
 * Each strip states, in plain language, WHY these items are shown.
 */
export default function TasteStrip({ productId, notify }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    api.ai
      .recommend(productId, 4)
      .then((d) => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [productId]);

  if (!data || data.items.length === 0) return null;

  return (
    <section className="taste">
      <div className="taste-head">
        <h2>Taste DNA</h2>
        <span className="taste-reason">{data.reason}</span>
      </div>
      <div className="taste-grid">
        {data.items.map((p) => (
          <Link key={p.id} to={`/product/${p.id}`} className="taste-card">
            <span className="taste-mono" data-cat={p.category}>
              {monogram(p.name)}
            </span>
            <span className="taste-name">{p.name}</span>
            <span className="taste-foot">
              <span className="price-sm">{inr(p.price)}</span>
              {p.freq ? <span className="taste-freq">bought together ×{p.freq}</span> : <span className="stars">★ {p.rating}</span>}
            </span>
          </Link>
        ))}
      </div>
      <GlassBox
        sql={data.sql}
        label="See the recommendation query"
        note={
          data.basis === "co-purchase"
            ? "Mined from past orders: products appearing in the same orders as this one (JSONB self-join)."
            : "Cold-start fallback: top-rated products in the same category."
        }
      />
    </section>
  );
}
