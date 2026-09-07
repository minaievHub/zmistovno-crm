import { test } from "node:test";
import assert from "node:assert/strict";
import { registrationSchema, campaignSchema } from "../src/lib/validation";
import { csvCell, toCsv } from "../src/services/export";
import type { FormField } from "../src/types/crm";
test("optional numeric fields allow blank input and hidden fields are stripped", () => {
  const fields = [
    { key: "age", enabled: true, required: false, label: "Вік" },
  ] as FormField[];
  const schema = registrationSchema(fields, 6, 14);
  assert.deepEqual(schema.parse({ age: "", phone: "injected" }), { age: "" });
  assert.equal(schema.safeParse({ age: 20 }).success, false);
});
test("CSV quotes line breaks and prevents spreadsheet formula injection", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.ok(
    toCsv([
      ["Прізвище", "Коментар"],
      ["Коваль", "a\nb"],
    ]).startsWith("\ufeff"),
  );
});
test("campaign validates dates and age ranges", () => {
  const c = {
    name: "Test",
    course_id: crypto.randomUUID(),
    description: "",
    min_age: 14,
    max_age: 6,
    start_date: "2026-10-01",
    end_date: "2026-09-01",
    status: "Активний",
    slug: "test",
    internal_note: "",
  };
  assert.equal(campaignSchema.safeParse(c).success, false);
});
