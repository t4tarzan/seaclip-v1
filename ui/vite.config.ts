import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5180,
    host: true,
    proxy: {
      "/api/companies": {
        target: "http://localhost:3001",
        timeout: 120_000,
      },
      "/api": "http://localhost:3001",
      "/health": "http://localhost:3001",
      "/spoke-agent.sh": "http://localhost:3001",
      "/ws": { target: "ws://localhost:3001", ws: true },
    },
  },
  build: { outDir: "dist" },
});
