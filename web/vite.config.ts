import { defineConfig } from "npm:vite";
import react from "npm:@vitejs/plugin-react";
import tailwindcss from "npm:@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  build: { outDir: "dist", emptyOutDir: true },
});
