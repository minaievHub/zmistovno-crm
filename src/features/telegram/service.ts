import "server-only";
import { testMode } from "@/lib/test-database";
import {
  BotTelegramAdapter,
  DemoBotAdapter,
  type BotAdapter,
} from "./bot-adapter";
import { UserTelegramAdapter } from "./user-adapter";
import { tgRead, tgInsert, tgUpdate, tgRpc, logTelegram } from "./repository";
import { postSchema, scheduledUtc } from "./content";
import type {
  ChatInfo,
  GroupInput,
  PostInput,
  TelegramChat,
  TelegramPost,
  TelegramDelivery,
  TelegramMedia,
  TelegramButton,
  TelegramMessage,
} from "./types";
export class TelegramService {
  constructor(
    readonly bot: BotAdapter = testMode()
      ? new DemoBotAdapter()
      : new BotTelegramAdapter(process.env.TELEGRAM_BOT_TOKEN || ""),
    readonly user = new UserTelegramAdapter(),
  ) {}
  async connection() {
    const me = await this.bot.call<{ id: number; username: string }>("getMe");
    return { username: me.username, id: me.id, demo: testMode() };
  }
  async createGroup(input: GroupInput, actor: string) {
    const exists = (
      await tgRead<TelegramChat>("telegram_chats", {
        request_id: input.requestId,
      })
    )[0];
    if (exists) {
      if (exists.status !== "active")
        throw new Error(
          "Попередня операція не завершена. Перевірте збережений запис і синхронізуйте чат; автоматичне повторне створення вимкнено.",
        );
      return exists;
    }
    let discovered: TelegramChat | undefined;
    if (input.mode === "existing") {
      const info = await this.bot.call<ChatInfo>("getChat", {
        chat_id: input.existingId,
      });
      discovered = (
        await tgRead<TelegramChat>("telegram_chats", {
          chat_id: String(info.id),
        })
      )[0];
      if (discovered?.group_id && discovered.group_id !== input.groupId)
        throw new Error("Чат уже прив’язано до іншої навчальної групи");
    }
    const row =
      discovered ||
      (await tgInsert<TelegramChat>("telegram_chats", {
        request_id: input.requestId,
        title: input.title,
        description: input.description,
        group_id: input.groupId || null,
        course_id: input.courseId || null,
        campaign_id: input.campaignId || null,
        status: "provisioning",
      }));
    if (discovered)
      await tgUpdate("telegram_chats", row.id, {
        request_id: input.requestId,
        group_id: input.groupId || null,
        course_id: input.courseId || null,
        campaign_id: input.campaignId || null,
        status: "provisioning",
      });
    try {
      let chatId: string;
      if (input.mode === "existing") {
        const info = await this.bot.call<ChatInfo>("getChat", {
          chat_id: input.existingId,
        });
        if (!["group", "supergroup", "channel"].includes(info.type))
          throw new Error("Оберіть групу або канал");
        chatId = String(info.id);
        await tgUpdate("telegram_chats", row.id, {
          chat_id: chatId,
          title: info.title || input.title,
          kind: info.type === "channel" ? "channel" : "group",
          username: info.username || "",
        });
      } else {
        chatId = testMode()
          ? "-100" + String(Date.now())
          : await this.user.createGroup(input.title, input.description);
        await tgUpdate("telegram_chats", row.id, { chat_id: chatId });
        if (input.addBot) {
          const bot = await this.connection();
          if (!testMode())
            await this.user.addBotToGroup(chatId, "@" + bot.username);
        }
      }
      const me = await this.connection();
      const rights = await this.bot.call<{ status: string }>("getChatMember", {
        chat_id: chatId,
        user_id: me.id,
      });
      if (!["administrator", "creator"].includes(rights.status))
        throw new Error(
          "Надайте боту права адміністратора групи та синхронізуйте її",
        );
      if (input.invite) {
        const invite = await this.bot.call<{ invite_link: string }>(
          "createChatInviteLink",
          { chat_id: chatId, name: "Змістовно CRM" },
        );
        await tgUpdate("telegram_chats", row.id, {
          invite_link: invite.invite_link,
        });
      }
      await tgUpdate("telegram_chats", row.id, {
        status: "active",
        bot_status: rights.status,
        error: "",
      });
      await logTelegram(actor, "group.created", row.id, input.title);
      return (await tgRead<TelegramChat>("telegram_chats", { id: row.id }))[0];
    } catch (e) {
      await tgUpdate("telegram_chats", row.id, {
        status: "failed",
        error: safeError(e),
      });
      await logTelegram(actor, "group.failed", row.id, safeError(e));
      throw new Error(
        safeError(e) +
          " Запис збережено. Перевірте його у Telegram → Групи перед повторною дією.",
      );
    }
  }
  async syncGroup(id: string, actor: string) {
    const chat = await this.chat(id);
    const [info, count, me] = await Promise.all([
      this.bot.call<ChatInfo>("getChat", { chat_id: chat.chat_id }),
      this.bot.call<number>("getChatMemberCount", { chat_id: chat.chat_id }),
      this.connection(),
    ]);
    const rights = await this.bot.call<{ status: string }>("getChatMember", {
      chat_id: chat.chat_id,
      user_id: me.id,
    });
    await tgUpdate("telegram_chats", id, {
      title: info.title || chat.title,
      description: info.description || chat.description,
      username: info.username || "",
      member_count: count,
      bot_status: rights.status,
      status: "active",
      error: "",
    });
    await logTelegram(actor, "group.synced", id);
  }
  async updateGroup(
    id: string,
    title: string,
    description: string,
    actor: string,
  ) {
    const chat = await this.chat(id);
    await this.bot.call("setChatTitle", { chat_id: chat.chat_id, title });
    await tgUpdate("telegram_chats", id, { title });
    await this.bot.call("setChatDescription", {
      chat_id: chat.chat_id,
      description,
    });
    await tgUpdate("telegram_chats", id, { description });
    await logTelegram(actor, "group.updated", id, title);
  }
  async createInviteLink(id: string, requests: boolean, actor: string) {
    const chat = await this.chat(id);
    const link = await this.bot.call<{ invite_link: string }>(
      "createChatInviteLink",
      {
        chat_id: chat.chat_id,
        name: "Змістовно CRM",
        creates_join_request: requests,
      },
    );
    await tgUpdate("telegram_chats", id, { invite_link: link.invite_link });
    await logTelegram(
      actor,
      "invite.created",
      id,
      requests ? "З підтвердженням вступу" : "Звичайне запрошення",
    );
    return link.invite_link;
  }
  async scheduleMessage(input: PostInput, actor: string) {
    const data = postSchema.parse(input);
    for (const m of data.media) {
      if (
        !/^https:\/\//.test(m.url) &&
        !/^\/api\/telegram\/media\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|pdf)$/.test(
          m.url,
        )
      )
        throw new Error("Невірне посилання медіа");
    }
    const when =
      data.mode === "draft"
        ? null
        : data.mode === "now"
          ? new Date().toISOString()
          : scheduledUtc(data.localTime, data.timezone);
    return tgRpc<string>("telegram_save_post", {
      p_id: data.id || null,
      p_author: actor,
      p_body: data.body,
      p_media: data.media,
      p_buttons: data.buttons,
      p_chats: data.destinations,
      p_when: when,
      p_timezone: data.timezone,
      p_draft: data.mode === "draft",
    });
  }
  async publishDue(postId: string | null = null, actor: string | null = null) {
    // Expired leases are uncertain; never blindly resend a request Telegram may have accepted.
    const stale = (
      await tgRead<TelegramDelivery>("telegram_deliveries")
    ).filter(
      (d) =>
        d.status === "sending" &&
        d.started_at &&
        Date.now() - Date.parse(d.started_at) > 300000,
    );
    for (const d of stale) {
      await tgUpdate("telegram_deliveries", d.id, {
        status: "failed",
        error:
          "Немає підтвердження завершення. Перевірте чат перед повторною публікацією.",
      });
      await tgUpdate("telegram_posts", d.post_id, {
        status: "Failed",
        error: "Перевірте доставку перед повтором",
      });
    }
    let processed = 0;
    for (let i = 0; i < 3; i++) {
      const d = await tgRpc<TelegramDelivery | null>(
        "telegram_claim_delivery",
        { p_post: postId },
      );
      if (!d) break;
      const post = (
        await tgRead<TelegramPost>("telegram_posts", { id: d.post_id })
      )[0];
      try {
        const chat = await this.chat(d.chat_id);
        const media = (
            await tgRead<TelegramMedia>("telegram_post_media", {
              post_id: post.id,
            })
          ).sort((a, b) => a.position - b.position),
          buttons = (
            await tgRead<TelegramButton>("telegram_post_buttons", {
              post_id: post.id,
            })
          ).sort((a, b) => a.position - b.position);
        const sent = media.length
          ? await this.bot.sendMedia(chat.chat_id!, post.body, media, buttons)
          : await this.bot.sendMessage(chat.chat_id!, post.body, buttons);
        for (const [j, m] of sent.entries())
          await tgInsert("telegram_messages", {
            delivery_id: d.id,
            message_id: m.message_id,
            kind: media[j]?.kind || "text",
          });
        await tgUpdate("telegram_deliveries", d.id, {
          status: "sent",
          published_at: new Date().toISOString(),
        });
        await logTelegram(actor, "post.sent", post.id, chat.title);
      } catch (e) {
        await tgUpdate("telegram_deliveries", d.id, {
          status: "failed",
          error: safeError(e),
        });
        await logTelegram(actor, "post.failed", post.id, safeError(e));
      }
      await this.finalize(post.id);
      processed++;
      if (!testMode())
        await new Promise((resolve) => setTimeout(resolve, 1100));
    }
    for (const post of (await tgRead<TelegramPost>("telegram_posts")).filter(
      (p) => ["Scheduled", "Publishing"].includes(p.status),
    ))
      await this.finalize(post.id);
    return processed;
  }
  async finalize(postId: string) {
    const deliveries = await tgRead<TelegramDelivery>("telegram_deliveries", {
      post_id: postId,
    });
    if (deliveries.some((d) => ["pending", "sending"].includes(d.status)))
      return;
    const failed = deliveries.some((d) => d.status === "failed");
    await tgUpdate("telegram_posts", postId, {
      status: failed ? "Failed" : "Published",
      published_at: failed ? null : new Date().toISOString(),
      error: failed
        ? "Не всі отримувачі отримали публікацію. Дивіться історію доставки."
        : "",
    });
  }
  async messageAction(
    id: string,
    operation: "delete" | "pin" | "unpin",
    actor: string,
  ) {
    const m = (await tgRead<TelegramMessage>("telegram_messages", { id }))[0];
    if (!m || m.deleted)
      throw new Error("Повідомлення вже видалено або не знайдено");
    const d = (
      await tgRead<TelegramDelivery>("telegram_deliveries", {
        id: m.delivery_id,
      })
    )[0];
    const chat = await this.chat(d.chat_id);
    await this.bot.call(
      operation === "delete"
        ? "deleteMessage"
        : operation === "pin"
          ? "pinChatMessage"
          : "unpinChatMessage",
      {
        chat_id: chat.chat_id,
        message_id: m.message_id,
        disable_notification: true,
      },
    );
    await tgUpdate(
      "telegram_messages",
      id,
      operation === "delete"
        ? { deleted: true }
        : { pinned: operation === "pin" },
    );
    await logTelegram(actor, "message." + operation, d.post_id, chat.title);
  }
  async editMessage(postId: string, body: string, actor: string) {
    const post = (
      await tgRead<TelegramPost>("telegram_posts", { id: postId })
    )[0];
    if (!post || !["Published", "Failed"].includes(post.status))
      throw new Error("Оберіть опублікований пост");
    const media = await tgRead<TelegramMedia>("telegram_post_media", {
      post_id: postId,
    });
    const buttons = await tgRead<TelegramButton>("telegram_post_buttons", {
      post_id: postId,
    });
    const data = postSchema.parse({
      body,
      media,
      buttons,
      destinations: [],
      mode: "draft",
      localTime: "",
      timezone: post.timezone,
    });
    for (const d of await tgRead<TelegramDelivery>("telegram_deliveries", {
      post_id: postId,
    })) {
      const chat = await this.chat(d.chat_id);
      const messages = (
        await tgRead<TelegramMessage>("telegram_messages", {
          delivery_id: d.id,
        })
      )
        .filter((m) => !m.deleted)
        .sort((a, b) => a.message_id - b.message_id);
      const m = messages[0];
      if (!m) continue;
      try {
        await this.bot.call(
          m.kind === "text" ? "editMessageText" : "editMessageCaption",
          {
            chat_id: chat.chat_id,
            message_id: m.message_id,
            [m.kind === "text" ? "text" : "caption"]: data.body,
            parse_mode: "HTML",
            ...(media.length <= 1
              ? {
                  reply_markup: {
                    inline_keyboard: buttons.map((b) => [
                      { text: b.label, url: b.url },
                    ]),
                  },
                }
              : {}),
          },
        );
        await logTelegram(actor, "message.edited", postId, chat.title);
      } catch (e) {
        await logTelegram(actor, "message.edit_failed", postId, chat.title);
        throw new Error("Редагування виконано частково. " + safeError(e));
      }
    }
    await tgUpdate("telegram_posts", postId, { body: data.body });
  }
  async chat(id: string) {
    const chat = (await tgRead<TelegramChat>("telegram_chats", { id }))[0];
    if (!chat?.chat_id) throw new Error("Чат ще не підключений");
    return chat;
  }
}
export function safeError(e: unknown) {
  if (
    e instanceof Error &&
    e.message &&
    !/bot\d+:|api_hash|StringSession|AUTH_KEY/i.test(e.message)
  )
    return e.message.slice(0, 400);
  return "Не вдалося виконати Telegram-операцію";
}
