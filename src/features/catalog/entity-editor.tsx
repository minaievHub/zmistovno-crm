"use client";
import { useState } from "react";
import Link from "next/link";
import { createTelegramGroup } from "@/features/telegram/actions";
import { copyInvite } from "@/features/telegram/group-setup";
import type { TelegramChat } from "@/features/telegram/types";
import { useForm, useWatch } from "react-hook-form";
import { Plus, Pencil } from "lucide-react";
import { saveEntity } from "@/app/actions";
import { useMutation } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { campaignStatuses, type CrmData } from "@/types/crm";
type Kind = "directions" | "courses" | "campaigns" | "groups";
const labels = {
  directions: "напрямок",
  courses: "курс",
  campaigns: "набір",
  groups: "групу",
};
export function EntityEditor({
  kind,
  data,
  record,
  parentId,
}: {
  kind: Kind;
  data: CrmData;
  record?: { id: string } & Record<string, unknown>;
  parentId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={record ? "outline" : "default"}
        size={record ? "sm" : "default"}
        onClick={() => setOpen(true)}
      >
        {record ? <Pencil size={15} /> : <Plus size={18} />}
        {record ? "Редагувати" : "Створити " + labels[kind]}
      </Button>
      {open && (
        <DialogContent className="wide-dialog">
          <DialogTitle>
            {record ? "Редагувати" : "Створити"} {labels[kind]}
          </DialogTitle>
          <DialogDescription>
            Заповніть інформацію. Її можна буде змінити пізніше.
          </DialogDescription>
          <EditorForm
            kind={kind}
            data={data}
            record={record}
            parentId={parentId}
            close={() => setOpen(false)}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
function EditorForm({
  kind,
  data,
  record,
  parentId,
  close,
}: {
  kind: Kind;
  data: CrmData;
  record?: { id: string } & Record<string, unknown>;
  parentId?: string;
  close: () => void;
}) {
  const { register, handleSubmit, control, setValue } = useForm({
    defaultValues: {
      name: "",
      description: "",
      emoji: "✦",
      active: true,
      direction_id: parentId || data.directions[0]?.id || "",
      course_id: parentId || data.courses[0]?.id || "",
      min_age: 6,
      max_age: 14,
      start_date: "",
      end_date: "",
      status: "Чернетка",
      slug: "",
      internal_note: "",
      teacher: "",
      day: "Понеділок",
      time: "18:00",
      ...record,
    },
  });
  const { pending, run } = useMutation();
  const [telegramMode, setTelegramMode] = useState("none");
  const [telegramTitle, setTelegramTitle] = useState("");
  const [telegramDescription, setTelegramDescription] = useState("");
  const [existingTelegram, setExistingTelegram] = useState("");
  const [zoom, setZoom] = useState("");
  const [savedGroup, setSavedGroup] = useState<string | null>(null);
  const [telegramResult, setTelegramResult] = useState<TelegramChat | null>(
    null,
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const direction = useWatch({ control, name: "direction_id" });
  const selectedCourse = useWatch({ control, name: "course_id" });
  const submit = handleSubmit(async (values) => {
    let payload: Record<string, unknown> = { name: values.name };
    if (kind === "directions")
      payload = {
        ...payload,
        description: values.description,
        emoji: values.emoji,
        active: values.active,
      };
    if (kind === "courses")
      payload = {
        ...payload,
        direction_id: values.direction_id,
        description: values.description,
        min_age: values.min_age,
        max_age: values.max_age,
        active: values.active,
      };
    if (kind === "campaigns")
      payload = {
        ...payload,
        course_id: values.course_id,
        description: values.description,
        min_age: values.min_age,
        max_age: values.max_age,
        start_date: values.start_date,
        end_date: values.end_date,
        status: values.status,
        slug: values.slug || "enrollment-" + crypto.randomUUID().slice(0, 8),
        internal_note: values.internal_note,
      };
    if (kind === "groups")
      payload = {
        ...payload,
        course_id: values.course_id,
        min_age: values.min_age,
        max_age: values.max_age,
        teacher: values.teacher,
        day: values.day,
        time: values.time,
        active: values.active,
      };
    if (kind === "groups" && !record && (telegramMode !== "none" || zoom)) {
      await run(async () => {
        let groupId = savedGroup;
        if (!groupId) {
          const result = await saveEntity("groups", null, payload);
          if (!result.ok || !result.id) return result;
          groupId = result.id;
          setSavedGroup(groupId);
        }
        if (zoom) {
          const link = await saveEntity("links", null, {
            label: "Заняття онлайн",
            url: zoom,
            type: zoom.includes("meet.google") ? "meet" : "zoom",
            entity_type: "groups",
            entity_id: groupId,
          });
          if (!link.ok) return link;
          setZoom("");
        }
        if (telegramMode === "none") {
          close();
          return { ok: true };
        }
        const result = await createTelegramGroup({
          requestId,
          title: telegramTitle || "Змістовно | " + values.name,
          description:
            telegramDescription ||
            `${data.courses.find((c) => c.id === values.course_id)?.name || ""}\nГрупа ${values.min_age}–${values.max_age} років\n${values.day} ${values.time}\nЗмістовно`,
          mode: telegramMode as "create" | "existing",
          existingId:
            telegramMode === "existing" ? existingTelegram : undefined,
          groupId,
          courseId: values.course_id,
          addBot: true,
          invite: true,
        });
        if (result.ok && "chat" in result)
          setTelegramResult(result.chat || null);
        return result;
      }, "Групу створено");
      return;
    }
    if (await run(() => saveEntity(kind, record?.id || null, payload))) close();
  });
  if (telegramResult)
    return (
      <div className="entity-form">
        <h2>Групу створено 🎉</h2>
        <p>{telegramResult.title}</p>
        <Button variant="outline" asChild>
          <a
            href={telegramResult.invite_link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Відкрити Telegram
          </a>
        </Button>
        <Button onClick={() => copyInvite(telegramResult.invite_link)}>
          Скопіювати invite link
        </Button>
        <Button asChild variant="outline">
          <Link href={"/groups/" + savedGroup}>До навчальної групи</Link>
        </Button>
        <Button variant="ghost" onClick={close}>
          Готово
        </Button>
      </div>
    );
  return (
    <form onSubmit={submit} className="entity-form">
      <label>
        Назва *
        <input
          {...register("name")}
          required
          maxLength={160}
          placeholder={
            kind === "campaigns"
              ? "English Speaking Club — Вересень 2026"
              : "Назва " + labels[kind]
          }
        />
      </label>
      {kind !== "directions" && (
        <>
          {kind === "courses" ? (
            <label>
              Напрямок *
              <select {...register("direction_id")} required>
                <option value="">Оберіть напрямок</option>
                {data.directions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.emoji} {d.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Напрямок
                <select
                  value={
                    data.courses.find((c) => c.id === selectedCourse)
                      ?.direction_id || direction
                  }
                  onChange={(e) => {
                    setValue("direction_id", e.target.value);
                    setValue(
                      "course_id",
                      data.courses.find(
                        (c) => c.direction_id === e.target.value,
                      )?.id || "",
                    );
                  }}
                >
                  <option value="">Оберіть напрямок</option>
                  {data.directions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Курс *
                <select {...register("course_id")} required>
                  <option value="">Оберіть курс</option>
                  {data.courses
                    .filter(
                      (c) =>
                        c.direction_id ===
                        (data.courses.find((c) => c.id === selectedCourse)
                          ?.direction_id || direction),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          <div className="form-grid">
            <label>
              Мінімальний вік
              <input
                type="number"
                min={1}
                max={18}
                {...register("min_age")}
                required
              />
            </label>
            <label>
              Максимальний вік
              <input
                type="number"
                min={1}
                max={18}
                {...register("max_age")}
                required
              />
            </label>
          </div>
        </>
      )}
      {kind !== "groups" && (
        <label>
          Опис
          <textarea {...register("description")} rows={3} maxLength={2000} />
        </label>
      )}
      {kind === "directions" && (
        <label>
          Emoji або символ
          <input {...register("emoji")} maxLength={12} />
        </label>
      )}
      {kind === "campaigns" ? (
        <>
          <div className="form-grid">
            <label>
              Початок набору
              <input type="date" {...register("start_date")} />
            </label>
            <label>
              Завершення набору
              <input type="date" {...register("end_date")} />
            </label>
          </div>
          <label>
            Статус
            <select {...register("status")}>
              {campaignStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Slug публічної форми
            <input
              {...register("slug")}
              placeholder="english-speaking-club-september-2026"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
            <small className="muted">
              Латиниця та дефіси. Якщо залишити порожнім — створимо автоматично.
            </small>
          </label>
          <label>
            Внутрішня примітка
            <textarea {...register("internal_note")} rows={2} />
          </label>
        </>
      ) : (
        <label className="checkbox-label">
          <input type="checkbox" {...register("active")} />
          Активний запис
        </label>
      )}
      {kind === "groups" && (
        <>
          <label>
            Викладач
            <input {...register("teacher")} placeholder="Ім’я викладача" />
          </label>
          <div className="form-grid">
            <label>
              День
              <select {...register("day")}>
                {[
                  "Понеділок",
                  "Вівторок",
                  "Середа",
                  "Четвер",
                  "П’ятниця",
                  "Субота",
                  "Неділя",
                ].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Час (Київ)
              <input type="time" {...register("time")} required />
            </label>
          </div>
        </>
      )}
      {kind === "groups" && !record && (
        <>
          <label>
            Zoom / Google Meet
            <input
              type="url"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label>
            Тип Telegram
            <select
              aria-label="Тип Telegram"
              value={telegramMode}
              onChange={(e) => setTelegramMode(e.target.value)}
            >
              <option value="none">Без Telegram</option>
              <option value="create">Створити нову групу</option>
              <option value="existing">Використати існуючу</option>
            </select>
          </label>
          {telegramMode !== "none" && (
            <>
              <label>
                Назва Telegram-групи
                <input
                  value={telegramTitle}
                  onChange={(e) => setTelegramTitle(e.target.value)}
                  placeholder="Автоматично: Змістовно | назва навчальної групи"
                  maxLength={128}
                />
              </label>
              <label>
                Опис Telegram-групи
                <textarea
                  value={telegramDescription}
                  onChange={(e) => setTelegramDescription(e.target.value)}
                  placeholder="Автоматично: курс, вік, день і час"
                  maxLength={255}
                />
              </label>
              {telegramMode === "existing" && (
                <label>
                  @username або chat ID
                  <input
                    value={existingTelegram}
                    onChange={(e) => setExistingTelegram(e.target.value)}
                    required
                    placeholder="@school_group"
                  />
                </label>
              )}
              <label className="checkbox-label">
                <input type="checkbox" checked readOnly />
                Додати CRM-бота адміністратором
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked readOnly />
                Створити invite link
              </label>
              <small className="muted">
                Бот і invite link потрібні для керування з CRM. У деморежимі
                Telegram-дії імітуються.
              </small>
            </>
          )}
          {savedGroup && (
            <p className="notice">
              Навчальну групу вже збережено. Якщо Telegram не підтвердив
              створення, перевірте запис у розділі Telegram перед повтором.
            </p>
          )}
        </>
      )}
      <div className="dialog-actions">
        <Button type="button" variant="outline" onClick={close}>
          Скасувати
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Зберігаємо…" : "Зберегти"}
        </Button>
      </div>
    </form>
  );
}
