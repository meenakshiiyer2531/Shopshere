import { useState, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Toast from "./components/Toast.jsx";
import Home from "./pages/Home.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import Orders from "./pages/Orders.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  const [toast, setToast] = useState("");

  // Shared helper so any page can raise a transient toast.
  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  return (
    <>
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home notify={notify} />} />
          <Route path="/product/:id" element={<ProductDetail notify={notify} />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout notify={notify} />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/admin" element={<Admin notify={notify} />} />
        </Routes>
      </main>
      <Footer />
      <Toast message={toast} />
    </>
  );
}
