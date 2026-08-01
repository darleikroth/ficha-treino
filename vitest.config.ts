import { defineConfig } from "vitest/config";

// O core roda sob `node --test` sem mock nenhum (DD-A01) e fica fora daqui.
// Vitest cobre as camadas que precisam de APIs de browser — IndexedDB via
// fake-indexeddb.
//
// `*.emulador.test.ts` exige processo externo e sai desta suíte: `npm test`
// não pode depender dos emuladores estarem no ar. Ver vitest.regras.config.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/{db,stores,firebase,components,composables}/**/*.test.ts"],
    exclude: ["**/*.emulador.test.ts", "**/node_modules/**"],
    setupFiles: ["./src/testes/preparo.ts"],
    restoreMocks: true,
  },
});
