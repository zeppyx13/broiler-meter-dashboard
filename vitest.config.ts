import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tes logika murni (aturan Guard, format) — tidak butuh browser.
export default defineConfig({
    resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
