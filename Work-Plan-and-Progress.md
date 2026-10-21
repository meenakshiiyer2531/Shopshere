# Work Plan and Progress Document

| Field | Details |
|-------|---------|
| Name | V Meenakshi Iyer, Mercy Mary |
| BITS ID | 2025SL70043, 2025SL70044 |
| Course | Database Systems (DBMS) - Assignment 1 |
| Date | 23 September 2025 (Phase 1) · 21 October 2026 (Phase 2 — AI layer) |
| Project | ShopSphere, a full-stack e-commerce application |

> **Document map.** Sections 1–5 record **Phase 1** (the original three-tier
> build, Sep 2025). Sections 6–9 record **Phase 2** (the migration to a real
> Neon Postgres DBMS and the "ShopSphere AI" glass-box AI layer, Oct 2026),
> including the step-by-step task split between the two team members.

## 1. Problem Statement

Design and build a functional e-commerce web application that demonstrates a
complete three-tier architecture: a presentation layer (frontend), an
application/logic layer (backend), and a data/persistence layer (database). The
application also integrates an online payment gateway so the checkout reflects a
realistic purchase flow.

The application must let a customer:

- Browse a catalog of products, search and filter by category.
- View product details.
- Add products to a cart and manage quantities.
- Place an order and pay online through a checkout flow.
- View their order history.

It must also provide an admin capability to create, read, update and delete
(CRUD) products, so the underlying data store can be managed through the UI.

The core learning objective is to show how the three tiers communicate: how the
frontend issues requests, how the backend exposes a REST API and applies logic,
how data is persisted and queried in the database layer, and how a third-party
payment service is integrated securely.

## 2. Planned Approach, Solution and Technology

Architecture (three-tier with an external payment gateway):

```
   React (Vite)          Express REST API          JSON-file database
   Presentation   -->    Application logic   -->   Persistence layer
   :5173                 :4000                      backend/db.json
   (cart in localStorage)         |
                                  +--> Razorpay (create order, verify signature)
```

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Frontend | React 18, Vite, React Router | Storefront UI, cart, checkout, admin panel |
| Backend | Node.js, Express | REST API, validation, business logic (totals, stock), payment orchestration |
| Database | JSON file (db.json) via a data-access module | Persist products and orders |
| Client storage | Browser localStorage | Persist the shopping cart between visits |
| Payments | Razorpay (test mode) | Online payment with server-side signature verification |

Key design decisions:

- All persistence is funneled through a single data-access module
  (backend/src/db.js). This isolates the storage mechanism so the JSON file can
  later be swapped for a real DBMS (PostgreSQL or MySQL) without touching the API
  routes, mirroring how a repository layer works in real systems.
- The backend exposes a clean REST API with proper HTTP verbs and status codes.
- The Razorpay order is created on the server, and the returned signature is
  verified with HMAC-SHA256 before the order is saved. The secret key never
  reaches the browser; only the public key id is sent to the client.
- The cart lives in the browser's localStorage so it survives page refreshes,
  satisfying the local storage requirement on the client side.

REST API surface:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/products | List products (supports ?category= and ?q= filters) |
| GET | /api/products/:id | Get one product |
| POST | /api/products | Create product (admin) |
| PUT | /api/products/:id | Update product (admin) |
| DELETE | /api/products/:id | Delete product (admin) |
| GET | /api/orders | List orders |
| POST | /api/orders | Place an order |
| GET | /api/payment/config | Public Razorpay key id |
| POST | /api/payment/order | Create a Razorpay order |
| POST | /api/payment/verify | Verify signature and save the paid order |
| POST | /api/auth/login | Validate admin login credentials |

Data model (db.json):

- products[]: id, name, price, category, stock, rating, description
- orders[]: id, date, status, items[], customer{}, total, payment{}

## 3. Plan, Deliverables and Dates

| No. | Deliverable | Planned Date | Status |
|-----|-------------|--------------|--------|
| 1 | Requirements finalised, tech stack and architecture decided | 23 Sep 2025 | Done |
| 2 | Backend: Express server, data-access layer, product and order APIs | 24 Sep 2025 | Done |
| 3 | Frontend: storefront, product detail, cart (localStorage) | 24 Sep 2025 | Done |
| 4 | Razorpay payment integration (order, verify, persist) | 25 Sep 2025 | Done |
| 5 | Checkout flow and order history wired to the API | 25 Sep 2025 | Done |
| 6 | Admin panel (product CRUD) | 25 Sep 2025 | Done |
| 7 | Single-command run, UI polish, testing and documentation | 26 Sep 2025 | Done |
| 8 | Final submission | 26 Sep 2025 | Ready |

