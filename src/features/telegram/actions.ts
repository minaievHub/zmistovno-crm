"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/services/auth";
import { testMode } from "@/lib/test-database";
import { TelegramService, safeError } from "./service";
import {
  tgRead,
  tgUpdate,
  tgInsert,
  logTelegram,
  secretRead,
  tgRpc,
} from "./repository";
import { UserTelegramAdapter } from "./user-adapter";
import { cleanTelegramHtml } from "./content";
import type { GroupInput, PostInput, TelegramJoin } from "./types";
async function admin() {
  const actor = await requireStaff();
  if (actor.role !== "admin")
    throw new Error("Підключення Telegram доступне лише адміністратору");
  return actor;
}
function failure(e: unknown) {
  return {
    ok: false,
    error:
      e instanceof z.ZodError
        ? e.issues.map((i) => i.message).join(". ")
        : safeError(e),
  };
}
export async function telegramConnection() {
  await admin();
  try {
    const bot = await new TelegramService().connection();
    let account = null;
    if (testMode())
      account = {
        name: "Демо-власник",
        username: "demo_owner",
        phone: "••••0000",
      };
    else if (await secretRead("owner"))
      account = await new UserTelegramAdapter().getIdentity();
    return { ok: true, bot, account };
  } catch (e) {
    return failure(e);
  }
}
export async function beginTelegramLogin(phone: string) {
  const actor = await admin();
  try {
    z.string()
      .regex(/^\+\d{9,15}$/)
      .parse(phone);
    if (testMode())
      return { ok: false, error: "У деморежимі реальна авторизація вимкнена" };
    await new UserTelegramAdapter().beginLogin(phone, actor.id);
    await logTelegram(actor.id, "account.login_requested", null);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function configureTelegramWebhook() {
  const actor = await admin();
  try {
    const origin = process.env.APP_URL || "";
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
    if (
      !testMode() &&
      (!origin.startsWith("https://") ||
        !/^[A-Za-z0-9_-]{16,256}$/.test(secret))
    )
      throw new Error(
        "Налаштуйте HTTPS APP_URL та TELEGRAM_WEBHOOK_SECRET (16–256 літер, цифр, _ або -) на сервері",
      );
    await new TelegramService().bot.call("setWebhook", {
      url: origin.replace(/\/$/, "") + "/api/telegram/webhook",
      secret_token: secret,
      allowed_updates: ["chat_join_request", "my_chat_member"],
      drop_pending_updates: false,
    });
    await logTelegram(actor.id, "webhook.configured", null);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function finishTelegramLogin(code: string, password: string) {
  const actor = await admin();
  try {
    z.string()
      .regex(/^\d{4,8}$/)
      .parse(code);
    z.string().max(200).parse(password);
    const result = await new UserTelegramAdapter().finishLogin(
      actor.id,
      code,
      password,
    );
    if (!result.needsPassword)
      await logTelegram(actor.id, "account.connected", null);
    return { ok: true, ...result };
  } catch (e) {
    return failure(e);
  }
}
export async function disconnectTelegramAccount() {
  const actor = await admin();
  try {
    if (!testMode()) await new UserTelegramAdapter().disconnect();
    await logTelegram(actor.id, "account.disconnected", null);
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function createTelegramGroup(input: GroupInput) {
  const actor = await requireStaff();
  try {
    const data = z
      .object({
        requestId: z.uuid(),
        title: z.string().trim().min(1).max(128),
        description: z.string().max(255),
        mode: z.enum(["create", "existing"]),
        existingId: z
          .string()
          .regex(/^(@[a-zA-Z0-9_]{5,32}|-\d{5,20})$/)
          .optional(),
        groupId: z.uuid().optional(),
        courseId: z.uuid().optional(),
        campaignId: z.uuid().optional(),
        addBot: z.boolean(),
        invite: z.boolean(),
      })
      .parse(input);
    if (data.mode === "existing" && !data.existingId)
      throw new Error("Оберіть існуючу групу");
    if (data.mode === "create" && (!data.addBot || !data.invite))
      throw new Error(
        "Для керування з CRM потрібні бот-адміністратор і invite link",
      );
    const chat = await new TelegramService().createGroup(data, actor.id);
    revalidatePath("/", "layout");
    return { ok: true, chat };
  } catch (e) {
    return failure(e);
  }
}
export async function telegramGroupAction(
  id: string,
  operation: "sync" | "archive" | "restore" | "invite" | "join-invite",
  values?: { title: string; description: string },
) {
  const actor = await requireStaff();
  try {
    z.uuid().parse(id);
    const service = new TelegramService();
    if (values) {
      z.string().trim().min(1).max(128).parse(values.title);
      z.string().max(255).parse(values.description);
      await service.updateGroup(id, values.title, values.description, actor.id);
    } else if (operation === "sync") await service.syncGroup(id, actor.id);
    else if (operation === "archive" || operation === "restore") {
      await tgUpdate("telegram_chats", id, {
        status: operation === "archive" ? "archived" : "active",
      });
      await logTelegram(actor.id, "group." + operation, id);
    } else if (operation === "invite" || operation === "join-invite")
      await service.createInviteLink(id, operation === "join-invite", actor.id);
    else throw new Error("Невідома операція");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function saveTelegramPost(input: PostInput) {
  const actor = await requireStaff();
  try {
    const service = new TelegramService();
    const id = await service.scheduleMessage(input, actor.id);
    if (input.mode === "now") await service.publishDue(id, actor.id);
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (e) {
    return failure(e);
  }
}
export async function telegramPostAction(
  id: string,
  operation: "cancel" | "edit",
  body = "",
) {
  const actor = await requireStaff();
  try {
    z.uuid().parse(id);
    if (operation === "edit")
      await new TelegramService().editMessage(id, body, actor.id);
    else {
      z.literal("cancel").parse(operation);
      await tgRpc("telegram_cancel_post", { p_id: id, p_actor: actor.id });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function telegramMessageAction(
  id: string,
  operation: "delete" | "pin" | "unpin",
) {
  const actor = await requireStaff();
  try {
    z.uuid().parse(id);
    z.enum(["delete", "pin", "unpin"]).parse(operation);
    await new TelegramService().messageAction(id, operation, actor.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function saveTelegramTemplate(
  id: string | null,
  name: string,
  body: string,
) {
  const actor = await requireStaff();
  try {
    z.string().trim().min(1).max(100).parse(name);
    z.string().min(1).max(10000).parse(body);
    if (id) {
      z.uuid().parse(id);
      await tgUpdate("telegram_templates", id, {
        name,
        body: cleanTelegramHtml(body),
      });
    } else
      await tgInsert("telegram_templates", {
        name,
        body: cleanTelegramHtml(body),
      });
    await logTelegram(actor.id, "template.saved", id, name);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
export async function telegramJoinAction(id: string, approve: boolean) {
  const actor = await requireStaff();
  try {
    z.uuid().parse(id);
    const join = (
      await tgRead<TelegramJoin>("telegram_join_requests", { id })
    )[0];
    if (!join || join.status !== "pending")
      throw new Error("Запит уже опрацьовано");
    const service = new TelegramService();
    const chat = await service.chat(join.chat_id);
    await service.bot.call(
      approve ? "approveChatJoinRequest" : "declineChatJoinRequest",
      { chat_id: chat.chat_id, user_id: join.user_id },
    );
    await tgUpdate("telegram_join_requests", id, {
      status: approve ? "approved" : "declined",
    });
    await logTelegram(
      actor.id,
      "join." + (approve ? "approved" : "declined"),
      id,
      chat.title,
    );
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return failure(e);
  }
}
