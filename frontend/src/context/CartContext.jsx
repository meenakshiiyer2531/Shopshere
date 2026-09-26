import { createContext, useContext, useEffect, useState } from "react";

/**
 * CartContext — holds the shopping cart and persists it to localStorage
 * (the browser-side "local storage" layer for this assignment).
 */
const CartContext = createContext(null);
const STORAGE_KEY = "shopsphere_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = (product, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          qty,
        },
      ];
    });
  };

  const setQty = (id, qty) =>
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i))
        .filter((i) => i.qty > 0)
    );

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clear = () => setItems([]);

  const count = items.reduce((n, i) => n + i.qty, 0);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <CartContext.Provider
      value={{ items, add, setQty, remove, clear, count, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
