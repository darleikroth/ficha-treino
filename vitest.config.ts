import { defineConfig } from "vitest/config";

// O core roda sob `node --test` sem mock nenhum (DD-A01) e fica fora daqui.
// Vitest cobre as camadas que precisam de APIs de browser — a partir da Fase 2,
// IndexedDB via fake-indexeddb.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/{db,stores,components,composables}/**/*.test.ts"],
    setupFiles: ["./src/testes/preparo.ts"],
    restoreMocks: true,
  },
});
