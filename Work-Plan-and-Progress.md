# Work Plan and Progress Document

| Field | Details |
|-------|---------|
| Name | V Meenakshi Iyer, Mercy Mary |
| BITS ID | 2025SL70043, 2025SL70043 |
| Course | Database Systems (DBMS) - Assignment 1 |
| Date | 23 September 2025 |
| Project | ShopSphere, a full-stack e-commerce application |

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
