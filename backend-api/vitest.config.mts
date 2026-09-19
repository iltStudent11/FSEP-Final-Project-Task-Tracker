import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 20000,
    testTimeout: 20000,
    // Model tests share one real MongoDB test database; running test files
    // concurrently races their afterEach cleanup against each other's assertions.
    fileParallelism: false,
  },
});
