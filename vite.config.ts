import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

// ferramentas/cli.ts fica fora de src/ de propósito: é utilitário de inspeção e
// não deve entrar no bundle (CLAUDE.md).
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // `prompt`, não `autoUpdate` (divergência consciente de DD-A11).
      //
      // Com autoUpdate o service worker assume e RECARREGA A PÁGINA sozinho ao
      // detectar versão nova. Num app que fica aberto durante o treino, isso
      // acontece no meio de uma série: o dado sobrevive (está no IndexedDB),
      // mas o timer de descanso zera e o card aberto se perde.
      //
      // Com prompt, o SW novo fica em `waiting` e quem decide a hora é o
      // usuário, pelo BannerAtualizacao. O motivo de DD-A11 continua atendido
      // — ninguém fica preso numa versão antiga —, só que sem interromper.
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icones/apple-touch-icon-180.png"],
      manifest: {
        name: "FichaTreino",
        short_name: "FichaTreino",
        description: "Controle de treino de hipertrofia com ciclos de rotação",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0f1115",
        theme_color: "#0f1115",
        icons: [
          { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Entradas SEPARADAS para any e maskable. Declarar "any maskable" no
          // mesmo ícone faz o Android recortar uma arte sem safe zone, e o
          // resultado é o logo cortado (DD-A15).
          {
            src: "/icones/icone-maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icones/icone-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/__/],
        cleanupOutdatedCaches: true,
        // O service worker garante que o app CARREGUE offline. Os dados são
        // problema do IndexedDB (DD-A14). O RTDB fala por WebSocket, que não
        // passa por fetch handler — não existe cacheá-lo aqui, e tentar
        // colocá-lo em runtimeCaching só produz falsa sensação de offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lh3\.googleusercontent\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "avatares-google",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      // Sem SW em desenvolvimento: um service worker no dev server confunde o
      // HMR e mascara qual versão está sendo servida.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Portas próprias e fixas. O escopo de um service worker é a origem inteira,
  // e `localhost:5173` é o default de todo projeto Vite — um app com PWA
  // rodando ali deixa um SW registrado que passa a servir o shell dele para
  // qualquer outro app na mesma porta. Some o app, sobra o cache do vizinho.
  server: { port: 5199, strictPort: true },
  preview: { port: 5200, strictPort: true },
});
