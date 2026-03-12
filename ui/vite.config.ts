import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { port: 5180, host: true, proxy: { "/api": "http://localhost:3001", "/health": "http://localhost:3001" } },
  build: { outDir: "dist" },
});
