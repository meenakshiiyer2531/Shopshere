# ShopSphere AI — Glass-Box AI Shopping Layer (Design)

Date: 2026-10-21
Project: ShopSphere (DBMS Assignment) — React + Express + Neon Postgres
Authors: design by Claude with V Meenakshi Iyer / Mercy Mary

## 1. Goal

Add a cohesive **AI layer** to the existing ShopSphere e-commerce app that is:

- **Novel** — combines things consumer stores deliberately hide (the query/data
  behind each answer) with budget optimisation and explainable recommendations.
- **Genuinely useful** — helps a real shopper find, compare, bundle and decide.
- **Easy for any user** — mostly a single text box plus one-glance visuals; no
  training needed.
- **A true DBMS showcase** — every feature's core work is a SQL query over the
  Postgres schema, and the UI *shows* that query (the "glass box").

### Honesty note on "never done before"
Absolute novelty ("never used in any e-commerce app") cannot be proven. What is
genuinely distinctive here is the **glass-box principle**: the app surfaces the
actual SQL and data behind every AI answer, as a first-class feature. Normal
stores hide this; a DBMS assignment turns it into the selling point. The
*combination* (transparent NL→SQL + budget optimiser + explainable recommender
+ window-function price meter + full-text vibe search, all sharing one glass-box
UI) is the novel contribution.

## 2. Non-goals

- No change to payments (Razorpay), auth, or the existing cart mechanics beyond
  letting the AI add/remove items.
- No migration to the normalised 6-table ER model; we build on the **real
  runtime schema** (`products`, `orders`).
- The AI never executes free-form SQL authored by the model (see Safety).

## 3. Existing system (as-built)

- `products(id, name, price, category, stock, rating, description, created_at)`
- `orders(id, items JSONB, customer JSONB, total, status, date)`
- Backend: Express, data-access in `backend/src/db.js`, routes in
  `backend/src/routes/*`, pool in `backend/src/pool.js`.
- Frontend: React + Vite; pages in `frontend/src/pages`, cart in
  `frontend/src/context/CartContext.jsx`, API client in `frontend/src/api.js`.
- Secrets in `backend/.env` (Razorpay, Neon). SAP AI Core credentials in the
  **root** `.env` (`AICORE_CLIENT_ID/SECRET/AUTH_URL/BASE_URL/RESOURCE_GROUP`).

## 4. AI engine adapter

A single backend module `backend/src/ai/engine.js` exposes `interpret(nlText,
context)` and `complete(prompt)` and hides *how* the answer is produced.

**Primary path — SAP AI Core (Generative AI Hub):**
1. OAuth2 client-credentials: `POST {AICORE_AUTH_URL}/oauth/token` with
   `grant_type=client_credentials` + client id/secret → bearer token. Token is
   cached in memory until ~60s before expiry.
2. Discover an LLM deployment: `GET {AICORE_BASE_URL}/v2/lm/deployments` with
   headers `Authorization: Bearer …`, `AI-Resource-Group: default`. Pick a
   RUNNING deployment (configurable override via `AICORE_DEPLOYMENT_ID`).
3. Inference via the deployment's completion/orchestration endpoint; send a
   strict system prompt that asks the model to return **only** a JSON intent
   object (see Safety). Timeout ~8s.

**Fallback path — deterministic engine `backend/src/ai/fallback.js`:**
A rules + keyword parser that converts common phrasings into the same intent
JSON (price bounds, category synonyms, rating threshold, sort, budget, vibe
keywords). Used automatically when: no AI Core creds, token/deploy/inference
fails, or the model returns invalid JSON. Guarantees the feature always works in
a live demo, offline, at zero cost.

Config lives in `backend/config.js` under `ai: { enabled, resourceGroup,
deploymentId, timeoutMs }`, reading the root `.env`. `.env.example` documents
the new keys; real secrets stay untracked.

## 5. Safety model (the key DBMS/security point)

The LLM NEVER writes SQL we execute. Instead:

1. Model returns a constrained **Intent JSON**, e.g.
   `{ "action": "search", "filters": {"category": "Electronics",
   "priceMax": 3000, "ratingMin": 4}, "sort": "price_asc", "limit": 20 }`.
