import sanitizeHtml from "sanitize-html";
import { DateTime } from "luxon";
import { z } from "zod";
export function cleanTelegramHtml(value: string) {
  return sanitizeHtml(
    value
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<\/li>/gi, "\n"),
    {
      allowedTags: ["b", "strong", "i", "em", "u", "s", "a", "code", "pre"],
      allowedAttributes: { a: ["href"] },
      allowedSchemes: ["https", "http"],
      transformTags: { strong: "b", em: "i" },
      disallowedTagsMode: "discard",
    },
  ).trim();
}
export function plainText(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
export function renderTemplate(
  body: string,
  variables: Record<string, string>,
) {
  return body.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) =>
    escapeHtml(variables[key] || ""),
  );
}
export function scheduledUtc(local: string, zone: string) {
  const dt = DateTime.fromISO(local, { zone });
  if (!dt.isValid || dt.toFormat("yyyy-MM-dd'T'HH:mm") !== local)
    throw new Error("Час не існує в обраному часовому поясі");
  if (dt.getPossibleOffsets().length > 1)
    throw new Error(
      "Цей час повторюється при переході на зимовий час. Оберіть інший час.",
    );
  if (dt.toMillis() <= Date.now()) throw new Error("Оберіть час у майбутньому");
  return dt.toUTC().toISO()!;
}
export const postSchema = z
  .object({
    id: z.uuid().optional(),
    body: z.string().max(20000).transform(cleanTelegramHtml),
    destinations: z.array(z.uuid()).max(100),
    media: z
      .array(
        z.object({
          url: z.string().max(2000),
          kind: z.enum(["photo", "video", "document"]),
          name: z.string().max(200),
        }),
      )
      .max(10),
    buttons: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(64),
          url: z
            .url()
            .refine(
              (v) => /^https?:\/\//.test(v),
              "Посилання має починатися з https:// або http://",
            ),
        }),
      )
      .max(5),
    mode: z.enum(["draft", "now", "schedule"]),
    localTime: z.string(),
    timezone: z.string().max(64),
  })
  .superRefine((v, ctx) => {
    if (!plainText(v.body).trim() && !v.media.length)
      ctx.addIssue({ code: "custom", message: "Додайте текст або медіа" });
    if (plainText(v.body).length > (v.media.length ? 1024 : 4096))
      ctx.addIssue({
        code: "custom",
        message: v.media.length
          ? "Підпис до медіа: до 1024 символів"
          : "Текст: до 4096 символів",
      });
    if (v.mode !== "draft" && !v.destinations.length)
      ctx.addIssue({ code: "custom", message: "Оберіть отримувачів" });
    if (v.media.length > 1 && v.media.some((m) => m.kind !== "photo"))
      ctx.addIssue({
        code: "custom",
        message:
          "Альбом підтримує до 10 фото. Відео та документ додавайте окремими публікаціями.",
      });
    if (v.media.length > 1 && v.buttons.length)
      ctx.addIssue({
        code: "custom",
        message:
          "Telegram не підтримує inline-кнопки в альбомах. Приберіть кнопки або залиште одне медіа.",
      });
    if (/\{\{[a-z_]+\}\}/.test(v.body))
      ctx.addIssue({ code: "custom", message: "Заповніть змінні шаблону" });
  });
