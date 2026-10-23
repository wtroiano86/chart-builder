import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
    testDir: "./tests/browser",
    testMatch: "**/*.spec.ts",
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: "list",
    outputDir: "tmp/browser-results",
    use: { baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure" },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: "npx vite --force --config vite.preview.config.ts",
        url: "http://127.0.0.1:4174/charts",
        reuseExistingServer: false,
    },
});
