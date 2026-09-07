import { setTimeout } from "node:timers/promises";
if (!process.env.CRON_SECRET) throw new Error("Set CRON_SECRET in .env.local");
const origin = process.env.APP_URL || "http://127.0.0.1:3000";
for (;;) {
  try {
    const result = await fetch(origin + "/api/telegram/cron", {
      headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
      signal: AbortSignal.timeout(115000),
    });
    console.log(
      new Date().toISOString(),
      result.ok
        ? "Telegram queue checked"
        : "Telegram queue check failed: " + result.status,
    );
  } catch {
    console.log("Telegram queue unavailable");
  }
  await setTimeout(15000);
}
