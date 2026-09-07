import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
const password = randomBytes(12).toString("base64url");
const cronSecret = randomBytes(32).toString("hex");
console.log(
  `\nЛокальна демонстрація CRM «Змістовно»\nhttp://127.0.0.1:3000\nПошта: demo@example.test\nПароль: ${password}\nДані: .test-db (лише для демонстрації)\n`,
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      CRM_TEST_MODE: "1",
      CRM_TEST_DATASET: "demo",
      CRM_TEST_SECRET: randomBytes(32).toString("hex"),
      CRM_TEST_EMAIL: "demo@example.test",
      CRM_TEST_PASSWORD: password,
      CRON_SECRET: cronSecret,
    },
  },
);
const worker = spawn(process.execPath, ["scripts/telegram-worker.mjs"], {
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    CRON_SECRET: cronSecret,
    APP_URL: "http://127.0.0.1:3000",
  },
});
child.on("exit", (code) => {
  worker.kill();
  process.exit(code ?? 0);
});
process.on("SIGINT", () => {
  worker.kill();
  child.kill("SIGINT");
});
