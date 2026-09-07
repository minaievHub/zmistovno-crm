import "server-only";
import type {
  BotMessage,
  ChatInfo,
  TelegramButton,
  TelegramMedia,
} from "./types";
import { loadMedia } from "./media-service";
export interface BotAdapter {
  call<T>(
    method: string,
    params?: Record<string, unknown> | FormData,
  ): Promise<T>;
  sendMessage(
    chat: string,
    body: string,
    buttons: Pick<TelegramButton, "label" | "url">[],
  ): Promise<BotMessage[]>;
  sendMedia(
    chat: string,
    body: string,
    media: Pick<TelegramMedia, "url" | "kind" | "name">[],
    buttons: Pick<TelegramButton, "label" | "url">[],
  ): Promise<BotMessage[]>;
}
export class TelegramApiError extends Error {
  constructor(
    message: string,
    public uncertain = false,
  ) {
    super(message);
  }
}
export class BotTelegramAdapter implements BotAdapter {
  constructor(private token: string) {}
  async call<T>(
    method: string,
    params: Record<string, unknown> | FormData = {},
  ): Promise<T> {
    if (!this.token) throw new TelegramApiError("Telegram Bot не налаштований");
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.token}/${method}`,
        {
          method: "POST",
          headers:
            params instanceof FormData
              ? undefined
              : { "Content-Type": "application/json" },
          body: params instanceof FormData ? params : JSON.stringify(params),
          signal: AbortSignal.timeout(25000),
          cache: "no-store",
        },
      );
      const result = (await response.json()) as {
        ok: boolean;
        result: T;
        error_code?: number;
        description?: string;
        parameters?: { retry_after?: number };
      };
      if (
        !result.ok &&
        method.startsWith("editMessage") &&
        result.error_code === 400 &&
        result.description?.includes("message is not modified")
      )
        return true as T;
      if (!result.ok)
        throw new TelegramApiError(
          result.error_code === 429
            ? `Telegram обмежив частоту. Спробуйте через ${result.parameters?.retry_after || 60} с.`
            : result.error_code === 401
              ? "Токен бота недійсний"
              : result.error_code === 403
                ? "Бот не має доступу до чату"
                : `Telegram відхилив операцію (${result.error_code || response.status}). Перевірте права бота та параметри повідомлення.`,
        );
      return result.result;
    } catch (e) {
      if (e instanceof TelegramApiError) throw e;
      throw new TelegramApiError(
        "Немає підтвердження від Telegram. Перед повтором перевірте історію чату, щоб уникнути дубля.",
        true,
      );
    }
  }
  async sendMessage(
    chat: string,
    body: string,
    buttons: Pick<TelegramButton, "label" | "url">[],
  ) {
    return [
      await this.call<BotMessage>("sendMessage", {
        chat_id: chat,
        text: body,
        parse_mode: "HTML",
        reply_markup: markup(buttons),
      }),
    ];
  }
  async sendMedia(
    chat: string,
    body: string,
    media: Pick<TelegramMedia, "url" | "kind" | "name">[],
    buttons: Pick<TelegramButton, "label" | "url">[],
  ) {
    const form = new FormData();
    form.set("chat_id", chat);
    const items = [];
    for (const [i, m] of media.entries()) {
      let url = m.url;
      if (url.startsWith("/api/telegram/media/")) {
        const blob = await loadMedia(url.split("/").pop()!);
        form.set("file" + i, blob, m.name || "media");
        url = "attach://file" + i;
      }
      items.push({
        type: m.kind,
        media: url,
        caption: i === 0 ? body : undefined,
        parse_mode: "HTML",
      });
    }
    if (items.length > 1) {
      form.set("media", JSON.stringify(items));
      return this.call<BotMessage[]>("sendMediaGroup", form);
    }
    const m = media[0];
    form.set(m.kind, items[0].media);
    form.set("caption", body);
    form.set("parse_mode", "HTML");
    if (buttons.length)
      form.set("reply_markup", JSON.stringify(markup(buttons)));
    return [
      await this.call<BotMessage>(
        { photo: "sendPhoto", video: "sendVideo", document: "sendDocument" }[
          m.kind
        ],
        form,
      ),
    ];
  }
}
function markup(buttons: Pick<TelegramButton, "label" | "url">[]) {
  return buttons.length
    ? { inline_keyboard: buttons.map((b) => [{ text: b.label, url: b.url }]) }
    : undefined;
}
export class DemoBotAdapter implements BotAdapter {
  async call<T>(
    method: string,
    params: Record<string, unknown> | FormData = {},
  ): Promise<T> {
    const p = params as Record<string, unknown>;
    let result: unknown = true;
    if (method === "getMe")
      result = {
        id: 900001,
        username: "zmistovno_demo_bot",
        first_name: "Змістовно · Демо",
      };
    if (method === "getChat")
      result = {
        id: Number(String(p.chat_id).startsWith("-") ? p.chat_id : -100900001),
        title: "Демо Telegram-група",
        type: "supergroup",
        description: "Демонстраційний чат",
        username: "",
      } satisfies ChatInfo;
    if (method === "getChatMember")
      result = { status: "administrator", can_invite_users: true };
    if (method === "getChatMemberCount") result = 12;
    if (method === "createChatInviteLink")
      result = {
        invite_link: "https://t.me/+demo-" + crypto.randomUUID().slice(0, 8),
      };
    return result as T;
  }
  async sendMessage(chat: string) {
    return [
      {
        message_id: Math.floor(Math.random() * 1e8),
        chat: { id: Number(chat) },
      },
    ];
  }
  async sendMedia(
    chat: string,
    _body: string,
    media: Pick<TelegramMedia, "url" | "kind" | "name">[],
  ) {
    return Promise.all(media.map(() => this.sendMessage(chat))).then((rows) =>
      rows.flat(),
    );
  }
}
