import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// ferramentas/cli.ts fica fora de src/ de propósito: é utilitário de inspeção e
// não deve entrar no bundle (CLAUDE.md).
export default defineConfig({
  plugins: [vue()],
  // Porta própria e fixa. O escopo de um service worker é a origem inteira, e
  // `localhost:5173` é o default de todo projeto Vite — um app com PWA rodando
  // ali deixa um SW registrado que passa a servir o shell dele para qualquer
  // outro app na mesma porta. Some o app, sobra o cache do vizinho.
  server: { port: 5199, strictPort: true },
  preview: { port: 5200, strictPort: true },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
