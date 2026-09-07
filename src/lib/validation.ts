import { z } from "zod";
import { campaignStatuses, leadStatuses, type FormField } from "@/types/crm";
const text = z.string().trim().max(2000);
const name = text.min(1, "Вкажіть назву").max(160);
const age = z.coerce.number().int().min(1).max(18);
const id = z.uuid();
const date = z
  .union([z.iso.date(), z.literal("")])
  .nullable()
  .transform((v) => v || null);
export const directionSchema = z.object({
  name,
  description: text,
  emoji: z.string().max(12),
  active: z.boolean(),
});
export const courseSchema = z
  .object({
    name,
    direction_id: id,
    description: text,
    min_age: age,
    max_age: age,
    active: z.boolean(),
  })
  .refine((v) => v.max_age >= v.min_age, "Перевірте віковий діапазон");
export const campaignSchema = z
  .object({
    name,
    course_id: id,
    description: text,
    min_age: age,
    max_age: age,
    start_date: date,
    end_date: date,
    status: z.enum(campaignStatuses),
    slug: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug: латинські літери, цифри та дефіси",
      )
      .max(160),
    internal_note: text,
  })
  .refine((v) => v.max_age >= v.min_age, "Перевірте віковий діапазон")
  .refine(
    (v) => !v.start_date || !v.end_date || v.end_date >= v.start_date,
    "Дата завершення має бути після початку",
  );
export const groupSchema = z
  .object({
    name,
    course_id: id,
    min_age: age,
    max_age: age,
    teacher: text,
    day: text,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Вкажіть час"),
    active: z.boolean(),
  })
  .refine((v) => v.max_age >= v.min_age, "Перевірте віковий діапазон");
export const linkSchema = z.object({
  label: name,
  url: z
    .url()
    .refine((v) => /^https?:\/\//i.test(v), "Лише https/http посилання"),
  type: z.enum(["telegram", "zoom", "meet", "website", "custom"]),
  entity_type: z.enum(["courses", "campaigns", "groups"]),
  entity_id: id,
});
export const formFieldSchema = z.object({
  label: name,
  placeholder: text,
  enabled: z.boolean(),
  required: z.boolean(),
  position: z.number().int().min(0).max(100),
});
export const leadPatchSchema = z
  .object({
    status: z.enum(leadStatuses).optional(),
    manager_id: id.nullable().optional(),
    group_id: id.nullable().optional(),
    archived_at: z.iso.datetime().nullable().optional(),
    is_test: z.boolean().optional(),
  })
  .strict();
export function registrationSchema(
  fields: FormField[],
  min: number,
  max: number,
) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields.filter((f) => f.enabled)) {
    let rule: z.ZodType = z.string().trim().max(2000);
    if (f.key === "age")
      rule = z.coerce
        .number()
        .int()
        .min(min, `Мінімальний вік: ${min}`)
        .max(max, `Максимальний вік: ${max}`);
    else if (f.key === "phone")
      rule = z
        .string()
        .trim()
        .regex(/^\+?[\d\s()-]{9,25}$/, "Перевірте номер телефону")
        .refine(
          (v) =>
            v.replace(/\D/g, "").length >= 9 &&
            v.replace(/\D/g, "").length <= 15,
          "Вкажіть 9–15 цифр",
        );
    else if (f.key === "telegram")
      rule = z
        .string()
        .trim()
        .regex(/^@?[A-Za-z0-9_]{5,32}$/, "Перевірте Telegram username");
    else if (f.required)
      rule = z
        .string()
        .trim()
        .min(1, `Заповніть: ${f.label}`)
        .max(f.key === "comment" ? 2000 : 160);
    if (!f.required) rule = z.union([z.literal(""), rule]).optional();
    shape[f.key] = rule;
  }
  return z.object(shape);
}
