// Explicitly enabled, local development/test adapter. Never used in production.
import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
export const testMode = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.CRM_TEST_MODE === "1" &&
  !!process.env.CRM_TEST_SECRET;
export const TEST_ADMIN = "00000000-0000-4000-8000-000000000001";
const root = globalThis as typeof globalThis & { crmTestDb?: Promise<PGlite> };
export async function testDatabase() {
  if (!testMode()) throw new Error("Тестова база недоступна");
  if (!root.crmTestDb)
    root.crmTestDb = (async () => {
      const dataset = process.env.CRM_TEST_DATASET === "e2e" ? "e2e" : "demo";
      const db = new PGlite(path.resolve(".test-db", dataset));
      const exists = await db.query(
        "select to_regclass('public.profiles') as present",
      );
      if (!(exists.rows[0] as { present: string | null }).present) {
        await db.exec(
          `create schema auth; create role anon nologin; create role authenticated nologin; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
        );
        await db.exec(
          await readFile(
            path.resolve("supabase/migrations/202609070001_crm.sql"),
            "utf8",
          ),
        );
        await db.exec(
          `insert into auth.users values ('${TEST_ADMIN}'); insert into profiles values ('${TEST_ADMIN}','Олена Коваль','admin');`,
        );
        await db.exec(
          await readFile(path.resolve("supabase/seed.sql"), "utf8"),
        );
      }
      const telegram = await db.query<{ present: string | null }>(
        "select to_regclass('public.telegram_chats') as present",
      );
      if (!telegram.rows[0].present)
        await db.exec(
          await readFile(
            path.resolve("supabase/migrations/202609070002_telegram.sql"),
            "utf8",
          ),
        );
      return db;
    })();
  return root.crmTestDb;
}
export function testToken() {
  return createHmac("sha256", process.env.CRM_TEST_SECRET || "")
    .update("local-test-admin")
    .digest("hex");
}
export function validTestToken(value: string) {
  const expected = testToken();
  return (
    value.length === expected.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
