import { useState } from "react";

/**
 * GlassBox — the signature "glass box" of ShopSphere AI. A collapsible panel
 * that reveals the real database query (and optional note) behind an AI answer,
 * turning the database work into a visible, teachable feature.
 */
export default function GlassBox({ sql, note, label = "See the SQL behind this" }) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;

  return (
    <div className={`glassbox ${open ? "open" : ""}`}>
      <button className="glassbox-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="glassbox-icon">{open ? "▾" : "▸"}</span>
        {label}
      </button>
      {open && (
        <div className="glassbox-body">
          {note && <p className="glassbox-note">{note}</p>}
          <pre className="glassbox-sql">{sql}</pre>
        </div>
      )}
    </div>
  );
}
