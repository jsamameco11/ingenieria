import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { xaiPlugin } from "./vite-plugin-xai";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react(), xaiPlugin(mode)],
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api/charges": "http://127.0.0.1:8788",
      "/api/billing": "http://127.0.0.1:8788",
      "/api/control": "http://127.0.0.1:8788",
      "/api/v1": "http://127.0.0.1:8788",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        control: resolve(root, "control.html"),
      },
    },
  },
}));
