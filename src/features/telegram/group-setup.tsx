"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMutation } from "@/components/common";
import { createTelegramGroup } from "./actions";
import type { TelegramChat, TelegramData } from "./types";
import type { CrmData } from "@/types/crm";
export function GroupSetup({
  data,
  crm,
  groupId,
  courseId,
  campaignId,
  close,
}: {
  data: TelegramData;
  crm: CrmData;
  groupId?: string;
  courseId?: string;
  campaignId?: string;
  close: () => void;
}) {
  const group = crm.groups.find((g) => g.id === groupId),
    campaign = crm.campaigns.find((c) => c.id === campaignId),
    course = crm.courses.find(
      (c) => c.id === (courseId || group?.course_id || campaign?.course_id),
    );
  const [title, setTitle] = useState(
      "Змістовно | " + (group?.name || course?.name || "Нова група"),
    ),
    [description, setDescription] = useState(
      `${course?.name || ""}\n${group ? `Група ${group.min_age}–${group.max_age} років\n${group.day} ${group.time}\n` : ""}Змістовно`,
    ),
    [mode, setMode] = useState<"create" | "existing">("create"),
    [existing, setExisting] = useState(""),
    [selectedGroup, setSelectedGroup] = useState(groupId || ""),
    [selectedCourse, setSelectedCourse] = useState(
      courseId || group?.course_id || campaign?.course_id || "",
    ),
    [result, setResult] = useState<TelegramChat | null>(null);
  const request = useRef<string | null>(null);
  const { pending, run } = useMutation();
  const zoom = crm.links.find(
    (l) =>
      l.entity_type === "groups" &&
      l.entity_id === selectedGroup &&
      ["zoom", "meet"].includes(l.type),
  );
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent>
        <DialogTitle>
          {result ? "Групу створено 🎉" : "Telegram infrastructure"}
        </DialogTitle>
        <DialogDescription>
          {data.demo
            ? "Деморежим: створюється локальний приклад без звернення до Telegram."
            : "Нову групу створює акаунт власника. Далі нею керує бот школи."}
        </DialogDescription>
        {result ? (
          <div className="entity-form">
            <span className="success-symbol">
              <Check size={35} />
            </span>
            <h3>{result.title}</h3>
            <p className="muted">
              Telegram прив’язано до CRM. Подальші дії — через Bot API.
            </p>
            <Button variant="outline" asChild>
              <a
                href={result.invite_link || "https://t.me/" + result.username}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} />
                Відкрити Telegram
              </a>
            </Button>
            <Button onClick={() => copyInvite(result.invite_link)}>
              <Copy size={16} />
              Скопіювати invite link
            </Button>
            {zoom && (
              <Button variant="outline" asChild>
                <a href={zoom.url} target="_blank" rel="noopener noreferrer">
                  Відкрити Zoom / Meet
                </a>
              </Button>
            )}
            <Button variant="ghost" onClick={close}>
              Готово
            </Button>
          </div>
        ) : (
          <form
            className="entity-form"
            onSubmit={(e) => {
              e.preventDefault();
              request.current ??= crypto.randomUUID();
              run(async () => {
                const response = await createTelegramGroup({
                  requestId: request.current!,
                  title,
                  description,
                  mode,
                  existingId: mode === "existing" ? existing : undefined,
                  groupId: selectedGroup || undefined,
                  courseId: selectedCourse || undefined,
                  campaignId,
                  addBot: true,
                  invite: true,
                });
                if (response.ok && "chat" in response && response.chat)
                  setResult(response.chat);
                return response;
              }, "Telegram-групу підготовлено");
            }}
          >
            <label>
              Тип Telegram
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "create" | "existing")
                }
              >
                <option value="create">Створити нову групу</option>
                <option value="existing">
                  Використати існуючу групу / канал
                </option>
              </select>
            </label>
            <label>
              Навчальна група
              <select
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  const g = crm.groups.find((g) => g.id === e.target.value);
                  if (g) {
                    setSelectedCourse(g.course_id);
                    setTitle("Змістовно | " + g.name);
                    setDescription(
                      `${crm.courses.find((c) => c.id === g.course_id)?.name || ""}\nГрупа ${g.min_age}–${g.max_age} років\n${g.day} ${g.time}\nЗмістовно`,
                    );
                  }
                }}
              >
                <option value="">Без окремої навчальної групи</option>
                {crm.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Курс
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                disabled={!!selectedGroup}
              >
                <option value="">Загальношкільний чат</option>
                {crm.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {mode === "existing" && (
              <>
                <label>
                  Чат, відомий боту
                  <select
                    aria-label="Відомі Telegram-чати"
                    value={existing}
                    onChange={(e) => setExisting(e.target.value)}
                  >
                    <option value="">
                      Оберіть або вкажіть @username нижче
                    </option>
                    {data.chats
                      .filter((c) => c.chat_id && !c.group_id)
                      .map((c) => (
                        <option key={c.id} value={c.chat_id!}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  @username каналу або chat ID
                  <input
                    value={existing}
                    onChange={(e) => setExisting(e.target.value)}
                    placeholder="@zmistovno"
                    required
                  />
                </label>
                <p className="muted">
                  Приватні групи з’являться автоматично після додавання бота й
                  налаштування webhook.{" "}
                  <Link className="text-link" href="/settings/telegram">
                    Налаштування →
                  </Link>
                </p>
              </>
            )}
            <label>
              Назва Telegram-групи
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={128}
                required
              />
            </label>
            <label>
              Опис
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={255}
                rows={4}
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked readOnly />
              Додати CRM-бота адміністратором
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked readOnly />
              Створити invite link
            </label>
            <small className="muted">
              Ці параметри обов’язкові для керування групою з CRM.
            </small>
            <Button disabled={pending}>
              <Send size={16} />
              {pending
                ? "Створюємо…"
                : mode === "create"
                  ? "Створити Telegram-групу"
                  : "Підключити Telegram"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function copyInvite(url: string) {
  if (!url) {
    toast.error("Спочатку створіть invite link");
    return;
  }
  navigator.clipboard
    .writeText(url)
    .then(() => toast.success("Посилання скопійовано"))
    .catch(() => toast.error("Не вдалося скопіювати"));
}
