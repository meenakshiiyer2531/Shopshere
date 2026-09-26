# ShopSphere - Project Plan and Work Progress

## Student and Course Details

- Name: V Meenakshi Iyer, Mercy Mary
- ID: 2025SL70043, 2025SL70043
- Course Name / Number: Database Systems (DBMS) - Assignment 1
- Date: 23 September 2025
- Project Title: ShopSphere, a full-stack e-commerce web application

## Problem Statement

The aim of this assignment is to design and build a working e-commerce web
application that demonstrates a complete three-tier software architecture: a
presentation layer (frontend), an application/logic layer (backend), and a
data/persistence layer (database). The application also integrates an online
payment gateway so that the checkout reflects a realistic purchase flow.

From the customer's side, the application should let a user:

1. Browse a catalog of products and search or filter by category.
2. View detailed information for a selected product.
3. Add products to a shopping cart and change quantities.
4. Check out and pay online through a payment gateway (Razorpay).
5. Receive an order confirmation and see past orders.

An administrator should be able to create, read, update and delete products
directly from the interface, so that the data store can be managed without
touching the code.

The main goal, from a DBMS point of view, is to show how the three tiers
communicate: how the frontend issues requests, how the backend applies logic and
exposes an API, how records are stored and queried, and how a third-party payment
service is integrated in a secure way (order creation and signature verification
happen on the server).

## Planned Approach, Solution and Technology

### Architecture

The system follows a three-tier design with an external payment gateway. The
React frontend talks to the Express API over REST. The API is the only tier that
reads and writes the data store, and it is also responsible for creating the
Razorpay order and verifying the payment signature.

```
 React (Vite)  --REST-->  Express API  --read/write-->  JSON database
 presentation             application                    persistence
 :5173                    :4000                          backend/db.json
    |                         |
 cart in localStorage         +--- creates order + verifies signature ---> Razorpay
```

### Technology stack

- Frontend: React 18, Vite, React Router. Handles the storefront, cart,
  checkout, order history and the admin panel.
- Backend: Node.js with Express. Provides the REST API, request validation,
  business logic (order totals, stock) and payment orchestration.
- Database: a JSON file (db.json) accessed through a single data-access module.
  Products and orders are persisted here.
- Client storage: the browser's localStorage keeps the cart between visits.
- Payments: Razorpay (Orders API and Checkout), with server-side signature
  verification.
- Tooling: concurrently runs both tiers with one command; dotenv keeps the
  Razorpay keys out of the source.

### Design decisions

- All persistence goes through one module (backend/src/db.js). This keeps the
  storage mechanism isolated, so the JSON file can later be replaced by a
  relational DBMS such as PostgreSQL or MySQL without changing the API or the UI.
- The Razorpay order is created on the server, and the returned payment
  signature is verified with HMAC-SHA256 using the secret key before the order is
  saved. The secret key never reaches the browser.
- Secrets live in backend/.env, which is git-ignored. Only the public key id is
  sent to the client.
- The admin panel is protected by a login. Credentials (default user id admin,
  password 1234) are held in backend/.env and validated by the server at
  POST /api/auth/login; the browser keeps a session flag after a successful sign
  in.
- A small root package.json uses concurrently so the API and web app start
  together.

### REST API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/products | List products (supports category and q filters) |
| GET | /api/products/:id | Get a single product |
| POST | /api/products | Create a product (admin) |
| PUT | /api/products/:id | Update a product (admin) |
| DELETE | /api/products/:id | Delete a product (admin) |
| GET | /api/orders | List orders |
| POST | /api/orders | Create an order |
| GET | /api/payment/config | Return the public Razorpay key id |
| POST | /api/payment/order | Create a Razorpay order |
| POST | /api/payment/verify | Verify the signature and save the paid order |
| POST | /api/auth/login | Validate the admin login credentials |

### Data model (db.json)

- products: id, name, price, category, stock, rating, description
- orders: id, date, status, items, customer, total, payment

### Payment flow

1. The customer fills the checkout form and presses Pay.
2. The frontend calls POST /api/payment/order, and the backend creates a
   Razorpay order.
3. The Razorpay Checkout window opens and the customer pays (test card
   4111 1111 1111 1111, any future expiry and CVV).
4. Razorpay returns a payment id, order id and signature.
5. The frontend calls POST /api/payment/verify, and the backend checks the
   HMAC signature.
6. If the signature is valid, the order is saved to the database and a
   confirmation is shown.

## Plan, Deliverables and Dates

| No. | Deliverable | Planned Date | Status |
|-----|-------------|--------------|--------|
| 1 | Requirements finalised; stack and architecture decided | 23 Sep 2025 | Done |
| 2 | Backend: Express server, data-access layer, product and order APIs | 24 Sep 2025 | Done |
| 3 | Frontend: storefront, product detail, cart with localStorage | 24 Sep 2025 | Done |
| 4 | Razorpay payment integration (order, verify, persist) | 25 Sep 2025 | Done |
| 5 | Checkout flow and order history wired to the API | 25 Sep 2025 | Done |
| 6 | Admin panel with product CRUD | 25 Sep 2025 | Done |
| 7 | Single-command run, UI work, testing and documentation | 26 Sep 2025 | Done |
| 8 | Final submission | 26 Sep 2025 | Ready |

## Progress of Work as on 26th September

The application is complete and works end to end. What has been built:

- The three-tier architecture is in place (React, Express, JSON database).
- The REST API supports product CRUD and order placement, with input validation
  and correct HTTP status codes.
- The data-access layer (db.js) is seeded with 12 products across four
  categories.
- The storefront has a catalog grid, category filters, live search and product
  detail pages.
- The cart supports quantity changes and is kept in the browser's localStorage.
- Razorpay is integrated: the order is created on the server and the signature is
  verified with HMAC-SHA256. A verified test order was created successfully
  during testing.
- Checkout opens the Razorpay window and shows an order confirmation with the
  payment id.
- Order history reads back from the API.
- The admin panel adds, edits and deletes products, and the changes are reflected
  in the database immediately.
- Both tiers start together with a single command.

Testing carried out:

| Check | Result |
|-------|--------|
| GET /api/products | 200, returns 12 products |
| POST /api/orders | 201, total computed on the server |
| POST and DELETE /api/products | 201 and 204 |
| POST /api/payment/order | 200, a real Razorpay order id is returned |
| Frontend production build | Compiles with no errors |
| Both tiers via npm run dev | API on :4000 and web on :5173 |

## How to Run

Node.js 18 or later is required. From the project root, one command installs and
runs both tiers:

```
npm install
npm run dev
```

Then open http://localhost:5173. Test payment credentials are in backend/.env.
Pay with card 4111 1111 1111 1111, any future expiry, any CVV and any OTP.

The admin panel at /admin requires a login. Use user id admin and password 1234
(configurable in backend/.env).

## Notes for Lab and Course Faculty

1. As permitted for this milestone, persistence uses a JSON file behind a
   data-access layer, together with localStorage for the cart. The code is
   organised so that moving to a relational DBMS later only means rewriting
   backend/src/db.js.
2. Payments run in Razorpay test mode, so no real money is charged.
3. The admin panel is protected by a simple credential login (user id admin,
   password 1234, configurable in backend/.env) validated at
   POST /api/auth/login. This is a demonstration-level gate; a production build
   would store hashed credentials in the database and issue signed session
   tokens.

There are no blocking issues. Guidance on the preferred target DBMS for the next
phase would be welcome.
