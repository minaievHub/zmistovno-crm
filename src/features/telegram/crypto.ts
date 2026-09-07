import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export function encryptSecret(value: string, key: string) {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32)
    throw new Error("TELEGRAM_ENCRYPTION_KEY має містити 32 байти у base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", bytes, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64"))
    .join(".");
}
export function decryptSecret(value: string, key: string) {
  try {
    const [iv, tag, body] = value
      .split(".")
      .map((v) => Buffer.from(v, "base64"));
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "base64"),
      iv,
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new Error(
      "Не вдалося розшифрувати Telegram session. Перевірте серверний ключ.",
    );
  }
}