## 4. Progress of Work as on 26th September

Overall status: complete and working end to end.

Completed:

- Three-tier architecture implemented (React, Express, JSON database).
- Full REST API with product CRUD and order placement, including input
  validation and correct HTTP status codes.
- Data-access layer (db.js) that reads and writes db.json, seeded with 12
  products across 4 categories.
- Storefront: catalog grid, category filter, live search, product detail pages.
- Shopping cart with quantity controls, persisted in browser localStorage.
- Razorpay payment integrated: the order is created on the server and the
  signature is verified with HMAC-SHA256. A verified test order was created
  successfully during testing.
- Checkout flow that opens the Razorpay window and shows an order confirmation
  with the payment id.
- Order history page reading back from the API.
- Admin panel: add, edit and delete products, reflected immediately in the
  database. The panel is protected by a login (user id admin, password 1234)
  validated by the server at POST /api/auth/login.
- Polished, responsive, modern Amazon-style storefront with a custom design
  system, animations and toasts.
- Both tiers start together with a single command; README documents the run.

How to run (see README.md for full detail):

```bash
npm install
npm run dev
```

This installs every package and starts the API on port 4000 and the storefront
on port 5173. Open http://localhost:5173. On checkout, pay with test card
4111 1111 1111 1111, any future expiry, any CVV and any OTP. The admin panel at
/admin requires a login: user id admin, password 1234.

## 5. Issues to Inform Lab / Course Faculty

1. Database choice: as permitted for this milestone, persistence uses a JSON file
   accessed through a data-access layer on the backend, plus the browser's
   localStorage for the cart. The code is deliberately structured so that
   migrating to a full relational DBMS (for example PostgreSQL or MySQL) in a
   later phase only requires replacing backend/src/db.js, with no API or UI
   changes.
2. Authentication: the admin panel is protected by a simple credential login
   (user id admin, password 1234, configurable in backend/.env) validated at
   POST /api/auth/login. This is a demonstration-level gate; a production build
   would store hashed credentials in the database and issue signed session
   tokens.
3. Payments run in Razorpay test mode, so no real money is charged.

No blocking issues. Guidance would be welcome on the preferred target DBMS for
the next phase.


---

# Phase 2 — Neon Postgres DBMS + "ShopSphere AI" Glass-Box AI Layer

## 6. Phase 2 Overview (October 2026)

Phase 2 upgrades ShopSphere in two ways that are directly relevant to a
**database systems** course:

1. **Real DBMS.** Persistence was moved from the JSON file to **Neon Postgres**
   (serverless PostgreSQL) accessed through a `pg` connection pool in the same
   data-access layer, so the API and UI were unchanged — exactly the migration
   path the Phase 1 design anticipated.

2. **ShopSphere AI — a glass-box AI layer.** A cohesive AI capability whose
   defining principle is that *every AI answer reveals the real database query
   behind it*. The language model never executes SQL: it returns a validated
   **intent** object and the backend builds a **parameterised** (injection-safe)
   query from it. The AI is powered by **SAP AI Core** (Generative AI Hub) with
   a deterministic fallback engine so it always works, offline and at zero cost.

Six user-facing features were delivered, each exercising a distinct DBMS
concept:

| # | Feature | What the shopper does | DBMS concept demonstrated |
|---|---------|-----------------------|---------------------------|
| F1 | Natural-language search (main search bar **and** chatbot) | Types plain English; gets products | NL → safe parameterised SQL (`JOIN`/`WHERE`/`ORDER BY`), injection prevention |
| F2 | Budget Basket | "home office setup for 15000" | Constrained selection + aggregates |
| F3 | Taste DNA recommender | "bought together" on product pages | `jsonb_array_elements` self-join, `GROUP BY`/`HAVING` |
| F4 | Fair-Price Meter | "cheaper than 78% of Electronics" gauge | `PERCENT_RANK()` **window function** |
| F5 | Shop by Vibe | "a gift for a coffee lover" | **Full-text search** (`tsvector` + **GIN index**) |
| F6 | Customer-care chatbot | Track orders, refunds, returns | `UPDATE` + new `support_ticket` table (FK, audit trail) |

New database objects: `ai_query_log` (audit/analytics of every AI call),
`support_ticket` (FK to `orders` with `ON DELETE SET NULL`), a generated
`search_vector tsvector` column on `products`, and a GIN index. Catalog grown
to ~620 realistic products across 8 departments (Electronics, Fashion, Home,
Books, Beauty, Sports, Toys, Grocery).

## 7. Team Member Responsibilities (summary)

