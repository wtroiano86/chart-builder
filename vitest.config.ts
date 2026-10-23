import { defineConfig } from "vitest/config";
export default defineConfig({
    resolve: {
        alias: {
            "@wtroiano/chart-builder-sdk": new URL(
                "./packages/sdk/src/index.ts",
                import.meta.url,
            ).pathname,
        },
    },
    test: {
        environment: "jsdom",
        include: ["tests/react/**/*.test.{ts,tsx}"],
        setupFiles: ["tests/react/setup.ts"],
        environmentOptions: {
            jsdom: {
                url: "http://localhost/charts?tab=reports&orders[page]=3",
            },
        },
    },
});
