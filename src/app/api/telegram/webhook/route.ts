import { timingSafeEqual } from "node:crypto";
import { tgRead, tgInsert, tgUpdate } from "@/features/telegram/repository";
import type { TelegramChat, TelegramJoin } from "@/features/telegram/types";
export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET,
    value = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (
    !expected ||
    value.length !== expected.length ||
    !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  )
    return new Response("Unauthorized", { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 200000)
    return new Response("Too large", { status: 413 });
  try {
    const update = await request.json();
    const member=update.my_chat_member;
    if(member?.chat?.id&&['group','supergroup','channel'].includes(member.chat.type)){
      const known=(await tgRead<TelegramChat>('telegram_chats',{chat_id:String(member.chat.id)}))[0];
      const botStatus=String(member.new_chat_member?.status||'unknown');
      const values={title:String(member.chat.title||'Telegram чат').slice(0,128),username:String(member.chat.username||''),bot_status:botStatus,...(['left','kicked'].includes(botStatus)?{status:'archived'}:{})};
      if(known)await tgUpdate('telegram_chats',known.id,values);
      else await tgInsert('telegram_chats',{chat_id:String(member.chat.id),kind:member.chat.type==='channel'?'channel':'group',...values});
    }
    const j = update.chat_join_request;
    if (j?.chat?.id && j?.from?.id) {
      const chat = (
        await tgRead<TelegramChat>("telegram_chats", {
          chat_id: String(j.chat.id),
        })
      )[0];
      if (chat) {
        const old = (
          await tgRead<TelegramJoin>("telegram_join_requests", {
            chat_id: chat.id,
            user_id: String(j.from.id),
          })
        )[0];
        const values = {
          name: String(j.from.first_name || "Учасник").slice(0, 100),
          status: "pending",
          created_at: new Date(Number(j.date) * 1000).toISOString(),
        };
        if (old) {
          if (Date.parse(old.created_at) < Number(j.date) * 1000)
            await tgUpdate("telegram_join_requests", old.id, values);
        } else
          await tgInsert("telegram_join_requests", {
            chat_id: chat.id,
            user_id: String(j.from.id),
            ...values,
          });
      }
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
