import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { testDatabase, testMode, TEST_ADMIN } from "@/lib/test-database";
import type { CrmData, TableName } from "@/types/crm";
const tables: TableName[] = [
  "profiles",
  "directions",
  "courses",
  "campaigns",
  "registration_form_fields",
  "leads",
  "groups",
  "students",
  "group_students",
  "links",
  "lead_notes",
  "lead_status_history",
  "audit_logs",
];
function identifier(value: string) {
  if (!/^[a-z_]+$/.test(value)) throw new Error("Invalid identifier");
  return '"' + value + '"';
}
export async function readTable<T extends TableName>(
  table: T,
): Promise<CrmData[T]> {
  if (!tables.includes(table)) throw new Error("Unknown table");
  if (testMode()) {
    const db = await testDatabase();
    // Match PostgREST's wire format (not PGlite's native Date objects).
    const result = await db.query<{ row: unknown }>(
      `select to_jsonb(t) as row from ${identifier(table)} t`,
    );
    return result.rows.map((item) => item.row) as CrmData[T];
  }
  const supabase = await supabaseServer();
  const all: unknown[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all as CrmData[T];
}
export async function readCrm(): Promise<CrmData> {
  const rows = await Promise.all(tables.map((t) => readTable(t)));
  return Object.fromEntries(
    tables.map((t, i) => [t, rows[i]]),
  ) as unknown as CrmData;
}
export async function insertRow(
  table: TableName,
  values: Record<string, unknown>,
) {
  if (testMode()) {
    const db = await testDatabase();
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        TEST_ADMIN,
      ]);
      const keys = Object.keys(values);
      const result = await tx.query(
        `insert into ${identifier(table)} (${keys.map(identifier).join(",")}) values (${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning *`,
        Object.values(values),
      );
      return result.rows[0];
    });
  }
  const { data, error } = await (
    await supabaseServer()
  )
    .from(table)
    .insert(values)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
export async function updateRows(
  table: TableName,
  ids: string[],
  values: Record<string, unknown>,
) {
  if (!ids.length || !Object.keys(values).length) return;
  if (testMode()) {
    const db = await testDatabase();
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        TEST_ADMIN,
      ]);
      const keys = Object.keys(values);
      await tx.query(
        `update ${identifier(table)} set ${keys.map((k, i) => identifier(k) + "=$" + (i + 1)).join(",")} where id=any($${keys.length + 1}::uuid[])`,
        [...Object.values(values), ids],
      );
    });
    return;
  }
  const { error } = await (
    await supabaseServer()
  )
    .from(table)
    .update(values)
    .in("id", ids);
  if (error) throw new Error(error.message);
}
export async function deleteRows(table: TableName, ids: string[]) {
  if (!ids.length) return;
  if (testMode()) {
    const db = await testDatabase();
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        TEST_ADMIN,
      ]);
      await tx.query(
        `delete from ${identifier(table)} where id=any($1::uuid[])`,
        [ids],
      );
    });
    return;
  }
  const { error } = await (
    await supabaseServer()
  )
    .from(table)
    .delete()
    .in("id", ids);
  if (error) throw new Error(error.message);
}
export async function rpc(
  name: "public_campaign" | "submit_registration" | "convert_student",
  args: Record<string, unknown>,
  staff = false,
) {
  if (testMode()) {
    const db = await testDatabase();
    return db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        staff ? TEST_ADMIN : "",
      ]);
      const values = Object.values(args);
      const result = await tx.query(
        `select ${identifier(name)}(${values.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
        values,
      );
      return (result.rows[0] as { result: unknown }).result;
    });
  }
  const { data, error } = await (await supabaseServer()).rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
