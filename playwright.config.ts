import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 25000,
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: {
      CRON_SECRET: "e2e-local-cron-only",
      CRM_TEST_MODE: "1",
      CRM_TEST_DATASET: "e2e",
      CRM_TEST_SECRET: "local-only-playwright-signing-key",
      CRM_TEST_EMAIL: "test@example.test",
      CRM_TEST_PASSWORD: "test-password-only",
    },
  },
});
