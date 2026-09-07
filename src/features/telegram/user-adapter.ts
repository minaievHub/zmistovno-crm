import "server-only";
import { Api, TelegramClient, utils } from "teleproto";
import { StringSession } from "teleproto/sessions";
import { Logger, LogLevel } from "teleproto/extensions/Logger";
import { secretRead, secretWrite, secretDelete } from "./repository";
type Pending = {
  session: string;
  phone: string;
  hash: string;
  expires: number;
};
function credentials() {
  const apiId = Number(process.env.TELEGRAM_API_ID),
    apiHash = process.env.TELEGRAM_API_HASH || "";
  if (!apiId || !apiHash)
    throw new Error(
      "Налаштуйте TELEGRAM_API_ID та TELEGRAM_API_HASH на сервері",
    );
  return { apiId, apiHash };
}
function clientFor(session: string) {
  const { apiId, apiHash } = credentials();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 1,
    requestRetries: 0,
    floodSleepThreshold: 0,
    baseLogger: new Logger(LogLevel.NONE),
  });
}
export class UserTelegramAdapter {
  async beginLogin(phone: string, actor: string) {
    const client = clientFor("");
    try {
      await client.connect();
      const result = await client.sendCode(credentials(), phone);
      if (!("phoneCodeHash" in result))
        throw new Error(
          "Telegram вимагає додаткову перевірку. Використайте імпорт власної session на сервері.",
        );
      await secretWrite(
        "login:" + actor,
        JSON.stringify({
          session: client.session.save(),
          phone,
          hash: result.phoneCodeHash,
          expires: Date.now() + 300000,
        }),
      );
    } catch (e) {
      throw await safeUserError(e);
    } finally {
      await client.disconnect();
    }
  }
  async finishLogin(actor: string, code: string, password: string) {
    const raw = await secretRead("login:" + actor);
    if (!raw) throw new Error("Спочатку запросіть код");
    const p = JSON.parse(raw) as Pending;
    if (p.expires < Date.now()) {
      await secretDelete("login:" + actor);
      throw new Error("Код прострочено. Запросіть новий.");
    }
    const client = clientFor(p.session);
    try {
      await client.connect();
      try {
        await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: p.phone,
            phoneCodeHash: p.hash,
            phoneCode: code,
          }),
        );
      } catch (e) {
        if (errorCode(e).includes("SESSION_PASSWORD_NEEDED")) {
          if (!password) return { needsPassword: true };
          await client.signInWithPassword(credentials(), {
            password: async () => password,
            onError: async () => true,
          });
        } else throw e;
      }
      if (!(await client.checkAuthorization()))
        throw new Error("Не вдалося авторизуватися");
      await secretWrite("owner", String(client.session.save()));
      await secretDelete("login:" + actor);
      return { needsPassword: false };
    } catch (e) {
      throw await safeUserError(e);
    } finally {
      await client.disconnect();
    }
  }
  async withOwner<T>(fn: (client: TelegramClient) => Promise<T>): Promise<T> {
    const session = await secretRead("owner");
    if (!session)
      throw new Error("Авторизуйте Telegram Account у налаштуваннях");
    const client = clientFor(session);
    try {
      await client.connect();
      return await fn(client);
    } catch (e) {
      throw await safeUserError(e);
    } finally {
      await client.disconnect();
    }
  }
  async getIdentity() {
    return this.withOwner(async (c) => {
      const me = await c.getMe();
      return {
        name: [me.firstName, me.lastName].filter(Boolean).join(" "),
        username: me.username || "",
        phone: me.phone ? "••••" + me.phone.slice(-4) : "",
      };
    });
  }
  async disconnect() {
    try {
      await this.withOwner((c) => c.invoke(new Api.auth.LogOut()));
    } finally {
      await secretDelete("owner");
    }
  }
  async createGroup(title: string, description: string) {
    return this.withOwner(async (c) => {
      const result = await c.invoke(
        new Api.channels.CreateChannel({
          title,
          about: description,
          megagroup: true,
        }),
      );
      if (!("chats" in result) || !result.chats.length)
        throw new Error("Telegram не повернув створену групу");
      return utils.getPeerId(result.chats[0]);
    });
  }
  async addBotToGroup(chatId: string, botUsername: string) {
    return this.withOwner(async (c) => {
      await c.getDialogs({ limit: 100 });
      const channel = await c.getInputEntity(chatId);
      const bot = await c.getInputEntity(botUsername);
      await c.invoke(
        new Api.channels.InviteToChannel({ channel, users: [bot] }),
      );
      await c.invoke(
        new Api.channels.EditAdmin({
          channel,
          userId: bot,
          adminRights: new Api.ChatAdminRights({
            changeInfo: true,
            postMessages: true,
            editMessages: true,
            deleteMessages: true,
            inviteUsers: true,
            pinMessages: true,
            banUsers: true,
          }),
          rank: "CRM",
        }),
      );
    });
  }
}
function errorCode(e: unknown) {
  return typeof e === "object" && e && "errorMessage" in e
    ? String(e.errorMessage)
    : e instanceof Error
      ? e.message
      : "";
}
async function safeUserError(e: unknown) {
  const code = errorCode(e);
  if (
    /SESSION_REVOKED|AUTH_KEY_UNREGISTERED|AUTH_KEY_DUPLICATED|USER_DEACTIVATED/.test(
      code,
    )
  ) {
    await secretDelete("owner");
    return new Error(
      "Telegram session більше не дійсна. Авторизуйте акаунт повторно.",
    );
  }
  if (/FLOOD|FROZEN/.test(code))
    return new Error(
      "Telegram тимчасово обмежив операцію. Не повторюйте її автоматично.",
    );
  if (/PHONE_CODE/.test(code))
    return new Error("Неправильний або прострочений код");
  if (/PASSWORD/.test(code))
    return new Error("Перевірте пароль двоетапної авторизації");
  if (/Налаштуйте|Авторизуйте|Telegram вимагає/.test(code))
    return new Error(code);
  return new Error(
    "Операцію Telegram Account не завершено. Перевірте авторизацію та права акаунта.",
  );
}