| Member | BITS ID | Primary ownership |
|--------|---------|-------------------|
| **V Meenakshi Iyer** | 2025SL70043 | The ShopSphere AI layer end to end: the SAP AI Core engine and deterministic fallback, intent validation and the SQL-injection-safe parameterised query builder, the six AI features (NL search, Shop by Vibe, Budget Basket, Fair-Price Meter, Taste DNA, customer-care chatbot), the `/api/ai/*` routes and their SQL (window functions, JSONB, full-text), the assistant interface (chatbot, glass box, price meter, taste strip, admin AI Insights), and the unit tests. |
| **Mercy Mary** | 2025SL70044 | The Neon Postgres migration and schema, the ~620-product catalog and the new departments, the non-AI UI changes (header and branding cleanup), product-API payload cleanup, Vercel deployment and environment setup, documentation, and QA/regression testing. |
| **Both** | — | Phase 2 design kick-off and the final submission review. |

## 8. Step-by-Step Task Breakdown and Progress (Phase 2)

Legend — Owner: **MI** = V Meenakshi Iyer, **MM** = Mercy Mary, **Both** = pair work.
All steps below are **Done**.

### 8.1 Design & database migration

| Step | Task | Owner | Date (2026) |
|------|------|-------|-------------|
| 1 | Brainstorm the AI feature set; agree the "glass-box" principle (always show the SQL) | Both | 14 Oct |
| 2 | Write the design spec (`docs/superpowers/specs/2026-10-21-shopsphere-ai-layer-design.md`) | MI | 14 Oct |
| 3 | Migrate persistence from `db.json` to Neon Postgres via the `pg` pool in `src/db.js` | MM | 14 Oct |
| 4 | Add idempotent schema in `scripts/init-db.js` (`products`, `orders`) and verify it runs on Neon | MM | 14 Oct |
| 5 | Confirm REST API + UI unchanged after the DBMS swap (regression check) | MM | 14 Oct |

### 8.2 AI engine & safety core

| Step | Task | Owner | Date (2026) |
|------|------|-------|-------------|
| 6 | Verify SAP AI Core credentials (OAuth2 client-credentials; list running deployments) | MI | 15 Oct |
| 7 | Build the AI Core client `src/ai/aicore.js` (token cache, orchestration completion, timeout) | MI | 15 Oct |
| 8 | Build the intent validator `src/ai/intent.js` with a strict column/operator **allowlist** | MI | 15 Oct |
| 9 | Build the parameterised query builder (search + full-text) — no model-authored SQL ever executed | MI | 15 Oct |
| 10 | Build the deterministic fallback parser `src/ai/fallback.js` (keywords, price/rating) | MI | 15 Oct |
| 11 | Build the facade `src/ai/index.js` (LLM → validated intent, auto-fallback) | MI | 15 Oct |
| 12 | Write unit tests for validation, query building and injection prevention (`test/intent.test.js`) | MI | 15 Oct |

### 8.3 Features F1, F4, F5 (search, price meter, vibe)

| Step | Task | Owner | Date (2026) |
|------|------|-------|-------------|
| 13 | Add `/api/ai/ask` (NL search) + the `ai_query_log` audit table | MI | 16 Oct |
| 14 | Add `search_vector` generated column + **GIN index**; wire `/api/ai/vibe` full-text search | MI | 16 Oct |
| 15 | Add Fair-Price Meter query using `PERCENT_RANK()` window function + `/api/ai/price-meter` | MI | 16 Oct |
| 16 | Build the reusable glass-box SQL panel component (`GlassBox.jsx`) | MI | 16 Oct |
| 17 | Build the `PriceMeter.jsx` gauge on the product page | MI | 16 Oct |

### 8.4 Features F3, F2 (recommender, budget)

| Step | Task | Owner | Date (2026) |
|------|------|-------|-------------|
| 18 | Write the JSONB co-purchase query (self-join on `orders.items`) + cold-start fallback | MI | 17 Oct |
| 19 | Add `/api/ai/recommend` and the Budget Basket selection logic + `/api/ai/budget` | MI | 17 Oct |
| 20 | Build `TasteStrip.jsx` (explainable recommendations) on the product page | MI | 17 Oct |
| 21 | Integrate PriceMeter + TasteStrip into `ProductDetail.jsx` | MI | 17 Oct |

### 8.5 Feature F6 (customer-care chatbot)

| Step | Task | Owner | Date (2026) |
|------|------|-------|-------------|
| 22 | Design and create the `support_ticket` table (FK to `orders`, `ON DELETE SET NULL`) | MI | 18 Oct |
| 23 | Build the support classifier `src/ai/support.js` (refund/return/track/damaged) | MI | 18 Oct |
| 24 | Implement the refund flow: `UPDATE orders` → `Refund Initiated` + log a ticket | MI | 18 Oct |
| 25 | End-to-end test: create order → chatbot refund → verify DB status + ticket | MI | 18 Oct |

