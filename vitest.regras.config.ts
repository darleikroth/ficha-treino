import { defineConfig } from "vitest/config";

// Separado de vitest.config.ts porque depende dos emuladores rodando.
// `npm test` não pode exigir processo externo.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/firebase/__tests__/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
