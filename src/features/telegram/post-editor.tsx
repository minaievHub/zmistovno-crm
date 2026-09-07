"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import {
  Bold,
  Italic,
  Link2,
  List,
  Smile,
  ImagePlus,
  Trash2,
  Sparkles,
  ArrowLeft,
  Send,
  Save,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMutation } from "@/components/common";
import {
  cleanTelegramHtml,
  escapeHtml,
  postSchema,
  renderTemplate,
} from "./content";
import { saveTelegramPost } from "./actions";
import type { TelegramData, PostInput } from "./types";
import type { CrmData } from "@/types/crm";
export function PostEditor({
  data,
  crm,
  initial,
  close,
}: {
  data: TelegramData;
  crm: CrmData;
  initial: Partial<PostInput>;
  close: () => void;
}) {
  const [body, setBody] = useState(initial.body || ""),
    [destinations, setDestinations] = useState<string[]>(
      initial.destinations || [],
    ),
    [media, setMedia] = useState<PostInput["media"]>(initial.media || []),
    [buttons, setButtons] = useState<PostInput["buttons"]>(
      initial.buttons || [],
    ),
    [mode, setMode] = useState<"now" | "schedule">(
      initial.mode === "schedule" ? "schedule" : "now",
    ),
    [localTime, setLocalTime] = useState(initial.localTime || ""),
    [timezone, setTimezone] = useState(initial.timezone || "Europe/Kyiv"),
    [preview, setPreview] = useState(false),
    [uploading, setUploading] = useState(false),
    [template, setTemplate] = useState(""),
    [variables, setVariables] = useState<Record<string, string>>({}),
    [linkEditor, setLinkEditor] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const { pending, run } = useMutation();
  const selected = data.chats.filter((c) => destinations.includes(c.id));
  const input = (intent: PostInput["mode"]): PostInput => ({
    id: initial.id,
    body: cleanTelegramHtml(body),
    destinations,
    media,
    buttons,
    mode: intent,
    localTime,
    timezone,
  });
  const replaceBody = (value: string) => {
    setBody(value);
    if (editor.current) editor.current.innerHTML = value;
  };
  function format(command: string, value?: string) {
    editor.current?.focus();
    document.execCommand(command, false, value);
    setBody(editor.current?.innerHTML || "");
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    try {
      const added: PostInput["media"] = [];
      for (const file of Array.from(files).slice(0, 10 - media.length)) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/telegram/media", {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        added.push(result);
      }
      setMedia((m) => [...m, ...added]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setUploading(false);
    }
  }
  async function submit(intent: PostInput["mode"]) {
    if (
      await run(
        () => saveTelegramPost(input(intent)),
        intent === "draft"
          ? "Чернетку збережено"
          : intent === "now"
            ? "Публікацію передано до черги. Перевірте статус доставки."
            : "Публікацію заплановано",
      )
    )
      close();
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="tg-editor-dialog">
        <DialogTitle>
          {preview ? "Попередній перегляд" : "Нова публікація"}
        </DialogTitle>
        <DialogDescription>
          {data.demo
            ? "Деморежим: повідомлення не надсилаються в Telegram."
            : "Публікація з’явиться лише у вибраних чатах після підтвердження."}
        </DialogDescription>
        {preview ? (
          <>
            <TelegramPreview
              body={cleanTelegramHtml(body)}
              media={media}
              buttons={buttons}
            />
            <p className="notice">
              Повідомлення буде надіслано у {selected.length} чатів:{" "}
              {selected.map((c) => c.title).join(", ")}.
              {mode === "schedule" &&
                ` Час: ${localTime.replace("T", " ")} (${timezone}).`}
            </p>
            <div className="dialog-actions">
              <Button variant="outline" onClick={() => setPreview(false)}>
                <ArrowLeft size={16} />
                Назад
              </Button>
              <Button disabled={pending} onClick={() => submit(mode)}>
                <Send size={16} />
                {mode === "schedule"
                  ? "Підтвердити планування"
                  : "Опублікувати"}
              </Button>
            </div>
          </>
        ) : (
          <div className="tg-editor-grid">
            <section className="entity-form">
              <label>
                Куди опублікувати
                <select
                  aria-label="Вибір аудиторії"
                  defaultValue="manual"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "manual") setDestinations([]);
                    else
                      setDestinations(
                        data.chats
                          .filter(
                            (c) =>
                              c.status === "active" &&
                              (v === "all" ||
                                (v === "channels"
                                  ? c.kind === "channel"
                                  : c.course_id === v)),
                          )
                          .map((c) => c.id),
                      );
                  }}
                >
                  <option value="manual">Обрати чати вручну</option>
                  <option value="channels">Канали школи</option>
                  <option value="all">Усі активні групи й канали</option>
                  {crm.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Курс: {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="tg-destinations">
                {data.chats
                  .filter((c) => c.status === "active")
                  .map((c) => (
                    <label key={c.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={destinations.includes(c.id)}
                        onChange={(e) =>
                          setDestinations(
                            e.target.checked
                              ? [...destinations, c.id]
                              : destinations.filter((id) => id !== c.id),
                          )
                        }
                      />
                      {c.title}
                    </label>
                  ))}
                {!data.chats.some((c) => c.status === "active") && (
                  <p className="muted">
                    Спочатку підключіть групу або канал у Telegram → Групи.
                  </p>
                )}
              </div>
              <label>
                Шаблон
                <select
                  aria-label="Шаблон публікації"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  <option value="">Власний текст</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {template && (
                <div className="tg-template-vars">
                  {Array.from(
                    new Set(
                      data.templates
                        .find((t) => t.id === template)
                        ?.body.match(/\{\{([a-z_]+)\}\}/g) || [],
                    ),
                  ).map((key) => (
                    <label key={key}>
                      {key}
                      <input
                        value={variables[key.slice(2, -2)] || ""}
                        onChange={(e) =>
                          setVariables({
                            ...variables,
                            [key.slice(2, -2)]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      replaceBody(
                        renderTemplate(
                          data.templates.find((t) => t.id === template)!.body,
                          variables,
                        ),
                      )
                    }
                  >
                    Застосувати шаблон
                  </Button>
                </div>
              )}
              <div>
                <label>Текст</label>
                <div className="tg-toolbar">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Жирний"
                    onClick={() => format("bold")}
                  >
                    <Bold size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Курсив"
                    onClick={() => format("italic")}
                  >
                    <Italic size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Додати посилання"
                    onClick={() => {
                      const selection = window.getSelection();
                      savedRange.current = selection?.rangeCount
                        ? selection.getRangeAt(0).cloneRange()
                        : null;
                      setLinkEditor(true);
                    }}
                  >
                    <Link2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Список"
                    onClick={() => format("insertText", "\n• ")}
                  >
                    <List size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Emoji"
                    onClick={() => format("insertText", " 💛 ")}
                  >
                    <Smile size={16} />
                  </Button>
                  <span className="muted">Форматування Telegram</span>
                </div>
                {linkEditor && (
                  <form
                    className="tg-inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const url = String(f.get("url"));
                      if (!/^https?:\/\//.test(url)) {
                        toast.error("Вкажіть https посилання");
                        return;
                      }
                      editor.current?.focus();
                      if (savedRange.current) {
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(savedRange.current);
                      }
                      format(
                        "insertHTML",
                        `<a href="${escapeHtml(url)}">${escapeHtml(String(f.get("label") || url))}</a>`,
                      );
                      setLinkEditor(false);
                    }}
                  >
                    <input
                      name="label"
                      placeholder="Текст посилання"
                      required
                    />
                    <input
                      name="url"
                      placeholder="https://…"
                      type="url"
                      required
                    />
                    <Button size="sm">Додати</Button>
                  </form>
                )}
                <div
                  className="tg-rich-editor"
                  role="textbox"
                  aria-label="Текст публікації"
                  aria-multiline
                  contentEditable
                  suppressContentEditableWarning
                  ref={(node) => {
                    if (node && !editor.current) node.innerHTML = body;
                    editor.current = node;
                  }}
                  onInput={(e) => setBody(e.currentTarget.innerHTML)}
                  onPaste={(e) => {
                    e.preventDefault();
                    format("insertText", e.clipboardData.getData("text/plain"));
                  }}
                />
              </div>
              <div className="tg-ai">
                <Sparkles size={17} />
                <strong>AI-помічник</strong>
                <span>Підготовлено для майбутнього підключення</span>
                <div>
                  {[
                    "Створити текст",
                    "Зробити коротше",
                    "Зробити тепліше",
                    "Додати emoji",
                    "Переписати",
                  ].map((x) => (
                    <Button
                      key={x}
                      size="sm"
                      variant="outline"
                      disabled
                      title="AI-провайдер ще не підключений"
                    >
                      {x}
                    </Button>
                  ))}
                </div>
              </div>
            </section>
            <aside className="entity-form">
              <label className="tg-upload">
                <ImagePlus size={23} />
                {uploading
                  ? "Завантаження…"
                  : "Додати фото, відео або документ"}
                <small>JPG, PNG, WebP, MP4, PDF · до 4 МБ на файл</small>
                <input
                  type="file"
                  aria-label="Медіафайли"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                  disabled={uploading || media.length >= 10}
                  onChange={(e) => upload(e.target.files)}
                />
              </label>
              {media.map((m, i) => (
                <div className="tg-media-row" key={m.url}>
                  <span>
                    {m.kind === "photo" ? "▧" : m.kind === "video" ? "▶" : "▤"}{" "}
                    {m.name}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Прибрати медіа"
                    onClick={() => setMedia(media.filter((_, j) => i !== j))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <h3>Inline-кнопки</h3>
              {buttons.map((b, i) => (
                <div className="tg-button-fields" key={i}>
                  <input
                    aria-label="Текст кнопки"
                    placeholder="Зареєструватися"
                    value={b.label}
                    onChange={(e) =>
                      setButtons(
                        buttons.map((v, j) =>
                          i === j ? { ...v, label: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="URL кнопки"
                    type="url"
                    placeholder="https://…"
                    value={b.url}
                    onChange={(e) =>
                      setButtons(
                        buttons.map((v, j) =>
                          i === j ? { ...v, url: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setButtons(buttons.filter((_, j) => i !== j))
                    }
                  >
                    Прибрати
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                disabled={buttons.length >= 5}
                onClick={() => setButtons([...buttons, { label: "", url: "" }])}
              >
                + Додати кнопку
              </Button>
              <label>
                Коли опублікувати
                <select
                  aria-label="Час публікації"
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as "now" | "schedule")
                  }
                >
                  <option value="now">Опублікувати зараз</option>
                  <option value="schedule">Запланувати</option>
                </select>
              </label>
              {mode === "schedule" && (
                <>
                  <label>
                    Дата і час
                    <input
                      type="datetime-local"
                      value={localTime}
                      onChange={(e) => setLocalTime(e.target.value)}
                    />
                  </label>
                  <label>
                    Часовий пояс
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      {[
                        "Europe/Kyiv",
                        "Europe/Berlin",
                        "Europe/London",
                        "America/New_York",
                        "UTC",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <Button
                variant="outline"
                disabled={pending || uploading}
                onClick={() => submit("draft")}
              >
                <Save size={16} />
                Зберегти чернетку
              </Button>
              <Button
                disabled={pending || uploading}
                onClick={() => {
                  const result = postSchema.safeParse(input(mode));
                  if (!result.success) {
                    toast.error(result.error.issues[0].message);
                    return;
                  }
                  setPreview(true);
                }}
              >
                {mode === "schedule" ? (
                  <CalendarClock size={16} />
                ) : (
                  <Send size={16} />
                )}
                Попередній перегляд
              </Button>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function TelegramPreview({
  body,
  media,
  buttons,
}: {
  body: string;
  media: PostInput["media"];
  buttons: PostInput["buttons"];
}) {
  return (
    <div className="tg-preview-bg">
      <div className="tg-bubble">
        <strong>Змістовно</strong>
        {media.length > 0 && (
          <div className="tg-preview-media">
            {media.map((m) =>
              m.kind === "photo" ? (
                <Image
                  unoptimized
                  width={600}
                  height={400}
                  key={m.url}
                  src={m.url}
                  alt={m.name}
                />
              ) : m.kind === "video" ? (
                <video key={m.url} src={m.url} controls />
              ) : (
                <a
                  key={m.url}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ▤ {m.name}
                </a>
              ),
            )}
          </div>
        )}
        <div
          className="tg-preview-body"
          dangerouslySetInnerHTML={{ __html: cleanTelegramHtml(body) }}
        />
        <small>Змістовно · попередній перегляд ✓✓</small>
      </div>
      {buttons.map((b, i) => (
        <a
          className="tg-preview-button"
          key={i}
          href={b.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          {b.label || "Кнопка"} ↗
        </a>
      ))}
    </div>
  );
}
