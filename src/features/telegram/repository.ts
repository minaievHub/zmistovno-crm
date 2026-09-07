import "server-only";
import { createClient } from "@supabase/supabase-js";
import { testMode, testDatabase } from "@/lib/test-database";
import { encryptSecret, decryptSecret } from "./crypto";
import type { TelegramData } from "./types";
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Налаштуйте серверний SUPABASE_SERVICE_ROLE_KEY для Telegram-модуля",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const allowed = [
  "telegram_chats",
  "telegram_posts",
  "telegram_post_media",
  "telegram_post_buttons",
  "telegram_deliveries",
  "telegram_messages",
  "telegram_templates",
  "telegram_join_requests",
  "telegram_events",
  "telegram_credentials",
];
function tableName(table: string) {
  if (!allowed.includes(table)) throw new Error("Unknown Telegram table");
  return table;
}
export async function tgRead<T>(
  table: string,
  where: Record<string, unknown> = {},
): Promise<T[]> {
  tableName(table);
  if (testMode()) {
    const keys = Object.keys(where);
    const result = await (
      await testDatabase()
    ).query<{ row: T }>(
      `select to_jsonb(t) as row from ${table} t ${keys.length ? "where " + keys.map((k, i) => `${safeKey(k)}=$${i + 1}`).join(" and ") : ""}`,
      Object.values(where),
    );
    return result.rows.map((r) => r.row);
  }
  let query = serviceClient().from(table).select("*");
  for (const [k, v] of Object.entries(where)) query = query.eq(k, v);
  const all: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.order("id").range(offset, offset + 999);
    if (error)
      throw new Error(
        "Не вдалося прочитати Telegram-дані. Перевірте міграцію та серверне підключення.",
      );
    all.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return all;
}
function safeKey(key: string) {
  if (!/^[a-z_]+$/.test(key)) throw new Error("Invalid column");
  return key;
}
export async function tgInsert<T>(
  table: string,
  values: Record<string, unknown>,
): Promise<T> {
  tableName(table);
  if (testMode()) {
    const keys = Object.keys(values);
    const result = await (
      await testDatabase()
    ).query<{ row: T }>(
      `insert into ${table}(${keys.map(safeKey).join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning to_jsonb(${table}.*) as row`,
      Object.values(values),
    );
    return result.rows[0].row;
  }
  const { data, error } = await serviceClient()
    .from(table)
    .insert(values)
    .select()
    .single();
  if (error)
    throw new Error(
      error.code === "23505"
        ? "Такий Telegram-запис уже існує"
        : "Не вдалося зберегти Telegram-запис",
    );
  return data as T;
}
export async function tgUpdate(
  table: string,
  id: string,
  values: Record<string, unknown>,
) {
  tableName(table);
  if (testMode()) {
    const keys = Object.keys(values);
    await (
      await testDatabase()
    ).query(
      `update ${table} set ${keys.map((k, i) => safeKey(k) + "=$" + (i + 1)).join(",")} where id=$${keys.length + 1}`,
      [...Object.values(values), id],
    );
    return;
  }
  const { error } = await serviceClient()
    .from(table)
    .update(values)
    .eq("id", id);
  if (error) throw new Error("Не вдалося оновити Telegram-запис");
}
export async function tgRpc<T>(
  name:
    "telegram_save_post" | "telegram_claim_delivery" | "telegram_cancel_post",
  args: Record<string, unknown>,
): Promise<T> {
  if (testMode()) {
    const values = Object.values(args);
    const { rows } = await (
      await testDatabase()
    ).query<{ result: T }>(
      `select ${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
      values,
    );
    return rows[0].result;
  }
  const { data, error } = await serviceClient().rpc(name, args);
  if (error)
    throw new Error(
      "Не вдалося виконати операцію з чергою. Можливо, публікацію вже розпочато.",
    );
  return data as T;
}
export async function logTelegram(
  actor: string | null,
  action: string,
  entity: string | null,
  detail = "",
) {
  await tgInsert("telegram_events", {
    actor_id: actor,
    action,
    entity_id: entity,
    detail,
  });
}
export async function telegramData(): Promise<TelegramData> {
  const names = {
    chats: "telegram_chats",
    posts: "telegram_posts",
    media: "telegram_post_media",
    buttons: "telegram_post_buttons",
    deliveries: "telegram_deliveries",
    messages: "telegram_messages",
    templates: "telegram_templates",
    joins: "telegram_join_requests",
    events: "telegram_events",
  };
  const values = await Promise.all(Object.values(names).map((t) => tgRead(t)));
  return {
    ...Object.fromEntries(Object.keys(names).map((k, i) => [k, values[i]])),
    demo: testMode(),
  } as unknown as TelegramData;
}
export async function secretRead(id: string) {
  const rows = await tgRead<{ ciphertext: string }>("telegram_credentials", {
    id,
  });
  if (!rows.length) return null;
  return decryptSecret(
    rows[0].ciphertext,
    process.env.TELEGRAM_ENCRYPTION_KEY || "",
  );
}
export async function secretWrite(id: string, value: string) {
  const ciphertext = encryptSecret(
    value,
    process.env.TELEGRAM_ENCRYPTION_KEY || "",
  );
  const existing = await tgRead("telegram_credentials", { id });
  if (existing.length)
    await tgUpdate("telegram_credentials", id, {
      ciphertext,
      updated_at: new Date().toISOString(),
    });
  else await tgInsert("telegram_credentials", { id, ciphertext });
}
export async function secretDelete(id: string) {
  if (testMode()) {
    await (
      await testDatabase()
    ).query("delete from telegram_credentials where id=$1", [id]);
    return;
  }
  const { error } = await serviceClient()
    .from("telegram_credentials")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Не вдалося видалити session");
}
