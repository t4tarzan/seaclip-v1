import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Allow vitest to resolve .js imports to .ts source files (ESM convention)
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    extensionAlias: {
      ".js": [".ts", ".js"],
      ".mjs": [".mts", ".mjs"],
    },
    alias: {
      // Resolve workspace package @seaclip/db to its source
      "@seaclip/db": "/home/claude-code/workspace/seaclip-v1/packages/db/src/index.ts",
      "@seaclip/shared": "/home/claude-code/workspace/seaclip-v1/packages/shared/src/index.ts",
      "@seaclip/adapter-utils": "/home/claude-code/workspace/seaclip-v1/packages/adapter-utils/src/index.ts",
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
