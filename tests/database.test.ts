import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const admin = "00000000-0000-4000-8000-000000000001",
  outsider = "00000000-0000-4000-8000-000000000002",
  campaign = "30000000-0000-4000-8000-000000000001",
  group = "40000000-0000-4000-8000-000000000001";
before(async () => {
  await db.exec(
    `create schema auth; create role anon nologin; create role authenticated nologin; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    await readFile("supabase/migrations/202609070001_crm.sql", "utf8"),
  );
  await db.exec(
    `insert into auth.users values('${admin}'),('${outsider}');insert into profiles values('${admin}','Admin','admin');`,
  );
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
});
after(() => db.close());
test("anonymous can see only the public campaign projection and cannot read leads", async () => {
  await db.exec("set role anon");
  try {
    const result = await db.query<{ c: Record<string, unknown> }>(
      "select public_campaign('english-speaking-club-september-2026') as c",
    );
    assert.ok(result.rows[0].c.fields);
    assert.equal(result.rows[0].c.internal_note, undefined);
    await assert.rejects(db.query("select * from leads"), /permission denied/);
    await assert.rejects(
      db.query("select * from campaigns"),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
test("public registration validates and double submission is idempotent", async () => {
  const token = crypto.randomUUID();
  await db.exec("set role anon");
  try {
    await assert.rejects(
      db.query("select submit_registration($1,$2,$3)", [
        "english-speaking-club-september-2026",
        {
          first_name: "Test",
          last_name: "Child",
          age: 3,
          phone: "+380 990000000",
        },
        token,
      ]),
      /Вік/,
    );
    const values = {
      first_name: "Тест",
      last_name: "Учень",
      age: 8,
      phone: "+380 (99) 000-00-00",
      telegram: "@test_parent",
      status: "Записаний",
      manager_id: admin,
    };
    await db.query("select submit_registration($1,$2,$3)", [
      "english-speaking-club-september-2026",
      values,
      token,
    ]);
    await db.query("select submit_registration($1,$2,$3)", [
      "english-speaking-club-september-2026",
      values,
      token,
    ]);
  } finally {
    await db.exec("reset role");
  }
  const rows = await db.query<{
    phone: string;
    status: string;
    manager_id: string | null;
  }>("select * from leads where submission_id=$1", [token]);
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].phone, "380990000000");
  assert.equal(rows.rows[0].status, "Нова");
  assert.equal(rows.rows[0].manager_id, null);
});
test("authenticated account without staff profile cannot read or mutate CRM", async () => {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${outsider}',false)`,
  );
  try {
    assert.equal((await db.query("select * from leads")).rows.length, 0);
    await assert.rejects(
      db.query("insert into directions(name) values('Forbidden')"),
      /row-level security/,
    );
    await assert.rejects(
      db.query("select convert_student($1)", [crypto.randomUUID()]),
      /Доступ/,
    );
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub','',false)",
    );
  }
});
test("manager workflow keeps lead, notes/history, creates one student and group membership", async () => {
  await db.exec(
    `select set_config('request.jwt.claim.sub','${admin}',false); set role authenticated`,
  );
  try {
    const l = await db.query<{ id: string }>(
      "insert into leads(campaign_id,first_name,last_name,age,phone) values($1,'Іван','Тест',8,'380991234567') returning id",
      [campaign],
    );
    const id = l.rows[0].id;
    await db.query("update leads set status='Зв’язались' where id=$1", [id]);
    await db.query(
      "insert into lead_notes(lead_id,body) values($1,'Домовилися про пробне заняття')",
      [id],
    );
    await db.query("update leads set group_id=$1 where id=$2", [group, id]);
    await assert.rejects(
      db.query("select convert_student($1)", [id]),
      /Записаний/,
    );
    await db.query("update leads set status='Записаний' where id=$1", [id]);
    await db.query("select convert_student($1)", [id]);
    await db.query("select convert_student($1)", [id]);
    assert.equal(
      (await db.query("select * from students where lead_id=$1", [id])).rows
        .length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from group_students where group_id=$1", [
          group,
        ])
      ).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from leads where id=$1", [id])).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from lead_status_history where lead_id=$1", [
          id,
        ])
      ).rows.length,
      3,
    );
    assert.equal(
      (await db.query("select * from lead_notes where lead_id=$1", [id])).rows
        .length,
      1,
    );
    await db.query("update leads set group_id=null where id=$1", [id]);
    assert.equal(
      (
        await db.query("select * from group_students where group_id=$1", [
          group,
        ])
      ).rows.length,
      0,
    );
  } finally {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub','',false)",
    );
  }
});
test("inactive campaign blocks registration and custom required fields are enforced", async () => {
  await db.query("update campaigns set status='Призупинений' where id=$1", [
    campaign,
  ]);
  assert.equal(
    (
      await db.query<{ c: null }>(
        "select public_campaign('english-speaking-club-september-2026') as c",
      )
    ).rows[0].c,
    null,
  );
  await assert.rejects(
    db.query("select submit_registration($1,$2,$3)", [
      "english-speaking-club-september-2026",
      {},
      crypto.randomUUID(),
    ]),
    /закрито/,
  );
  await db.query("update campaigns set status='Активний' where id=$1", [
    campaign,
  ]);
  await db.query(
    "update registration_form_fields set required=true where campaign_id=$1 and key='parent_name'",
    [campaign],
  );
  await assert.rejects(
    db.query("select submit_registration($1,$2,$3)", [
      "english-speaking-club-september-2026",
      { first_name: "Test", last_name: "Child", age: 8, phone: "380990000000" },
      crypto.randomUUID(),
    ]),
    /Заповніть/,
  );
});
test("incompatible groups and orphan links are rejected; campaign deletion restricts existing leads", async () => {
  await assert.rejects(
    db.query("insert into leads(campaign_id,age,group_id) values($1,14,$2)", [
      campaign,
      group,
    ]),
    /Група/,
  );
  await assert.rejects(
    db.query(
      "insert into links(label,url,type,entity_type,entity_id) values('Meet','https://meet.google.com/example','meet','groups',$1)",
      [crypto.randomUUID()],
    ),
    /не існує/,
  );
  await assert.rejects(
    db.query("delete from campaigns where id=$1", [campaign]),
    /foreign key/,
  );
});
