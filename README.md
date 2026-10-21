# ShopSphere — Full-Stack E-Commerce App

DBMS Assignment 1 | V Meenakshi Iyer (2025SL70043), Mercy Mary (2025SL70044)

A modern e-commerce application built as a classic three-tier system:

- **Frontend:** React 18 with Vite (storefront, cart, checkout, order history, admin dashboard)
- **Backend:** Node.js with Express REST API
- **Database:** Neon Postgres (serverless), accessed through a `pg` connection pool
  in a data-access layer; the browser cart uses localStorage
- **Payments:** Razorpay in test mode, with server-side signature verification

## Features

- Product catalog with category filters and live search
- Product detail pages with quantity selection
- Shopping cart persisted in localStorage
- Checkout with online payment through Razorpay
- Order history page for shoppers
- Admin dashboard (login-protected) with:
  - live store stats (products, orders, revenue)
  - full **product CRUD** (create, edit, delete)
  - **order management** — records every order, update status
    (Confirmed → Processing → Shipped → Delivered / Cancelled), delete
- Refined editorial storefront: Fraunces + Manrope type, warm ivory palette,
  responsive and animated

## Project Structure

```
DBMS Assignment/
├── DATABASE-DESIGN.md             ER diagram, schema, DDL, normalization
├── README.md
├── package.json                   root scripts to run both tiers together
├── backend/                       Express REST API
│   ├── server.js                  exports the app (Vercel-ready) + local listen
│   ├── config.js
│   ├── vercel.json                Vercel serverless config
│   ├── .env.example
│   ├── scripts/init-db.js         creates tables + seeds products
│   └── src/
│       ├── pool.js                shared pg connection pool
│       ├── db.js                  async Postgres data-access layer
│       └── routes/
│           ├── products.js
│           ├── orders.js          GET/POST + PATCH status + DELETE
│           ├── payment.js
│           └── auth.js            admin login
└── frontend/                      React app (Vite)
    ├── index.html
    ├── vite.config.js             proxies /api → http://localhost:4100
    └── src/
        ├── api.js
        ├── App.jsx
        ├── context/CartContext.jsx
        ├── components/
        └── pages/
```

## Running the App

Node.js 18 or later is required.

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

- `DATABASE_URL` — your Neon Postgres pooled connection string
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Razorpay test keys
- `PORT` — defaults to `4100`

### 2. Install and initialise the database

```bash
npm install                 # installs both tiers
npm run db:init --prefix backend   # creates tables + seeds products (first run only)
```

### 3. Start both tiers

```bash
npm run dev
```

- API runs at http://localhost:4100
- Storefront runs at http://localhost:5173

Open http://localhost:5173. Vite proxies `/api` calls to the backend
automatically, so no extra configuration is needed.

### Payment configuration

On the checkout page, pay with test card `4111 1111 1111 1111`, any future
expiry, any CVV and any OTP. No real money is charged in test mode.

### Admin login

The admin dashboard at http://localhost:5173/admin is login-protected:

- User ID: `admin`
- Password: `1234`

Change these in `backend/.env` (`ADMIN_USER` / `ADMIN_PASSWORD`). Credentials
are validated by the server at `POST /api/auth/login`.

## Deploying the backend to Vercel

The Express app exports itself as a serverless handler (`module.exports = app`
with a `require.main === module` guard), and `backend/vercel.json` routes all
requests to it.

```bash
cd backend
vercel            # link + deploy a preview
vercel --prod     # promote to production
```

