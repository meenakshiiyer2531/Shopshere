/** Thin API client wrapping fetch calls to the Express backend. */
const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  // Products
  listProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${BASE}/products${qs ? `?${qs}` : ""}`).then(handle);
  },
  getProduct: (id) => fetch(`${BASE}/products/${id}`).then(handle),
  createProduct: (body) =>
    fetch(`${BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),
  updateProduct: (id, body) =>
    fetch(`${BASE}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),
  deleteProduct: (id) =>
    fetch(`${BASE}/products/${id}`, { method: "DELETE" }).then(handle),

  // Orders
  listOrders: () => fetch(`${BASE}/orders`).then(handle),
  createOrder: (body) =>
    fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),
  updateOrderStatus: (id, status) =>
    fetch(`${BASE}/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(handle),
  deleteOrder: (id) =>
    fetch(`${BASE}/orders/${id}`, { method: "DELETE" }).then(handle),

  // Payments (Razorpay)
  createPaymentOrder: (amount) =>
    fetch(`${BASE}/payment/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    }).then(handle),
  verifyPayment: (body) =>
    fetch(`${BASE}/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  // Admin login
  login: (body) =>
    fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),
};

// Load the Razorpay Checkout script once, on demand.
export function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// Format paise-free INR nicely, e.g. 8999 -> ₹8,999
export const inr = (n) =>
  "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

// Build a two-letter monogram from a product name, e.g. "Aurora Wireless" -> "AW"
export const monogram = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
