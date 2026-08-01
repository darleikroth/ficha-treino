import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// ferramentas/cli.ts fica fora de src/ de propósito: é utilitário de inspeção e
// não deve entrar no bundle (CLAUDE.md).
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