2. A validator (`backend/src/ai/intent.js`) checks every field against an
   **allowlist** of columns, operators, sort keys and numeric ranges. Anything
   unknown is dropped.
3. A query builder turns the validated intent into a **parameterised** SQL
   string (`$1, $2 …`) — the only SQL ever sent to Postgres.
4. The same builder returns a human-readable rendering of that parameterised
   query (values inlined for display only) for the glass-box panel.

This demonstrates injection prevention and the separation between
user intent and executed SQL — core DBMS/security material.

## 6. Features

Each feature: UX → AI role → SQL/DB → glass-box display.

### F1. Ask ShopSphere (blends NL-search + conversational cart)
- **UX:** A persistent "Ask ShopSphere" bar/panel on the storefront. Free text.
  Example: *"wireless headphones under ₹3000 rated above 4, cheapest first."*
  Also cart verbs: *"add 2 of the cheapest", "remove the keyboard".*
- **AI:** NL → Intent JSON (`action: search | add_to_cart | remove_from_cart`).
- **DB:** parameterised `SELECT … FROM products WHERE … ORDER BY … LIMIT …`
  (ILIKE for text, range predicates for price/rating, category equality).
  Cart actions resolve the intent to concrete product rows, then call existing
  cart logic.
- **Glass box:** shows the generated SQL, the row count, and result cards.
  Refinement chips (price, category, rating, sort) re-run with tweaked intent.

### F2. Budget Basket Builder
- **UX:** *"build me a ₹15,000 home-office setup."* Returns a suggested cart of
  complementary products within budget + one-line reason per item, with an
  "Add all to cart" button.
- **AI:** NL → `{ action: "budget_basket", budget, theme, categories }`.
- **DB:** candidate `SELECT` by theme/category within price; a greedy/knapsack
  selection in JS over the candidate rows to maximise value under budget.
- **Glass box:** shows the candidate query, the budget maths, and total.

### F3. Taste DNA — explainable recommender
- **UX:** "Recommended for you" strip; each card has a plain-English reason:
  *"People who bought Aurora Headphones also bought the Vortex Keyboard."*
- **AI:** optional — AI only phrases the explanation; the signal is pure SQL.
- **DB:** co-purchase from `orders.items` JSONB using
  `jsonb_array_elements`, self-join on order id, `GROUP BY` partner product,
  `HAVING count >= 2`, order by frequency. (Great JSONB + aggregate showcase.)
  Cold-start fallback: top-rated / best-selling by category.
- **Glass box:** shows the co-purchase query and the counts behind each pick.

### F4. Fair-Price Meter
- **UX:** On each product page, a small gauge: *"Cheaper than 78% of
  Electronics"* plus category min/avg/max.
- **AI:** none required (pure analytics); AI optionally writes the one-liner.
- **DB:** window functions over `products`:
  `PERCENT_RANK() OVER (PARTITION BY category ORDER BY price)` and category
  aggregates (`MIN/AVG/MAX`). One-glance, instantly understandable.
- **Glass box:** expandable "how we calculated this" showing the window query.

### F5. Shop by Vibe (semantic/occasion search)
- **UX:** Chips + text for moods/occasions: *"gift for a techie dad under
  5000", "cosy monsoon reading".* Returns matching products.
- **AI:** NL → `{ vibe keywords, filters }`; expands the vibe into search terms.
- **DB:** Postgres **full-text search** — a generated `search_vector tsvector`
  column over `name + description + category`, a **GIN index**, and
  `to_tsquery`/`websearch_to_tsquery` ranking with `ts_rank`. Falls back to
  `ILIKE` if FTS unavailable.
- **Glass box:** shows the `tsquery` and ranked results.

## 7. New database objects

Added idempotently in `backend/scripts/init-db.js` (and a new
`backend/scripts/migrate-ai.js` for existing DBs):

- `ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector`
  maintained by a trigger (or generated column) over name/description/category;
  `CREATE INDEX IF NOT EXISTS products_search_idx ON products USING GIN
  (search_vector)`.