### 8.6 Chatbot UI, catalog & departments

| Step | Task | Owner | Date (2026) |
|------|------|-------|-------------|
| 26 | Build the floating AI assistant panel + API client methods (`api.ai.*`) | MI | 19 Oct |
| 27 | Add the admin "AI Insights" tab (live `ai_query_log` + `support_ticket`) | MI | 19 Oct |
| 28 | Write the `seed-catalog.js` generator and seed ~150 products | MM | 20 Oct |
| 29 | Add 4 new departments (Beauty, Sports, Toys, Grocery) + category colours in nav/home/admin | MM | 20 Oct |
| 30 | Collapse the four mode tabs into one auto-routing conversational chatbot (`/api/ai/chat`) | MI | 20 Oct |

### 8.7 Hardening, UX fixes, deployment & docs (21 Oct)

| Step | Task | Owner | Date (2026) |
|------|------|-------|-------------|
| 31 | Fix: treat model `0` for price/rating/budget as "unset" (was returning no rows) | MI | 21 Oct |
| 32 | Smarter search cascade: honour price caps, relax wrong category/keywords, honest "related picks" | MI | 21 Oct |
| 33 | Natural-language **main search bar** routed through the AI, showing the generated SQL on results | MI | 21 Oct |
| 34 | Spread catalog prices per product type and grow catalog to ~620 products | MM | 21 Oct |
| 35 | Remove engine branding from the UI and the header category bar (per review) | MM | 21 Oct |
| 36 | Fix: add the missing `api.ai.chat` client method (chatbot error) | MI | 21 Oct |
| 37 | Strip internal `search_vector` from all product API responses | MM | 21 Oct |
| 38 | Set SAP AI Core env vars in Vercel; deploy backend + frontend to production | MM | 21 Oct |
| 39 | Update README and DATABASE-DESIGN (AI objects, queries, concepts) and this plan | MM | 21 Oct |
| 40 | Final pair review and production smoke test of all six features | Both | 21 Oct |

## 9. Progress of Work as on 21 October 2026

**Overall status: Phase 2 complete, tested and deployed to production.**

Completed:

- Persistence migrated to **Neon Postgres**; schema created idempotently.
- **ShopSphere AI** delivered with all six features working against the live
  database; the language model never executes SQL (validated intent →
  parameterised query), proven by unit tests that reject injection attempts.
- DBMS techniques demonstrated end to end: parameterised dynamic queries,
  JOINs and self-joins, aggregates with `GROUP BY`/`HAVING`, a **window
  function** (`PERCENT_RANK`), **full-text search** with a **GIN index**,
  **JSONB** querying, a foreign key with `ON DELETE SET NULL`, and an audit
  table (`ai_query_log`).
- One conversational chatbot that auto-routes to search / vibe / budget /
  customer-care and surfaces clickable products and the real SQL.
- Catalog grown to ~620 realistic products across 8 departments.
- Unit tests passing (`npm test --prefix backend`: 9/9).
- Deployed to Vercel: storefront and API live, running on SAP AI Core in
  production.

Verification evidence (sampled on 21 Oct 2026):

- "wireless headphones under 10000" → 3 real headphones ₹3,999–9,599.
- "a gift for a coffee lover under 3000" → coffee sets and beans (full-text).
- Chatbot refund on a test order → order moved to "Refund Initiated" and a
  `support_ticket` row created with the refund amount.

How to run Phase 2 locally:

```bash
npm install
npm run db:init --prefix backend     # create Postgres schema + AI objects
npm run seed:catalog --prefix backend # seed ~620 products
npm run dev                          # start API + storefront
npm test --prefix backend            # run the safety unit tests
```

SAP AI Core credentials live in the project-root `.env` (see
`backend/.env.example` for the variable names); without them the app runs its
deterministic fallback engine automatically.

## 10. Issues to Inform Lab / Course Faculty (Phase 2)

1. The target DBMS for this phase is **Neon Postgres** (serverless
   PostgreSQL), chosen because its full-text search, window functions and JSONB
   support let the AI features showcase advanced SQL.
2. AI safety: the LLM output is never run as SQL. It is validated against a
   column/operator allowlist and compiled into a parameterised query, which is
   the core database-security point of the phase.
3. The AI provider is SAP AI Core (Generative AI Hub); a deterministic fallback
   keeps every feature working without the service, so the demo never depends on
   network access.

No blocking issues.
