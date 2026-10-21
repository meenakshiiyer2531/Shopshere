import { useEffect, useState } from "react";
import { api, inr } from "../api.js";
import GlassBox from "./GlassBox.jsx";

/**
 * PriceMeter — the Fair-Price Meter (feature F4). Shows, at a glance, where
 * this product's price sits within its category, computed with a SQL window
 * function (PERCENT_RANK). One number anyone understands: "cheaper than N%".
 */
export default function PriceMeter({ productId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    api.ai
      .priceMeter(productId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [productId]);

  if (err || !data) return null;

  // Position of this product's price along the category min..max range.
  const span = Math.max(1, data.max - data.min);
  const pos = Math.min(100, Math.max(0, ((data.price - data.min) / span) * 100));
  const verdict =
    data.cheaperThanPct >= 60
      ? "Great price"
      : data.cheaperThanPct >= 35
      ? "Fair price"
      : "Premium price";

  return (
    <div className="pricemeter">
      <div className="pricemeter-head">
        <span className={`pm-badge pm-${verdict.split(" ")[0].toLowerCase()}`}>{verdict}</span>
        <span className="pm-claim">
          Cheaper than <strong>{data.cheaperThanPct}%</strong> of {data.category}
        </span>
      </div>

      <div className="pm-track">
        <div className="pm-fill" style={{ width: `${pos}%` }} />
        <div className="pm-dot" style={{ left: `${pos}%` }} />
      </div>
      <div className="pm-scale">
        <span>low {inr(data.min)}</span>
        <span>avg {inr(data.avg)}</span>
        <span>high {inr(data.max)}</span>
      </div>

      <GlassBox
        sql={data.sql}
        label="How we calculated this"
        note={`A SQL window function (PERCENT_RANK) ranks this product's price among ${data.count} ${data.category} items.`}
      />
    </div>
  );
}