- `CREATE TABLE IF NOT EXISTS ai_query_log (
     id BIGSERIAL PRIMARY KEY,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     feature TEXT NOT NULL,            -- 'ask' | 'budget' | 'vibe' | 'taste'
     nl_text TEXT,                     -- what the user typed
     intent JSONB,                     -- validated intent
     generated_sql TEXT,               -- the parameterised SQL rendered
     result_count INTEGER,
     engine TEXT                       -- 'aicore' | 'fallback'
   );`
  Powers an admin analytics view and serves as an audit trail (DBMS artifact).

## 8. API endpoints (new)

Mounted under `/api/ai` (`backend/src/routes/ai.js`):

- `POST /api/ai/ask` → `{ nl }` → `{ intent, sql, engine, results }`
- `POST /api/ai/budget` → `{ nl }` → `{ basket, sql, total, explanation }`
- `GET  /api/ai/recommend?productId=&limit=` → `{ items, sql }`
- `GET  /api/ai/price-meter/:productId` → `{ percentile, min, avg, max, sql }`
- `POST /api/ai/vibe` → `{ nl }` → `{ tsquery, results, sql }`
- `GET  /api/ai/log?limit=` (admin) → recent `ai_query_log` rows

All handlers: validate input → engine.interpret (or analytics query) → build
parameterised SQL → run → log to `ai_query_log` → respond.

## 9. Frontend

- `frontend/src/api.js`: add `ai.*` client methods.
- `frontend/src/components/AskSphere.jsx`: the shared conversational panel used
  by F1/F2/F5 (one text box, result cards, chips).
- `frontend/src/components/GlassBox.jsx`: reusable collapsible "SQL + data"
  panel used by every feature.
- `frontend/src/components/PriceMeter.jsx`: the F4 gauge on ProductDetail.
- `frontend/src/components/TasteStrip.jsx`: the F3 recommendations strip on Home
  and ProductDetail.
- Admin page gains an "AI Insights" tab reading `/api/ai/log`.
- Styling reuses the existing editorial look (Fraunces/Manrope, ivory palette).

## 10. Testing (TDD)

- **Intent validator** unit tests: allowlist enforcement, range clamping,
  malicious strings dropped, injection attempts neutralised.
- **Query builder** tests: intent → expected parameterised SQL + params.
- **Fallback parser** tests: representative phrasings → correct intent.
- **Recommender SQL** test against a seeded fixture (known co-purchases).
- **Price-meter SQL** test: percentile correctness on a fixture.
- **Route tests** (supertest): each endpoint returns shape + logs a row;
  AI-Core failure path falls back deterministically.
- Engine calls to SAP AI Core are mocked in tests (no live network in CI).

## 11. Implementation order (phased, each standalone)

1. **Infra:** config + `.env.example`, engine adapter + fallback, intent
   validator + query builder, `ai_query_log`, `/api/ai` router skeleton, tests.
2. **F1 Ask ShopSphere** (search + cart) + GlassBox UI.
3. **F4 Fair-Price Meter** (window functions) — small, high-impact.
4. **F5 Shop by Vibe** (FTS + GIN index + migration).
5. **F3 Taste DNA** (JSONB co-purchase) + TasteStrip.
6. **F2 Budget Basket Builder**.
7. Admin "AI Insights" tab; README + DATABASE-DESIGN updates (document the new
   table, index, window-function and FTS usage for the grader).

## 12. Risks & mitigations

- **SAP AI Core deployment/model unknown at design time** → adapter discovers
  deployments at runtime and is overridable via `AICORE_DEPLOYMENT_ID`; all
  features degrade to the deterministic engine so the demo never breaks.
- **Live credentials in `.env`** → never hardcoded, never logged, never sent
  anywhere except SAP AI Core; `.env` stays git-ignored.
- **Scope is large for one assignment** → strictly phased; after phase 1 every
  feature is independent and individually demoable.
- **JSONB co-purchase on little order data** → cold-start fallback to
  top-rated/best-seller by category.

## 13. DBMS concepts demonstrated (for the report)

Parameterised dynamic queries & injection prevention; JOINs and self-joins;
aggregates with `GROUP BY`/`HAVING`; **window functions** (`PERCENT_RANK`);
**full-text search** with `tsvector` + **GIN index**; **JSONB** querying
(`jsonb_array_elements`); auditing/logging table; schema migration with
`IF NOT EXISTS`.
