import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config: proxy /api calls to the Express backend during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4100",
    },
  },
});
