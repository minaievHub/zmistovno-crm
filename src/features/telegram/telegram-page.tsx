"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import {
  Send,
  Plus,
  Copy,
  ExternalLink,
  RefreshCw,
  Archive,
  Settings,
  FileText,
  UsersRound,
  Clock3,
  Check,
  Pin,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PageHeading,
  Badge,
  Empty,
  Confirm,
  useMutation,
} from "@/components/common";
import { formatDate } from "@/lib/utils";
import type { CrmData, Profile } from "@/types/crm";
import type {
  TelegramData,
  TelegramChat,
  TelegramPost,
  PostInput,
} from "./types";
import { PostEditor, TelegramPreview } from "./post-editor";
import { GroupSetup, copyInvite } from "./group-setup";
import { ConnectionPanel } from "./connection-panel";
import {
  telegramGroupAction,
  telegramPostAction,
  telegramMessageAction,
  telegramJoinAction,
  saveTelegramTemplate,
} from "./actions";
import { escapeHtml } from "./content";
const statusLabels: Record<string, string> = {
  Draft: "Чернетка",
  Scheduled: "Заплановано",
  Publishing: "Публікується",
  Published: "Опубліковано",
  Failed: "Помилка",
  Cancelled: "Скасовано",
};
export function TelegramPage({
  data,
  crm,
  profile,
  query,
  settings,
  origin,
}: {
  data: TelegramData;
  crm: CrmData;
  profile: Profile;
  query: Record<string, string | string[] | undefined>;
  settings: boolean;
  origin: string;
}) {
  const q = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const tab = settings ? "settings" : q("tab") || "groups";
  const [setup, setSetup] = useState(q("create") === "1"),
    [editor, setEditor] = useState<Partial<PostInput> | null>(
      q("compose") === "1"
        ? composeFromContext(data, crm, q("campaign"), q("group"), origin)
        : null,
    ),
    [view, setView] = useState<TelegramPost | null>(null),
    [editChat, setEditChat] = useState<TelegramChat | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      action: () => Promise<{ ok: boolean; error?: string }>;
    } | null>(null);
  const { pending, run } = useMutation();
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [router]);
  const active = data.chats.filter((c) => c.status === "active");
  const editingPost = (p: TelegramPost, copy = false): Partial<PostInput> => ({
    id: copy ? undefined : p.id,
    body: p.body,
    destinations: data.deliveries
      .filter((d) => d.post_id === p.id)
      .map((d) => d.chat_id),
    media: data.media
      .filter((m) => m.post_id === p.id)
      .sort((a, b) => a.position - b.position),
    buttons: data.buttons
      .filter((b) => b.post_id === p.id)
      .sort((a, b) => a.position - b.position),
    timezone: p.timezone,
    mode: p.status === "Scheduled" ? "schedule" : "now",
    localTime: p.scheduled_at
      ? DateTime.fromISO(p.scheduled_at)
          .setZone(p.timezone)
          .toFormat("yyyy-MM-dd'T'HH:mm")
      : "",
  });
  return (
    <>
      <PageHeading
        eyebrow="КОМУНІКАЦІЯ ШКОЛИ"
        title={settings ? "Налаштування Telegram" : "Telegram Control Center"}
        description="Групи, новини й важливі повідомлення — у вашому робочому просторі."
      >
        <Button variant="outline" asChild>
          <Link href="/settings/telegram">
            <Settings size={16} />
            Підключення
          </Link>
        </Button>
        <Button onClick={() => setEditor({})}>
          <Plus size={17} />
          Нова публікація
        </Button>
      </PageHeading>
      {data.demo && (
        <div className="tg-demo-notice">
          Деморежим · Усі Telegram-дії імітуються локально. Реальні повідомлення
          не надсилаються.
        </div>
      )}
      <nav className="tg-tabs">
        {[
          ["groups", "Групи", UsersRound],
          ["posts", "Публікації", FileText],
          ["templates", "Шаблони", Copy],
          ["joins", "Заявки на вступ", Check],
          ["events", "Журнал", Clock3],
        ].map(([value, label, Icon]) => {
          const I = Icon as typeof Send;
          return (
            <Link
              key={String(value)}
              href={"/telegram?tab=" + value}
              className={tab === value ? "active" : ""}
            >
              <I size={16} />
              {String(label)}
            </Link>
          );
        })}
      </nav>
      {tab === "settings" ? (
        <ConnectionPanel demo={data.demo} admin={profile.role === "admin"} />
      ) : tab === "groups" ? (
        <>
          <div className="section-heading">
            <h2>
              Групи та канали <Badge>{active.length} активних</Badge>
            </h2>
            <Button onClick={() => setSetup(true)}>
              <Plus size={16} />
              Створити / підключити
            </Button>
          </div>
          {data.chats.length === 0 ? (
            <section className="card">
              <Empty
                title="Telegram ще не підключено"
                description="Створіть нову Telegram-групу або підключіть існуючу групу чи канал."
              />
            </section>
          ) : (
            <div className="card table-card">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Група / канал</th>
                      <th>Курс / CRM</th>
                      <th>Учасники</th>
                      <th>Бот</th>
                      <th>Статус</th>
                      <th>Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.chats.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.title}</strong>
                          <small className="cell-subtitle">
                            {c.username
                              ? "@" + c.username
                              : c.kind === "channel"
                                ? "Канал"
                                : "Приватна група"}
                          </small>
                          {c.error && (
                            <small className="form-error">{c.error}</small>
                          )}
                        </td>
                        <td>
                          {crm.courses.find((co) => co.id === c.course_id)
                            ?.name || "—"}
                          <small className="cell-subtitle">
                            {crm.groups.find((g) => g.id === c.group_id)
                              ?.name || "Без навчальної групи"}
                          </small>
                        </td>
                        <td>{c.member_count}</td>
                        <td>
                          <Badge
                            tone={
                              c.bot_status === "administrator"
                                ? "green"
                                : "neutral"
                            }
                          >
                            {c.bot_status === "administrator"
                              ? "Адміністратор"
                              : c.bot_status === "unknown"
                                ? "Не перевірено"
                                : c.bot_status}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            tone={
                              c.status === "active"
                                ? "green"
                                : c.status === "failed"
                                  ? "red"
                                  : "neutral"
                            }
                          >
                            {
                              {
                                active: "Активна",
                                archived: "Архів",
                                failed: "Помилка",
                                provisioning: "Створюється",
                              }[c.status]
                            }
                          </Badge>
                        </td>
                        <td>
                          <div className="actions">
                            {(c.invite_link || c.username) && (
                              <Button size="sm" variant="outline" asChild>
                                <a
                                  href={
                                    c.invite_link ||
                                    "https://t.me/" + c.username
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink size={14} />
                                  Відкрити
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyInvite(c.invite_link)}
                            >
                              <Copy size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={c.status !== "active"}
                              onClick={() =>
                                setEditor({ destinations: [c.id] })
                              }
                            >
                              <Send size={14} />
                              Написати
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditChat(c)}
                            >
                              Редагувати
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending || !c.chat_id}
                              onClick={() =>
                                run(() => telegramGroupAction(c.id, "sync"))
                              }
                            >
                              <RefreshCw size={14} />
                              Синхронізувати
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setConfirm({
                                  title:
                                    c.status === "archived"
                                      ? "Відновити чат?"
                                      : "Архівувати чат?",
                                  description:
                                    "Чат у Telegram не видаляється. Архівні чати не отримують запланованих публікацій.",
                                  action: () =>
                                    telegramGroupAction(
                                      c.id,
                                      c.status === "archived"
                                        ? "restore"
                                        : "archive",
                                    ),
                                })
                              }
                            >
                              <Archive size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : tab === "posts" ? (
        <>
          <div className="tg-stats">
            {["Draft", "Scheduled", "Published", "Failed"].map((s) => (
              <div className="card" key={s}>
                <span className="muted">{statusLabels[s]}</span>
                <strong>
                  {data.posts.filter((p) => p.status === s).length}
                </strong>
              </div>
            ))}
          </div>
          <div className="tg-post-list">
            {[...data.posts]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((p) => (
                <article className="card" key={p.id}>
                  <div className="card-heading">
                    <Badge
                      tone={
                        p.status === "Published"
                          ? "green"
                          : p.status === "Failed"
                            ? "red"
                            : p.status === "Scheduled"
                              ? "purple"
                              : "neutral"
                      }
                    >
                      {statusLabels[p.status]}
                    </Badge>
                    <small className="muted">{formatDate(p.created_at)}</small>
                  </div>
                  <div
                    className="tg-post-excerpt"
                    dangerouslySetInnerHTML={{ __html: p.body }}
                  />
                  <p className="muted mt">
                    {data.deliveries
                      .filter((d) => d.post_id === p.id)
                      .map(
                        (d) =>
                          data.chats.find((c) => c.id === d.chat_id)?.title,
                      )
                      .join(" · ") || "Отримувачі ще не обрані"}
                  </p>
                  {p.scheduled_at && (
                    <small className="muted">
                      {DateTime.fromISO(p.scheduled_at)
                        .setZone(p.timezone)
                        .toFormat("dd.MM.yyyy HH:mm")}{" "}
                      · {p.timezone}
                    </small>
                  )}
                  {p.error && <p className="form-error">{p.error}</p>}
                  <div className="actions mt">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setView(p)}
                    >
                      Переглянути
                    </Button>
                    {["Draft", "Scheduled"].includes(p.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditor(editingPost(p))}
                      >
                        Редагувати
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditor(editingPost(p, true))}
                    >
                      <Copy size={14} />
                      {["Published", "Failed"].includes(p.status)
                        ? "Опублікувати повторно"
                        : "Створити копію"}
                    </Button>
                    {["Draft", "Scheduled"].includes(p.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          setConfirm({
                            title: "Скасувати публікацію?",
                            description:
                              "Заплановане повідомлення не буде надіслано.",
                            action: () => telegramPostAction(p.id, "cancel"),
                          })
                        }
                      >
                        Скасувати
                      </Button>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {!data.posts.length && (
            <section className="card">
              <Empty
                title="Тут починаються новини школи"
                description="Створіть першу публікацію та перегляньте її перед надсиланням."
              />
            </section>
          )}
        </>
      ) : tab === "templates" ? (
        <Templates data={data} />
      ) : tab === "joins" ? (
        <section className="card">
          <h2>Заявки на вступ</h2>
          {data.joins.length === 0 ? (
            <Empty
              title="Нових запитів немає"
              description="Створіть invite link із підтвердженням вступу. Запити надходять через webhook."
            />
          ) : (
            data.joins.map((j) => (
              <div className="list-row" key={j.id}>
                <div>
                  <strong>{j.name}</strong>
                  <small className="cell-subtitle">
                    {data.chats.find((c) => c.id === j.chat_id)?.title}
                  </small>
                </div>
                <Badge>
                  {j.status === "pending"
                    ? "Очікує"
                    : j.status === "approved"
                      ? "Прийнято"
                      : "Відхилено"}
                </Badge>
                {j.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => telegramJoinAction(j.id, true))}
                    >
                      Прийняти
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => telegramJoinAction(j.id, false))}
                    >
                      Відхилити
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="card">
          <h2>Журнал Telegram</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Коли</th>
                  <th>Хто</th>
                  <th>Дія</th>
                  <th>Деталі</th>
                </tr>
              </thead>
              <tbody>
                {[...data.events]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .slice(0, 200)
                  .map((e) => (
                    <tr key={e.id}>
                      <td>{formatDate(e.created_at)}</td>
                      <td>
                        {crm.profiles.find((p) => p.id === e.actor_id)
                          ?.full_name || "Система"}
                      </td>
                      <td>{e.action}</td>
                      <td>{e.detail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {setup && (
        <GroupSetup
          data={data}
          crm={crm}
          groupId={q("group") || undefined}
          courseId={q("course") || undefined}
          campaignId={q("campaign") || undefined}
          close={() => setSetup(false)}
        />
      )}
      {editor && (
        <PostEditor
          data={data}
          crm={crm}
          initial={editor}
          close={() => setEditor(null)}
        />
      )}
      {view && (
        <PostHistory
          post={data.posts.find((p) => p.id === view.id) || view}
          data={data}
          close={() => setView(null)}
        />
      )}
      {editChat && (
        <Dialog open onOpenChange={() => setEditChat(null)}>
          <DialogContent>
            <DialogTitle>Редагувати Telegram-групу</DialogTitle>
            <DialogDescription>
              Назва й опис будуть змінені в Telegram.
            </DialogDescription>
            <form
              className="entity-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await run(() =>
                    telegramGroupAction(editChat.id, "sync", {
                      title: String(f.get("title")),
                      description: String(f.get("description")),
                    }),
                  )
                )
                  setEditChat(null);
              }}
            >
              <label>
                Назва
                <input
                  name="title"
                  defaultValue={editChat.title}
                  required
                  maxLength={128}
                />
              </label>
              <label>
                Опис
                <textarea
                  name="description"
                  defaultValue={editChat.description}
                  maxLength={255}
                />
              </label>
              <Button disabled={pending}>Зберегти в Telegram</Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => telegramGroupAction(editChat.id, "invite"))
                }
              >
                Новий invite link
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() => telegramGroupAction(editChat.id, "join-invite"))
                }
              >
                Invite link із підтвердженням вступу
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      <Confirm
        open={!!confirm}
        onOpenChange={() => setConfirm(null)}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        pending={pending}
        onConfirm={async () => {
          if (confirm && (await run(confirm.action))) setConfirm(null);
        }}
      />
    </>
  );
}
function composeFromContext(
  data: TelegramData,
  crm: CrmData,
  campaignId: string,
  groupId: string,
  origin: string,
): Partial<PostInput> {
  const c = crm.campaigns.find((c) => c.id === campaignId),
    g = crm.groups.find((g) => g.id === groupId);
  if (c) {
    const url = origin + "/register/" + c.slug;
    return {
      body: `<b>Відкрито набір: ${escapeHtml(crm.courses.find((co) => co.id === c.course_id)?.name || c.name)}</b> 💛\n\nДіти ${c.min_age}–${c.max_age} років.\n${escapeHtml(c.description)}`,
      buttons: [{ label: "Зареєструватися", url }],
      destinations: data.chats
        .filter((t) => t.course_id === c.course_id && t.status === "active")
        .map((t) => t.id),
    };
  }
  if (g)
    return {
      body: `Нагадуємо: ${escapeHtml(g.name)}, заняття ${escapeHtml(g.day)} о ${escapeHtml(g.time)} 💛`,
      destinations: data.chats
        .filter((t) => t.group_id === g.id && t.status === "active")
        .map((t) => t.id),
    };
  return {};
}
function Templates({ data }: { data: TelegramData }) {
  const { pending, run } = useMutation();
  return (
    <div className="tg-post-list">
      {[...data.templates, { id: "", name: "", body: "" }].map((t) => (
        <form
          key={t.id}
          className="card entity-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              saveTelegramTemplate(
                t.id || null,
                String(f.get("name")),
                String(f.get("body")),
              ),
            );
          }}
        >
          <h3>{t.id ? t.name : "Новий шаблон"}</h3>
          <label>
            Назва
            <input name="name" defaultValue={t.name} required maxLength={100} />
          </label>
          <label>
            Текст шаблону
            <textarea
              name="body"
              defaultValue={t.body.replaceAll("\\n", "\n")}
              required
              rows={4}
            />
          </label>
          <small className="muted">
            Змінні:{" "}
            {
              "{{child_name}}, {{course_name}}, {{group_name}}, {{lesson_time}}, {{zoom_url}}, {{telegram_url}}, {{registration_url}}"
            }
          </small>
          <Button variant="outline" disabled={pending}>
            Зберегти шаблон
          </Button>
        </form>
      ))}
    </div>
  );
}
function PostHistory({
  post,
  data,
  close,
}: {
  post: TelegramPost;
  data: TelegramData;
  close: () => void;
}) {
  const { pending, run } = useMutation();
  const [body, setBody] = useState(post.body),
    [edit, setEdit] = useState(false),
    [deleteId, setDeleteId] = useState("");
  const media = data.media.filter((m) => m.post_id === post.id),
    buttons = data.buttons.filter((b) => b.post_id === post.id);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="wide-dialog">
        <DialogTitle>Історія публікації</DialogTitle>
        <DialogDescription>
          {statusLabels[post.status]} · {formatDate(post.created_at)}
        </DialogDescription>
        <TelegramPreview body={post.body} media={media} buttons={buttons} />
        {["Published", "Failed"].includes(post.status) && (
          <>
            <Button
              variant="outline"
              className="mt"
              onClick={() => setEdit(!edit)}
            >
              Редагувати текст у Telegram
            </Button>
            {edit && (
              <form
                className="entity-form mt"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await run(() => telegramPostAction(post.id, "edit", body))
                  )
                    setEdit(false);
                }}
              >
                <textarea
                  aria-label="Новий текст повідомлення"
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <small className="muted">
                  Форматування HTML: b, i, a. Медіа й отримувачі залишаються без
                  змін.
                </small>
                <Button disabled={pending}>Підтвердити редагування</Button>
              </form>
            )}
          </>
        )}
        <div className="mt">
          {data.deliveries
            .filter((d) => d.post_id === post.id)
            .map((d) => (
              <div className="tg-delivery" key={d.id}>
                <strong>
                  {data.chats.find((c) => c.id === d.chat_id)?.title}
                </strong>
                <Badge
                  tone={
                    d.status === "sent"
                      ? "green"
                      : d.status === "failed"
                        ? "red"
                        : "neutral"
                  }
                >
                  {d.status}
                </Badge>
                {d.published_at && <small>{formatDate(d.published_at)}</small>}
                {d.error && <p className="form-error">{d.error}</p>}
                {data.messages
                  .filter((m) => m.delivery_id === d.id)
                  .map((m) => (
                    <div key={m.id} className="actions mt">
                      <small>Telegram ID: {m.message_id}</small>
                      <Badge>
                        {m.deleted
                          ? "Видалено"
                          : m.pinned
                            ? "Закріплено"
                            : "Надіслано"}
                      </Badge>
                      {!m.deleted && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                telegramMessageAction(
                                  m.id,
                                  m.pinned ? "unpin" : "pin",
                                ),
                              )
                            }
                          >
                            <Pin size={13} />
                            {m.pinned ? "Відкріпити" : "Закріпити"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteId(m.id)}
                          >
                            <Trash2 size={13} />
                            Видалити з Telegram
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            ))}
        </div>
        <Confirm
          open={!!deleteId}
          onOpenChange={() => setDeleteId("")}
          title="Видалити повідомлення з Telegram?"
          description="Повідомлення зникне з чату. Історія операції залишиться у CRM."
          pending={pending}
          onConfirm={async () => {
            if (await run(() => telegramMessageAction(deleteId, "delete")))
              setDeleteId("");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
