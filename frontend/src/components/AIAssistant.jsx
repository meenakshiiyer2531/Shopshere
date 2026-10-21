import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api.js";
import { useCart } from "../context/CartContext.jsx";
import GlassBox from "./GlassBox.jsx";

/**
 * AIAssistant — the single, glass-box AI surface for ShopSphere.
 *
 * A floating launcher opens a panel with four easy modes:
 *   Ask    — natural-language product search (NL -> safe SQL) + add to cart
 *   Vibe   — mood/occasion search via Postgres full-text search
 *   Budget — build a complementary cart within a total budget
 *   Care   — customer-care chatbot that tracks orders & runs refunds/returns
 */
const MODES = [
  { key: "ask", label: "Ask", hint: "Describe what you want", examples: ["wireless headphones under 3000 rated above 4", "cheapest books", "add 2 of the cheapest speaker"] },
  { key: "vibe", label: "Vibe", hint: "A mood or occasion", examples: ["gift for a techie dad", "cosy monsoon reading", "something for a coffee lover"] },
  { key: "budget", label: "Budget", hint: "Build a cart to a budget", examples: ["home office setup for 15000", "gadgets under 10000", "a reading corner for 6000"] },
  { key: "support", label: "Care", hint: "Orders, refunds & returns", examples: ["where is my order?", "I want a refund for order oab12cd", "my item arrived damaged"] },
];

function ProductRow({ p, onAdd }) {
  return (
    <div className="ai-prod">
      <Link to={`/product/${p.id}`} className="ai-prod-main">
        <span className="ai-prod-name">{p.name}</span>
        <span className="ai-prod-sub">
          {p.category} · <span className="stars">★ {p.rating || "—"}</span>
        </span>
      </Link>
      <span className="ai-prod-price">{inr(p.price)}</span>
      <button className="btn btn-add" onClick={() => onAdd(p)}>
        Add
      </button>
    </div>
  );
}

export default function AIAssistant({ notify }) {
  const { add, remove, items } = useCart();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("ask");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [engineBadge, setEngineBadge] = useState(null);

  // Per-mode result; support keeps a chat transcript.
  const [result, setResult] = useState(null);
  const [chat, setChat] = useState([
    { from: "bot", text: "Hi! I'm your ShopSphere assistant. Ask about an order, a refund, or a return." },
  ]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    api.ai.status().then((s) => setEngineBadge(s.engine)).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === "support") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, mode]);

  const current = MODES.find((m) => m.key === mode);

  const addProduct = (p, qty = 1) => {
    add(p, qty);
    notify?.(`Added "${p.name}" to cart`);
  };

  async function run(q) {
    const query = (q ?? text).trim();
    if (!query || busy) return;
    setBusy(true);
    try {
      if (mode === "ask") {
        const r = await api.ai.ask(query);
        // Conversational cart: auto-apply add/remove actions.
        if (r.intent?.action === "add_to_cart" && r.results[0]) {
          addProduct(r.results[0], r.intent.quantity || 1);
        } else if (r.intent?.action === "remove_from_cart" && r.results[0]) {
          const inCart = items.find((i) => i.id === r.results[0].id);
          if (inCart) {
            remove(inCart.id);
            notify?.(`Removed "${r.results[0].name}" from cart`);
          }
        }
        setResult({ kind: "list", ...r });
      } else if (mode === "vibe") {
        const r = await api.ai.vibe(query);
        setResult({ kind: "list", ...r });
      } else if (mode === "budget") {
        const r = await api.ai.budget(query);
        setResult({ kind: "budget", ...r });
      } else if (mode === "support") {
        setChat((c) => [...c, { from: "user", text: query }]);
        const r = await api.ai.support(query);
        setChat((c) => [
          ...c,
          { from: "bot", text: r.reply, action: r.action, ticket: r.ticket, sql: r.sql, engine: r.engine },
        ]);
      }
      setText("");
    } catch (e) {
      if (mode === "support") {
        setChat((c) => [...c, { from: "bot", text: "Sorry, something went wrong. Please try again." }]);
      } else {
        setResult({ kind: "error", error: e.message });
      }
    } finally {
      setBusy(false);
    }
  }

  const switchMode = (k) => {
    setMode(k);
    setResult(null);
    setText("");
  };

  return (
    <>
      <button
        className={`ai-fab ${open ? "ai-fab-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Open ShopSphere AI assistant"
      >
        {open ? "✕" : "✨ Ask AI"}
      </button>

      {open && (
        <div className="ai-panel" role="dialog" aria-label="ShopSphere AI">
          <div className="ai-panel-head">
            <div>
              <strong>ShopSphere AI</strong>
              {engineBadge && (
                <span className={`glassbox-engine engine-${engineBadge}`}>
                  {engineBadge === "aicore" ? "SAP AI Core" : "offline engine"}
                </span>
              )}
            </div>
            <p className="ai-panel-sub">Every answer shows the real database query behind it.</p>
          </div>

          <div className="ai-modes">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={`ai-mode ${mode === m.key ? "ai-mode-on" : ""}`}
                onClick={() => switchMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="ai-body">
            {mode === "support" ? (
              <div className="ai-chat">
                {chat.map((m, i) => (
                  <div key={i} className={`ai-msg ai-msg-${m.from}`}>
                    <div className="ai-bubble">{m.text}</div>
                    {m.action?.type === "refund" && (
                      <div className="ai-refund">
                        ✓ Refund of {inr(m.action.amount)} initiated · order now “{m.action.newStatus}”
                      </div>
                    )}
                    {m.ticket && <div className="ai-ticket">Ticket #{m.ticket.id} · {m.ticket.status}</div>}
                    {m.sql && <GlassBox sql={m.sql} engine={m.engine} label="See the SQL" />}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            ) : (
              <div className="ai-results">
                {!result && (
                  <p className="ai-placeholder">{current.hint}. Try an example below.</p>
                )}
                {result?.kind === "error" && <p className="state-error">{result.error}</p>}

                {result?.kind === "list" && (
                  <>
                    <div className="ai-resnote">
                      {result.results.length} match{result.results.length === 1 ? "" : "es"}
                      {result.mode ? ` · ${result.mode} search` : ""}
                    </div>
                    {result.results.map((p) => (
                      <ProductRow key={p.id} p={p} onAdd={addProduct} />
                    ))}
                    {result.results.length === 0 && (
                      <p className="ai-placeholder">No products matched — try rephrasing.</p>
                    )}
                    <GlassBox sql={result.sql} engine={result.engine} />
                  </>
                )}

                {result?.kind === "budget" && (
                  <>
                    <div className="ai-resnote">
                      {result.explanation}
                    </div>
                    {result.basket.map((p) => (
                      <ProductRow key={p.id} p={p} onAdd={addProduct} />
                    ))}
                    <div className="ai-budget-foot">
                      <span>Total {inr(result.spent)} / {inr(result.budget)}</span>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          result.basket.forEach((p) => add(p, 1));
                          notify?.(`Added ${result.basket.length} items to cart`);
                        }}
                      >
                        Add all to cart
                      </button>
                    </div>
                    <GlassBox sql={result.sql} engine={result.engine} />
                  </>
                )}
              </div>
            )}
          </div>

          <div className="ai-examples">
            {current.examples.map((ex) => (
              <button key={ex} className="ai-ex" onClick={() => run(ex)} disabled={busy}>
                {ex}
              </button>
            ))}
          </div>

          <form
            className="ai-input"
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "support" ? "Describe your issue…" : current.hint + "…"}
              disabled={busy}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
