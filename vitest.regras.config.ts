import { defineConfig } from "vitest/config";

// Suíte que depende dos emuladores: `npm run emuladores` antes.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.emulador.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
