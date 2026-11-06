import { defineConfig } from "@playwright/test";
export default defineConfig({
    testDir: "./e2e", fullyParallel: false, workers: 1, timeout: 90000,
    reporter: [["list"], ["json", { outputFile: "docs/audit/result/phase5-browser-results.json" }]],
    outputDir: "docs/audit/result/browser-artifacts",
    use: { baseURL: "http://127.0.0.1:4300", headless: true, screenshot: "only-on-failure", launchOptions: { executablePath: process.env.E2E_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" } },
});
