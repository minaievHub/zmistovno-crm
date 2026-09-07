"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Copy,
  ExternalLink,
  Archive,
  Download,
  Clock,
  UsersRound,
  BookOpen,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { saveEntity, removeEntities } from "@/app/actions";
import {
  PageHeading,
  Badge,
  statusTone,
  Empty,
  Confirm,
  useMutation,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { EntityEditor } from "./entity-editor";
import { LinksPanel } from "./links-panel";
import { FormBuilder } from "@/features/campaigns/form-builder";
import { Cleanup } from "@/features/campaigns/cleanup";
import { LeadsPage } from "@/features/leads/leads-page";
import { exportStudents, exportLeads } from "@/services/export";
import { formatDate } from "@/lib/utils";
import type { CrmData, Campaign, Student } from "@/types/crm";
type Section =
  "directions" | "courses" | "campaigns" | "groups" | "students" | "archive";
const titles = {
  directions: "Напрямки",
  courses: "Курси",
  campaigns: "Набори",
  groups: "Групи",
  students: "Учні",
  archive: "Архів",
};
export function CatalogPage({
  section,
  id,
  data,
}: {
  section: Section;
  id?: string;
  data: CrmData;
}) {
  if (section === "archive") return <ArchivePage data={data} />;
  if (section === "students")
    return (
      <>
        <PageHeading
          eyebrow="НАВЧАННЯ"
          title="Учні"
          description="Діти, які вже стали частиною нашої школи."
        >
          <Button
            variant="outline"
            onClick={() => exportStudents(data.students)}
          >
            <Download size={17} />
            Експорт CSV
          </Button>
        </PageHeading>
        <StudentsTable students={data.students} />
      </>
    );
  const record = data[section].find((r) => r.id === id);
  if (id && !record)
    return (
      <Empty
        title="Запис не знайдено"
        description="Можливо, його було видалено."
      />
    );
  if (record)
    return (
      <Detail
        section={section}
        record={
          record as unknown as { id: string; name: string } & Record<
            string,
            unknown
          >
        }
        data={data}
      />
    );
  return (
    <>
      <PageHeading
        eyebrow="ОРГАНІЗАЦІЯ НАВЧАННЯ"
        title={titles[section]}
        description={
          {
            directions: "Різні інтереси. Безліч можливостей для розвитку.",
            courses: "Навчальні програми, що допомагають відкривати світ.",
            campaigns: "Запускайте набори та запрошуйте нових учнів.",
            groups: "Знайдіть кожній дитині свою команду.",
          }[section]
        }
      >
        <EntityEditor kind={section} data={data} />
      </PageHeading>
      {data[section].length === 0 ? (
        <div className="card">
          <Empty />
        </div>
      ) : (
        <div className="catalog-grid">
          {data[section]
            .filter((r) => !("status" in r) || r.status !== "Архів")
            .map((r, i) => {
              const course =
                "course_id" in r
                  ? data.courses.find((c) => c.id === r.course_id)
                  : section === "courses"
                    ? data.courses.find((c) => c.id === r.id)
                    : undefined;
              const direction =
                "direction_id" in r
                  ? data.directions.find((d) => d.id === r.direction_id)
                  : data.directions.find((d) => d.id === course?.direction_id);
              return (
                <Link
                  href={"/" + section + "/" + r.id}
                  className="catalog-card"
                  key={r.id}
                >
                  <div className="campaign-card-top">
                    <span className={"course-icon course-icon-" + (i % 3)}>
                      {"emoji" in r ? r.emoji : direction?.emoji || "✦"}
                    </span>
                    <Badge
                      tone={
                        "status" in r
                          ? statusTone(r.status)
                          : r.active
                            ? "green"
                            : "neutral"
                      }
                    >
                      {"status" in r
                        ? r.status
                        : r.active
                          ? "Активний"
                          : "Завершений"}
                    </Badge>
                  </div>
                  <h3>{r.name}</h3>
                  <p>{"description" in r ? r.description : course?.name}</p>
                  <div className="catalog-card-bottom">
                    <span>
                      {"min_age" in r
                        ? `${r.min_age}–${r.max_age} років`
                        : `${data.courses.filter((c) => c.direction_id === r.id).length} курсів`}
                    </span>
                    <ArrowRight size={18} />
                  </div>
                  {section === "campaigns" && (
                    <div className="card-extra">
                      {
                        data.leads.filter(
                          (l) => l.campaign_id === r.id && !l.archived_at,
                        ).length
                      }{" "}
                      заявок · Публічна форма
                    </div>
                  )}
                  {"teacher" in r && (
                    <div className="card-extra">
                      {r.day} · {r.time} · {r.teacher || "Викладач не вказаний"}
                    </div>
                  )}
                </Link>
              );
            })}
        </div>
      )}
      {section === "directions" && (
        <section className="card structure-card">
          <h2>Структура школи</h2>
          <p className="muted">Напрямок → Курс → Набір → Заявки</p>
          {data.directions.map((d) => (
            <details key={d.id}>
              <summary>
                {d.emoji} {d.name}
              </summary>
              {data.courses
                .filter((c) => c.direction_id === d.id)
                .map((c) => (
                  <details key={c.id}>
                    <summary>{c.name}</summary>
                    {data.campaigns
                      .filter((ca) => ca.course_id === c.id)
                      .map((ca) => (
                        <Link key={ca.id} href={"/leads?campaign=" + ca.id}>
                          {ca.name}
                          <ArrowRight size={14} />
                        </Link>
                      ))}
                  </details>
                ))}
            </details>
          ))}
        </section>
      )}
    </>
  );
}
function Detail({
  section,
  record,
  data,
}: {
  section: "directions" | "courses" | "campaigns" | "groups";
  record: { id: string; name: string } & Record<string, unknown>;
  data: CrmData;
}) {
  const course = data.courses.find((c) => c.id === record.course_id);
  const groupMembers = data.group_students.filter(
    (g) => g.group_id === record.id,
  );
  const students = data.students.filter((s) =>
    groupMembers.some((g) => g.student_id === s.id),
  );
  return (
    <>
      <Link className="back-link" href={"/" + section}>
        <ArrowLeft size={16} />
        {titles[section]}
      </Link>
      <PageHeading
        title={record.name}
        description={String(
          record.description || course?.name || "Усі деталі в одному місці.",
        )}
      >
        <EntityEditor kind={section} data={data} record={record} />
      </PageHeading>
      {section!=='directions'&&<div className="actions mt"><Button variant="outline" asChild><Link href={`/telegram?tab=groups&create=1&${section==='groups'?'group':section==='courses'?'course':'campaign'}=${record.id}`}>Створити Telegram infrastructure</Link></Button>{section==='groups'&&<Button asChild><Link href={'/telegram?tab=posts&compose=1&group='+record.id}>Написати в Telegram</Link></Button>}{section==='campaigns'&&<Button asChild><Link href={'/telegram?tab=posts&compose=1&campaign='+record.id}>Створити Telegram-анонс</Link></Button>}</div>}
      {section === "directions" && (
        <>
          <div className="section-heading">
            <h2>Курси напрямку</h2>
            <EntityEditor kind="courses" data={data} parentId={record.id} />
          </div>
          <div className="catalog-grid">
            {data.courses
              .filter((c) => c.direction_id === record.id)
              .map((c) => (
                <Link
                  className="catalog-card"
                  key={c.id}
                  href={"/courses/" + c.id}
                >
                  <BookOpen />
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                  <span>
                    {c.min_age}–{c.max_age} років →
                  </span>
                </Link>
              ))}
          </div>
        </>
      )}
      {section === "courses" && (
        <>
          <div className="section-heading">
            <h2>Набори курсу</h2>
            <EntityEditor kind="campaigns" data={data} parentId={record.id} />
          </div>
          <div className="catalog-grid">
            {data.campaigns
              .filter((c) => c.course_id === record.id)
              .map((c) => (
                <Link
                  className="catalog-card"
                  key={c.id}
                  href={"/campaigns/" + c.id}
                >
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  <h3>{c.name}</h3>
                  <p>
                    {c.min_age}–{c.max_age} років
                  </p>
                  <span>Переглянути набір →</span>
                </Link>
              ))}
          </div>
        </>
      )}
      {section === "campaigns" && (
        <CampaignDetail
          campaign={data.campaigns.find((c) => c.id === record.id)!}
          data={data}
        />
      )}
      {section === "groups" && (
        <>
          <div className="group-details card">
            <span>
              <Clock size={20} />
              <strong>
                {String(record.day)} · {String(record.time)}
              </strong>
              <small>Час за Києвом</small>
            </span>
            <span>
              <UsersRound size={20} />
              <strong>{students.length} учнів</strong>
              <small>
                {String(record.min_age)}–{String(record.max_age)} років
              </small>
            </span>
            <span>
              <BookOpen size={20} />
              <strong>{String(record.teacher) || "Не призначено"}</strong>
              <small>Викладач</small>
            </span>
            <Button variant="outline" onClick={() => exportStudents(students)}>
              <Download size={17} />
              Експорт групи
            </Button>
          </div>
          <StudentsTable
            students={students}
            addedDates={Object.fromEntries(
              groupMembers.map((g) => [g.student_id, g.created_at]),
            )}
          />
          <section className="card mt">
            <h2>Заявки, призначені до групи</h2>
            <p className="muted">
              Після статусу «Записаний» натисніть «Створити учня» в картці
              заявки.
            </p>
            {data.leads
              .filter((l) => l.group_id === record.id)
              .map((l) => (
                <Link
                  className="list-row"
                  key={l.id}
                  href={
                    "/leads?q=" +
                    encodeURIComponent(l.first_name + " " + l.last_name)
                  }
                >
                  {l.first_name} {l.last_name}
                  <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                </Link>
              ))}
          </section>
        </>
      )}
      {section !== "directions" && (
        <LinksPanel
          entityType={section}
          entityId={record.id}
          links={data.links.filter(
            (l) => l.entity_type === section && l.entity_id === record.id,
          )}
        />
      )}
    </>
  );
}
function CampaignDetail({
  campaign: c,
  data,
}: {
  campaign: Campaign;
  data: CrmData;
}) {
  const { pending, run } = useMutation();
  const leads = data.leads.filter((l) => l.campaign_id === c.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <section className="card public-link-card">
        <div>
          <Badge tone={statusTone(c.status)}>{c.status}</Badge>
          <h2>Запросіть дітей на навчання</h2>
          <p className="muted">
            Поділіться посиланням — заявки одразу з’являться в цьому наборі.
          </p>
          <code>/register/{c.slug}</code>
        </div>
        <div className="stack-actions">
          <Button
            onClick={() =>
              navigator.clipboard
                .writeText(location.origin + "/register/" + c.slug)
                .then(() => toast.success("Посилання скопійовано"))
                .catch(() =>
                  toast.error(
                    "Не вдалося скопіювати. Скопіюйте адресу вручну.",
                  ),
                )
            }
          >
            <Copy size={16} />
            Скопіювати посилання
          </Button>
          <Button variant="outline" asChild>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={"/register/" + c.slug}
            >
              <ExternalLink size={16} />
              Відкрити форму
            </a>
          </Button>
        </div>
      </section>
      <div className="actions campaign-actions">
        <Button variant="outline" asChild>
          <Link href={"/leads?campaign=" + c.id}>
            Переглянути заявки ({leads.length})<ArrowRight size={16} />
          </Link>
        </Button>
        <Button variant="outline" onClick={() => exportLeads(leads, data)}>
          <Download size={16} />
          Експорт
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() =>
              saveEntity("campaigns", c.id, { ...c, status: "Завершений" }),
            )
          }
        >
          Закрити набір
        </Button>
        <Button variant="outline" onClick={() => setConfirm(true)}>
          <Archive size={16} />
          Архівувати
        </Button>
        <Cleanup leads={leads} />
      </div>
      {c.internal_note && (
        <p className="notice">Внутрішня примітка: {c.internal_note}</p>
      )}
      <FormBuilder
        fields={data.registration_form_fields.filter(
          (f) => f.campaign_id === c.id,
        )}
      />
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Архівувати набір?"
        description={`Набір і ${leads.length} заявок будуть доступні в архіві. Публічну реєстрацію буде закрито.`}
        pending={pending}
        onConfirm={async () => {
          if (
            await run(() =>
              saveEntity("campaigns", c.id, { ...c, status: "Архів" }),
            )
          )
            setConfirm(false);
        }}
      />
    </>
  );
}
function ArchivePage({ data }: { data: CrmData }) {
  const { pending, run } = useMutation();
  const [remove, setRemove] = useState<Campaign | null>(null);
  const archived = data.campaigns.filter((c) =>
    ["Архів", "Завершений"].includes(c.status),
  );
  return (
    <>
      <PageHeading
        title="Архів"
        description="Завершені історії залишаються з нами. Ви завжди можете повернутися до них."
      />
      <section className="card">
        <h2>Закриті та архівні набори</h2>
        {archived.length === 0 ? (
          <Empty
            title="Немає закритих наборів"
            description="Архівовані набори з’являться тут."
          />
        ) : (
          archived.map((c) => (
            <div className="archive-row" key={c.id}>
              <div>
                <Link href={"/campaigns/" + c.id}>
                  <strong>{c.name}</strong>
                </Link>
                <small>
                  {data.leads.filter((l) => l.campaign_id === c.id).length}{" "}
                  заявок · {c.status}
                </small>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      saveEntity("campaigns", c.id, {
                        ...c,
                        status: "Призупинений",
                      }),
                    "Набір відновлено як призупинений",
                  )
                }
              >
                <RotateCcw size={15} />
                Відновити
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setRemove(c)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))
        )}
      </section>
      <div className="mt">
        <LeadsPage data={data} archived />
      </div>
      <Confirm
        open={!!remove}
        onOpenChange={() => setRemove(null)}
        title="Видалити набір назавжди?"
        description="Спочатку видаліть його заявки або збережіть набір в архіві. Пов’язані заявки автоматично не видаляються."
        pending={pending}
        onConfirm={async () => {
          if (
            remove &&
            (await run(() => removeEntities("campaigns", [remove.id])))
          )
            setRemove(null);
        }}
      />
    </>
  );
}
function StudentsTable({
  students,
  addedDates,
}: {
  students: Student[];
  addedDates?: Record<string, string>;
}) {
  return (
    <div className="card table-card">
      {students.length === 0 ? (
        <Empty
          title="Учнів поки немає"
          description="У картці записаної заявки натисніть «Створити учня»."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ім’я</th>
                <th>Прізвище</th>
                <th>Вік</th>
                <th>Телефон</th>
                <th>Telegram</th>
                <th>{addedDates ? "Додано до групи" : "Створено"}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.first_name}</strong>
                  </td>
                  <td>{s.last_name}</td>
                  <td>{s.age ?? "—"}</td>
                  <td>
                    <a href={"tel:+" + s.phone}>
                      {s.phone ? "+" + s.phone : "—"}
                    </a>
                  </td>
                  <td>
                    {s.telegram ? (
                      <a
                        className="text-link"
                        href={"https://t.me/" + s.telegram}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{s.telegram}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatDate(addedDates?.[s.id] || s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
