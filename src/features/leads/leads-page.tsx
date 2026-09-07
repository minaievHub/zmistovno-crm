"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  Search,
  SlidersHorizontal,
  Archive,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
} from "lucide-react";
import { changeLeads, removeEntities } from "@/app/actions";
import {
  PageHeading,
  Badge,
  statusTone,
  Empty,
  Confirm,
  useMutation,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { exportLeads } from "@/services/export";
import { formatDate } from "@/lib/utils";
import { leadStatuses, type CrmData } from "@/types/crm";
import { LeadDrawer } from "./lead-drawer";
import { similarLeads, kyivDate } from "./selectors";
export function LeadsPage({
  data,
  initialSearch = "",
  initialCampaign = "",
  initialStatus = "",
  attention = "",
  archived = false,
  compact = false,
}: {
  data: CrmData;
  initialSearch?: string;
  initialCampaign?: string;
  initialStatus?: string;
  attention?: string;
  archived?: boolean;
  compact?: boolean;
}) {
  const [q, setQ] = useState(initialSearch),
    [campaign, setCampaign] = useState(initialCampaign),
    [status, setStatus] = useState(initialStatus),
    [course, setCourse] = useState(""),
    [direction, setDirection] = useState(""),
    [age, setAge] = useState(""),
    [manager, setManager] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [activeId, setActiveId] = useState<string | null>(null),
    [page, setPage] = useState(1),
    [confirm, setConfirm] = useState<"delete" | "archive" | null>(null);
  const { pending, run } = useMutation();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);
  const filtered = data.leads
    .filter((l) => {
      const c = data.campaigns.find((c) => c.id === l.campaign_id);
      const co = data.courses.find((co) => co.id === c?.course_id);
      const isArchived = !!l.archived_at || c?.status === "Архів";
      return (
        isArchived === archived &&
        (!q ||
          [
            l.first_name,
            l.last_name,
            l.phone,
            l.telegram,
            `${l.first_name} ${l.last_name}`,
          ].some((v) => v.toLowerCase().includes(q.toLowerCase()))) &&
        (!campaign || l.campaign_id === campaign) &&
        (!status || l.status === status) &&
        (!course || co?.id === course) &&
        (!direction || co?.direction_id === direction) &&
        (!age || l.age === Number(age)) &&
        (!manager ||
          (manager === "none" ? !l.manager_id : l.manager_id === manager)) &&
        (!from || kyivDate(l.created_at) >= from) &&
        (!to || kyivDate(l.created_at) <= to) &&
        (!attention ||
          (attention === "ungrouped"
            ? !l.group_id
            : attention === "overdue"
              ? ["Нова", "Потрібно зв’язатися", "Не відповідають"].includes(
                  l.status,
                ) && now - new Date(l.created_at).getTime() > 86400000
              : true))
      );
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const chosen = filtered.filter((l) => selected.includes(l.id));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const visible = compact
    ? filtered.slice(0, 5)
    : filtered.slice((currentPage - 1) * 12, currentPage * 12);
  const active = data.leads.find((l) => l.id === activeId) || null;
  async function bulk(input: unknown) {
    if (
      await run(() =>
        changeLeads(
          chosen.map((l) => l.id),
          input,
        ),
      )
    )
      setSelected([]);
  }
  return (
    <>
      {!compact && (
        <PageHeading
          eyebrow="РОБОТА З КЛІЄНТАМИ"
          title={archived ? "Архівні заявки" : "Заявки"}
          description="Кожна заявка — початок нової історії."
        >
          <Button
            variant="outline"
            onClick={() => exportLeads(chosen.length ? chosen : filtered, data)}
          >
            <Download size={17} />
            Експорт CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => router.refresh()}
            aria-label="Оновити заявки"
          >
            <RefreshCw size={17} />
          </Button>
        </PageHeading>
      )}
      <section
        className={"card leads-card " + (compact ? "compact-table" : "")}
      >
        {compact ? (
          <div className="card-heading">
            <h2>
              Останні заявки{" "}
              <span className="count-pill">{filtered.length}</span>
            </h2>
            <Link className="text-link" href="/leads">
              Усі заявки <ChevronRight size={15} />
            </Link>
          </div>
        ) : (
          <>
            <div className="table-tabs">
              <button
                className={!status ? "active" : ""}
                onClick={() => {
                  setStatus("");
                  setPage(1);
                }}
              >
                Усі заявки{" "}
                <span>
                  {
                    data.leads.filter(
                      (l) =>
                        !l.archived_at &&
                        data.campaigns.find((c) => c.id === l.campaign_id)
                          ?.status !== "Архів",
                    ).length
                  }
                </span>
              </button>
              <button
                className={status === "Нова" ? "active" : ""}
                onClick={() => {
                  setStatus("Нова");
                  setPage(1);
                }}
              >
                Нові
              </button>
              <button
                className={status === "Зв’язались" ? "active" : ""}
                onClick={() => {
                  setStatus("Зв’язались");
                  setPage(1);
                }}
              >
                У роботі
              </button>
              <button
                className={status === "Записаний" ? "active" : ""}
                onClick={() => {
                  setStatus("Записаний");
                  setPage(1);
                }}
              >
                Записані
              </button>
            </div>
            <div className="table-toolbar">
              <div className="input-icon">
                <Search size={17} />
                <input
                  aria-label="Пошук заявок"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ім’я, телефон або Telegram"
                />
              </div>
              <select
                aria-label="Фільтр набору"
                value={campaign}
                onChange={(e) => {
                  setCampaign(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Усі набори</option>
                {data.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => setFilters(!filters)}>
                <SlidersHorizontal size={16} />
                Фільтри
              </Button>
            </div>
            {filters && (
              <div className="filter-grid">
                <label>
                  Напрямок
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                  >
                    <option value="">Усі</option>
                    {data.directions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Курс
                  <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  >
                    <option value="">Усі</option>
                    {data.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Статус
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Усі</option>
                    {leadStatuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Вік
                  <input
                    type="number"
                    min={1}
                    max={18}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </label>
                <label>
                  Менеджер
                  <select
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                  >
                    <option value="">Усі</option>
                    <option value="none">Не призначено</option>
                    {data.profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Від дати
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  До дати
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQ("");
                    setCampaign("");
                    setStatus("");
                    setCourse("");
                    setDirection("");
                    setAge("");
                    setManager("");
                    setFrom("");
                    setTo("");
                    setPage(1);
                  }}
                >
                  Скинути фільтри
                </Button>
              </div>
            )}
            {attention && (
              <div className="notice">
                {attention === "ungrouped"
                  ? "Показані заявки без групи"
                  : "Показані заявки, що очікують відповіді понад 24 години"}{" "}
                <Link className="text-link" href="/leads">
                  Скинути
                </Link>
              </div>
            )}
            {chosen.length > 0 && (
              <div className="bulk-bar">
                <strong>Обрано: {chosen.length}</strong>
                <select
                  aria-label="Масова зміна статусу"
                  value=""
                  disabled={pending}
                  onChange={(e) => bulk({ status: e.target.value })}
                >
                  <option value="" disabled>
                    Змінити статус
                  </option>
                  {leadStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="Масове додавання до групи"
                  value=""
                  disabled={pending}
                  onChange={(e) => bulk({ group_id: e.target.value })}
                >
                  <option value="" disabled>
                    Додати до групи
                  </option>
                  {data.groups
                    .filter(
                      (g) =>
                        g.active &&
                        chosen.every(
                          (l) =>
                            data.campaigns.find((c) => c.id === l.campaign_id)
                              ?.course_id === g.course_id &&
                            (l.age === null ||
                              (l.age >= g.min_age && l.age <= g.max_age)),
                        ),
                    )
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
                {archived ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => bulk({ archived_at: null })}
                  >
                    <RotateCcw size={15} />
                    Відновити
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirm("archive")}
                  >
                    <Archive size={15} />
                    Архівувати
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportLeads(chosen, data)}
                >
                  <Download size={15} />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirm("delete")}
                >
                  <Trash2 size={15} />
                  Видалити
                </Button>
                <button
                  className="icon-button"
                  aria-label="Зняти вибір"
                  onClick={() => setSelected([])}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </>
        )}
        {visible.length === 0 ? (
          <Empty
            title="Заявок не знайдено"
            description="Спробуйте змінити фільтри або поділіться посиланням на форму реєстрації."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {!compact && (
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Вибрати всі відфільтровані заявки"
                        checked={
                          filtered.length > 0 &&
                          chosen.length === filtered.length
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? filtered.map((l) => l.id) : [],
                          )
                        }
                      />
                    </th>
                  )}
                  <th>Дитина</th>
                  <th>Вік</th>
                  <th>Контакт</th>
                  <th>Курс / набір</th>
                  <th>Статус</th>
                  {!compact && <th>Менеджер</th>}
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((l, i) => {
                  const c = data.campaigns.find((c) => c.id === l.campaign_id);
                  return (
                    <tr key={l.id}>
                      {!compact && (
                        <td>
                          <input
                            type="checkbox"
                            aria-label={
                              "Вибрати " + l.first_name + " " + l.last_name
                            }
                            checked={selected.includes(l.id)}
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? [...selected, l.id]
                                  : selected.filter((id) => id !== l.id),
                              )
                            }
                          />
                        </td>
                      )}
                      <td>
                        <button
                          className="person-cell"
                          onClick={() => setActiveId(l.id)}
                        >
                          <span className={"avatar avatar-" + (i % 4)}>
                            {l.first_name[0] || "Д"}
                            {l.last_name[0]}
                          </span>
                          <span>
                            <strong>
                              {l.first_name || "Без імені"} {l.last_name}
                            </strong>
                            {similarLeads(l, data.leads).length > 0 ? (
                              <small className="duplicate-label">
                                Можливий дублікат
                              </small>
                            ) : (
                              <small>
                                {l.group_id
                                  ? "У групі"
                                  : l.is_test
                                    ? "Демо-заявка"
                                    : "Без групи"}
                              </small>
                            )}
                          </span>
                        </button>
                      </td>
                      <td>
                        {l.age ?? "—"} <span className="muted">р.</span>
                      </td>
                      <td>
                        <a className="phone-link" href={"tel:+" + l.phone}>
                          {l.phone ? "+" + l.phone : "—"}
                        </a>
                        {l.telegram && (
                          <a
                            className="table-telegram"
                            href={"https://t.me/" + l.telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            @{l.telegram}
                          </a>
                        )}
                      </td>
                      <td>
                        <strong className="course-cell">
                          {
                            data.courses.find((co) => co.id === c?.course_id)
                              ?.name
                          }
                        </strong>
                        <small className="cell-subtitle">{c?.name}</small>
                      </td>
                      <td>
                        <select
                          className={
                            "status-select badge-" + statusTone(l.status)
                          }
                          aria-label={"Статус " + l.first_name}
                          disabled={pending}
                          value={l.status}
                          onChange={(e) =>
                            run(() =>
                              changeLeads([l.id], { status: e.target.value }),
                            )
                          }
                        >
                          {leadStatuses.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      {!compact && (
                        <td>
                          <Badge>
                            {data.profiles.find((p) => p.id === l.manager_id)
                              ?.full_name || "Не призначено"}
                          </Badge>
                        </td>
                      )}
                      <td className="date-cell">{formatDate(l.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!compact && (
          <div className="table-footer">
            <span>
              {filtered.length} заявок · Сторінка {currentPage} з {pages}
            </span>
            <div className="actions">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </section>
      <LeadDrawer
        lead={active}
        data={data}
        onClose={() => setActiveId(null)}
        onSelect={(l) => setActiveId(l.id)}
      />
      <Confirm
        open={!!confirm}
        onOpenChange={() => setConfirm(null)}
        title={
          confirm === "delete"
            ? `Видалити ${chosen.length} заявок назавжди?`
            : `Архівувати ${chosen.length} заявок?`
        }
        description={`Буде оброблено ${chosen.length} заявок. ${confirm === "delete" ? "Відновити їх та примітки буде неможливо. Створені учні залишаться." : "Заявки можна буде відновити з архіву."}`}
        pending={pending}
        onConfirm={async () => {
          if (
            await run(() =>
              confirm === "delete"
                ? removeEntities(
                    "leads",
                    chosen.map((l) => l.id),
                  )
                : changeLeads(
                    chosen.map((l) => l.id),
                    { archived_at: new Date().toISOString() },
                  ),
            )
          ) {
            setConfirm(null);
            setSelected([]);
          }
        }}
      />
    </>
  );
}
