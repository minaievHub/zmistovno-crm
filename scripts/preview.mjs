import { chromium } from "@playwright/test";
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
if (!process.env.CRM_TEST_SECRET)
  throw new Error("Set CRM_TEST_SECRET to match the running local test server");
await mkdir("docs/previews", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
await page
  .context()
  .addCookies([
    {
      name: "crm-test-session",
      value: createHmac("sha256", process.env.CRM_TEST_SECRET)
        .update("local-test-admin")
        .digest("hex"),
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
await page.goto("http://127.0.0.1:3000/");
await page
  .getByRole("heading", { name: /Вітаємо/ })
  .waitFor({ timeout: 30000 });
await page.screenshot({ path: "docs/previews/dashboard.png", fullPage: true });
console.log("Dashboard screenshot captured.");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(
  "http://127.0.0.1:3000/register/english-speaking-club-september-2026",
);
await page.getByRole("heading", { name: "Познайомимося?" }).waitFor();
await page.screenshot({
  path: "docs/previews/registration-mobile.png",
  fullPage: true,
});
console.log("Mobile screenshot captured.");
await browser.close();
