import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr, monogram } from "../api.js";
import { useCart } from "../context/CartContext.jsx";
import GlassBox from "./GlassBox.jsx";

/**
 * AIAssistant — ShopSphere's single conversational AI chatbot.
 *
 * One chat box, no modes: the backend /api/ai/chat auto-detects whether you're
 * searching, describing a vibe, giving a budget, or need customer care, then
 * replies and shows real, clickable product cards (open the product, add to
 * cart) plus the live SQL behind every answer (the "glass box").
 */
const SUGGESTIONS = [
  "wireless headphones under 10000",
  "a gift for a coffee lover",
  "home office setup for 20000",
  "where is my order?",
];

function ProductResult({ p, onAdd }) {
  return (
    <div className="ai-prod">
      <Link to={`/product/${p.id}`} className="ai-prod-thumb" data-cat={p.category}>
        {monogram(p.name)}
      </Link>
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
  const { add } = useCart();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([
    {
      from: "bot",
      text: "Hi! I'm your ShopSphere assistant. Tell me what you're after — a product, a gift idea, a budget, or help with an order.",
    },
  ]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  const addProduct = (p, qty = 1) => {
    add(p, qty);
    notify?.(`Added "${p.name}" to cart`);
  };

  async function send(q) {
    const message = (q ?? text).trim();
    if (!message || busy) return;
    setMsgs((m) => [...m, { from: "user", text: message }]);
    setText("");
    setBusy(true);
    try {
      const r = await api.ai.chat(message);
      // Conversational cart: auto-add when the shopper asked to.
      if (r.cartAction === "add_to_cart" && r.products?.[0]) {
        addProduct(r.products[0], r.quantity || 1);
      }
      setMsgs((m) => [
        ...m,
        {
          from: "bot",
          text: r.reply,
          products: r.products || [],
          sql: r.sql,
          engine: r.engine,
          mode: r.mode,
          action: r.action,
          ticket: r.ticket,
          spent: r.spent,
          budget: r.budget,
        },
      ]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

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
        <div className="ai-panel" role="dialog" aria-label="ShopSphere AI assistant">
          <div className="ai-panel-head">
            <div>
              <strong>ShopSphere AI</strong>
            </div>
            <p className="ai-panel-sub">Ask anything — every answer shows the real database query behind it.</p>
          </div>

          <div className="ai-body">
            <div className="ai-chat">
              {msgs.map((m, i) => (
                <div key={i} className={`ai-msg ai-msg-${m.from}`}>
                  {m.text && <div className="ai-bubble">{m.text}</div>}

                  {m.products?.length > 0 && (
                    <div className="ai-prodlist">
                      {m.products.map((p) => (
                        <ProductResult key={p.id} p={p} onAdd={addProduct} />
                      ))}
                      {m.mode === "budget" && (
                        <div className="ai-budget-foot">
                          <span>
                            Total {inr(m.spent)} / {inr(m.budget)}
                          </span>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              m.products.forEach((p) => add(p, 1));
                              notify?.(`Added ${m.products.length} items to cart`);
                            }}
                          >
                            Add all
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {m.action?.type === "refund" && (
                    <div className="ai-refund">
                      ✓ Refund of {inr(m.action.amount)} initiated · order now “{m.action.newStatus}”
                    </div>
                  )}
                  {m.ticket && (
                    <div className="ai-ticket">
                      Ticket #{m.ticket.id} · {m.ticket.status}
                    </div>
                  )}
                  {m.sql && <GlassBox sql={m.sql} engine={m.engine} />}
                </div>
              ))}
              {busy && (
                <div className="ai-msg ai-msg-bot">
                  <div className="ai-bubble ai-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {msgs.length <= 1 && (
            <div className="ai-examples">
              {SUGGESTIONS.map((ex) => (
                <button key={ex} className="ai-ex" onClick={() => send(ex)} disabled={busy}>
                  {ex}
                </button>
              ))}
            </div>
          )}

          <form
            className="ai-input"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message ShopSphere AI…"
              disabled={busy}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
