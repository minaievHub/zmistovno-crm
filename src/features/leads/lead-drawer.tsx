"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Send,
  Clock,
  UserRound,
  GraduationCap,
  MessageSquare,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { addNote, changeLeads, convertStudent } from "@/app/actions";
import { Badge, statusTone, useMutation } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDate, normalizeTelegram } from "@/lib/utils";
import { leadStatuses, type CrmData, type Lead } from "@/types/crm";
import { similarLeads } from "./selectors";
export function LeadDrawer({
  lead,
  data,
  onClose,
  onSelect,
}: {
  lead: Lead | null;
  data: CrmData;
  onClose: () => void;
  onSelect: (l: Lead) => void;
}) {
  return (
    <Dialog
      open={!!lead}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      {lead && (
        <DialogContent className="drawer">
          <DrawerContent
            key={lead.id}
            lead={lead}
            data={data}
            onSelect={onSelect}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
function DrawerContent({
  lead,
  data,
  onSelect,
}: {
  lead: Lead;
  data: CrmData;
  onSelect: (l: Lead) => void;
}) {
  const { pending, run } = useMutation();
  const [note, setNote] = useState("");
  const [showSimilar, setShowSimilar] = useState(false);
  const campaign = data.campaigns.find((c) => c.id === lead.campaign_id);
  const course = data.courses.find((c) => c.id === campaign?.course_id);
  const duplicates = similarLeads(lead, data.leads);
  const student = data.students.find((s) => s.lead_id === lead.id);
  const groups = data.groups.filter(
    (g) =>
      g.course_id === course?.id &&
      g.active &&
      (lead.age === null || (lead.age >= g.min_age && lead.age <= g.max_age)),
  );
  const history = [
    ...data.lead_status_history
      .filter((h) => h.lead_id === lead.id)
      .map((h) => ({
        id: h.id,
        date: h.created_at,
        text: h.old_status ? "Статус → " + h.new_status : "Заявку створено",
        author:
          data.profiles.find((p) => p.id === h.actor_id)?.full_name ||
          "Форма реєстрації",
      })),
    ...data.lead_notes
      .filter((n) => n.lead_id === lead.id)
      .map((n) => ({
        id: n.id,
        date: n.created_at,
        text: n.body,
        author:
          data.profiles.find((p) => p.id === n.author_id)?.full_name ||
          "Менеджер",
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="drawer-eyebrow">
        <UserRound size={15} />
        КАРТКА ЗАЯВКИ
      </div>
      <div className="lead-identity">
        <span className="avatar avatar-lg">{lead.first_name[0] || "Д"}</span>
        <div>
          <DialogTitle>
            {lead.first_name || "Без імені"} {lead.last_name}
          </DialogTitle>
          <DialogDescription>
            {lead.age ?? "—"} років · {formatDate(lead.created_at)}
          </DialogDescription>
        </div>
      </div>
      <div className="actions">
        <Badge tone={statusTone(lead.status)}>{lead.status}</Badge>
        {lead.is_test && <Badge>Тестова</Badge>}
        {duplicates.length > 0 && (
          <button
            className="badge badge-amber"
            onClick={() => setShowSimilar(!showSimilar)}
          >
            Можливий дублікат · {duplicates.length}
          </button>
        )}
      </div>
      {duplicates.length > 0 && (
        <button
          className="text-link"
          onClick={() => setShowSimilar(!showSimilar)}
        >
          Переглянути схожі записи
        </button>
      )}
      {showSimilar && (
        <div className="notice">
          {duplicates.map((l) => (
            <button
              className="similar-row"
              key={l.id}
              onClick={() => onSelect(l)}
            >
              {l.first_name} {l.last_name} · {l.phone} →
            </button>
          ))}
        </div>
      )}
      <section className="drawer-section">
        <h3>Контакти</h3>
        <div className="contact-row">
          <Phone size={17} />
          <a href={"tel:+" + lead.phone}>
            {lead.phone ? "+" + lead.phone : "Телефон не вказано"}
          </a>
          {lead.phone && (
            <button
              className="icon-button"
              aria-label="Скопіювати телефон"
              onClick={() =>
                navigator.clipboard
                  .writeText("+" + lead.phone)
                  .then(() => toast.success("Телефон скопійовано"))
                  .catch(() => toast.error("Не вдалося скопіювати"))
              }
            >
              <Copy size={14} />
            </button>
          )}
        </div>
        <div className="contact-row">
          <Send size={17} />
          {lead.telegram ? (
            <a
              href={"https://t.me/" + normalizeTelegram(lead.telegram)}
              target="_blank"
              rel="noopener noreferrer"
            >
              @{normalizeTelegram(lead.telegram)}
            </a>
          ) : (
            <span className="muted">Telegram не вказано</span>
          )}
        </div>
        <p className="muted">Батьки: {lead.parent_name || "Не вказано"}</p>
        {lead.comment && <div className="parent-comment">{lead.comment}</div>}
      </section>
      <section className="drawer-section">
        <h3>Джерело</h3>
        <dl className="detail-list">
          <dt>Курс</dt>
          <dd>{course?.name}</dd>
          <dt>Набір</dt>
          <dd>
            <Link className="text-link" href={"/campaigns/" + campaign?.id}>
              {campaign?.name}
            </Link>
          </dd>
        </dl>
      </section>
      <section className="drawer-section entity-form">
        <h3>Робота із заявкою</h3>
        <label>
          Статус
          <select
            disabled={pending}
            value={lead.status}
            onChange={(e) =>
              run(() => changeLeads([lead.id], { status: e.target.value }))
            }
          >
            {leadStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Відповідальний менеджер
          <select
            disabled={pending}
            value={lead.manager_id || ""}
            onChange={(e) =>
              run(() =>
                changeLeads([lead.id], { manager_id: e.target.value || null }),
              )
            }
          >
            <option value="">Не призначено</option>
            {data.profiles
              .filter((p) => ["admin", "manager"].includes(p.role))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Додати до групи
          <select
            disabled={pending}
            value={lead.group_id || ""}
            onChange={(e) =>
              run(() =>
                changeLeads([lead.id], { group_id: e.target.value || null }),
              )
            }
          >
            <option value="">Без групи</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <small className="muted">
          Показані активні групи відповідного курсу та віку.{" "}
          <Link className="text-link" href="/groups">
            Створити нову групу →
          </Link>
        </small>
        <label className="checkbox-label">
          <input
            type="checkbox"
            disabled={pending}
            checked={lead.is_test}
            onChange={(e) =>
              run(() => changeLeads([lead.id], { is_test: e.target.checked }))
            }
          />
          Тестова заявка
        </label>
        {lead.status === "Записаний" && (
          <Button
            variant="outline"
            disabled={pending || !!student}
            onClick={() => run(() => convertStudent(lead.id), "Учня створено")}
          >
            <GraduationCap size={17} />
            {student ? "Учня вже створено" : "Створити учня"}
          </Button>
        )}
      </section>
      <section className="drawer-section">
        <h3>
          <MessageSquare size={17} />
          Примітка менеджера
        </h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => addNote(lead.id, note), "Примітку додано"))
              setNote("");
          }}
        >
          <textarea
            aria-label="Коментар менеджера"
            rows={3}
            placeholder="Про що домовилися з батьками?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            required
            maxLength={2000}
          />
          <Button className="mt" size="sm" disabled={pending || !note.trim()}>
            Додати примітку
          </Button>
        </form>
      </section>
      <section className="drawer-section">
        <h3>
          <Clock size={17} />
          Історія
        </h3>
        <div className="timeline">
          {history.map((h) => (
            <div key={h.id}>
              <span className="timeline-dot" />
              <p>{h.text}</p>
              <small>
                {formatDate(h.date)} · {h.author}
              </small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
