import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      // RTL's automatic per-test cleanup (unmounting components, so a
      // second test's render doesn't see nodes left over from the first)
      // only registers itself when it detects a global `afterEach` — which
      // requires Vitest's globals mode, not just importing the test APIs.
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  }),
);
