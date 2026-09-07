import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { testMode } from "@/lib/test-database";
import { serviceClient } from "./repository";
const mime: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  pdf: "application/pdf",
};
export async function storeMedia(file: File) {
  const ext = Object.keys(mime).find((e) => mime[e] === file.type);
  if (!ext || file.size > 4 * 1024 * 1024 || file.size === 0)
    throw new Error("Оберіть JPG, PNG, WebP, MP4 або PDF до 4 МБ");
  const id = crypto.randomUUID() + "." + ext;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (testMode()) {
    await mkdir(path.resolve(".test-db", "media"), { recursive: true });
    await writeFile(path.resolve(".test-db", "media", id), bytes);
  } else {
    const { error } = await serviceClient()
      .storage.from("telegram-media")
      .upload(id, bytes, { contentType: file.type, upsert: false });
    if (error)
      throw new Error(
        "Не вдалося завантажити файл. Перевірте bucket telegram-media.",
      );
  }
  return {
    url: "/api/telegram/media/" + id,
    kind: file.type.startsWith("image/")
      ? "photo"
      : ext === "mp4"
        ? "video"
        : "document",
    name: file.name.slice(0, 200),
  };
}
export async function loadMedia(id: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|mp4|pdf)$/.test(id))
    throw new Error("Невідомий файл");
  if (testMode()) {
    return new Blob([await readFile(path.resolve(".test-db", "media", id))], {
      type: mime[id.split(".").pop()!],
    });
  }
  const { data, error } = await serviceClient()
    .storage.from("telegram-media")
    .download(id);
  if (error) throw new Error("Медіафайл недоступний");
  return data;
}