In the Vercel project settings, add the same environment variables as `.env`
(`DATABASE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `ADMIN_USER`,
`ADMIN_PASSWORD`). Then point the frontend's `/api` proxy (or a production API
base URL) at the deployed URL.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/products | List products (?category=, ?q=) |
| GET | /api/products/:id | Single product |
| POST | /api/products | Create product |
| PUT | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |
| GET | /api/orders | List orders |
| POST | /api/orders | Place an order |
| PATCH | /api/orders/:id | Update order status |
| DELETE | /api/orders/:id | Delete an order |
| GET | /api/payment/config | Public Razorpay key id |
| POST | /api/payment/order | Create a Razorpay order |
| POST | /api/payment/verify | Verify signature and save the paid order |
| POST | /api/auth/login | Validate admin credentials |

## Notes

- Data persists to Neon Postgres. Re-running `npm run db:init` is safe: tables
  are created with `IF NOT EXISTS` and products are seeded only when the table
  is empty.
- The cart is stored in the browser under the `shopsphere_cart` key.
- Orders are created server-side and the Razorpay signature is verified with
  HMAC-SHA256 before the order is saved. The secret key never reaches the
  browser.
- Secrets live only in `backend/.env`, which is git-ignored and never committed.

## ShopSphere AI — glass-box AI layer

ShopSphere ships a cohesive **AI layer** whose defining idea is the *glass box*:
every AI answer reveals the real database query behind it. The language model
never executes SQL — it returns a validated *intent*, and the backend builds a
**parameterised** (injection-safe) query from it. Powered by **SAP AI Core**
(Generative AI Hub) when credentials are present, with a deterministic fallback
engine so every feature works offline, for free, and never breaks a demo.

Open it from the floating **✨ Ask AI** button (bottom-right). Six features:

1. **Ask ShopSphere** — type a request in plain English
   (*"wireless headphones under ₹3000 rated above 4, cheapest first"*); it
   compiles to safe SQL, shows it, and returns products. Also does
   conversational cart (*"add 2 of the cheapest"*).
2. **Shop by Vibe** — mood/occasion search (*"gift for a techie dad"*) via
   Postgres full-text search (`tsvector` + GIN index).
3. **Budget Basket** — *"home-office setup for ₹15,000"* assembles a
   complementary cart within budget, with an explanation and "Add all".
4. **Fair-Price Meter** — on every product page, a one-glance gauge
   (*"cheaper than 78% of Electronics"*) computed with a SQL window function.
5. **Taste DNA** — explainable "bought together" recommendations mined from the
   `orders.items` JSONB, with a plain-English reason and the query shown.
6. **Customer-care chatbot** — tracks orders and resolves issues: a refund
   request updates the order to *Refund Initiated* and logs a `support_ticket`
   with the refund amount, right in the chat.

Admin → **AI Insights** tab shows the live `ai_query_log` and `support_ticket`
tables (a running audit trail of the AI layer).

### Configuration

Set the SAP AI Core keys in the project-root `.env` (see `backend/.env.example`
for the variable names). Without them the app automatically runs the fallback
engine. New AI endpoints live under `/api/ai/*`; the database objects are
created idempotently by `npm run db:init --prefix backend`. Safety-critical
logic has unit tests: `npm test --prefix backend`.

## Team & contributions

| Member | BITS ID | Phase 2 focus |
|--------|---------|---------------|
| V Meenakshi Iyer | 2025SL70043 | The ShopSphere AI layer — SAP AI Core engine + fallback, the injection-safe intent/query layer, the six AI features, all `/api/ai/*` routes and their SQL (window functions, JSONB, full-text), the assistant UI (chatbot, glass box, price meter, taste strip, admin AI Insights), and the unit tests |
| Mercy Mary | 2025SL70044 | Neon Postgres migration & schema, the ~620-product catalog & departments, non-AI UI and payload cleanup, Vercel deployment & environment, documentation, and QA |

A full, dated, step-by-step split of the Phase 2 work between both members is in
[Work-Plan-and-Progress.md](Work-Plan-and-Progress.md) (Section 8).

## Version history

- **v2.0 (Oct 2026)** — Migrated to Neon Postgres; added the ShopSphere AI
  glass-box layer (NL→SQL search, Shop by Vibe, Budget Basket, Fair-Price Meter,
  Taste DNA, customer-care chatbot) and grew the catalog to ~620 products.
- **v1.0 (Sep 2025)** — Original three-tier storefront with cart, Razorpay
  checkout, order history and admin product CRUD.
