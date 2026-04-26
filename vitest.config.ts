import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// Tests import `@hey-echodev/X` and need source-not-built resolution so we
// don't have to run `tsc -b` before every `vitest run`. Vite's esbuild
// transformer compiles each .ts file on demand.
const pkgs = ["core", "storage-fs", "extractors", "retriever", "llm"];

export default defineConfig({
  resolve: {
    alias: pkgs.map((name) => ({
      find: `@hey-echodev/${name}`,
      replacement: path.resolve(here, `packages/${name}/src/index.ts`),
    })),
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
