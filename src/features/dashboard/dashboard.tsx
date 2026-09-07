"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Inbox,
  UsersRound,
  Megaphone,
  Clock3,
  Sparkles,
  CalendarDays,
  CircleAlert,
} from "lucide-react";
import { Badge, PageHeading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { EntityEditor } from "@/features/catalog/entity-editor";
import { LeadsPage } from "@/features/leads/leads-page";
import { kyivDate } from "@/features/leads/selectors";
import type { CrmData, Profile } from "@/types/crm";
export function Dashboard({
  data,
  profile,
}: {
  data: CrmData;
  profile: Profile;
}) {
  const now = new Date();
  const active = data.leads.filter(
    (l) =>
      !l.archived_at &&
      data.campaigns.find((c) => c.id === l.campaign_id)?.status !== "Архів",
  );
  const today = active.filter(
    (l) => kyivDate(l.created_at) === kyivDate(now),
  ).length;
  const week = active.filter(
    (l) => now.getTime() - new Date(l.created_at).getTime() < 7 * 86400000,
  ).length;
  const fresh = active.filter((l) => l.status === "Нова").length;
  const overdue = active.filter(
    (l) =>
      ["Нова", "Потрібно зв’язатися", "Не відповідають"].includes(l.status) &&
      now.getTime() - new Date(l.created_at).getTime() > 86400000,
  ).length;
  const ungrouped = active.filter((l) => !l.group_id).length;
  const campaigns = data.campaigns.filter((c) => c.status === "Активний");
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getTime() - (6 - i) * 86400000);
    return {
      date,
      label: new Intl.DateTimeFormat("uk-UA", {
        weekday: "short",
        timeZone: "Europe/Kyiv",
      }).format(date),
      count: active.filter((l) => kyivDate(l.created_at) === kyivDate(date))
        .length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <>
      <PageHeading
        eyebrow="ВАША ШКОЛА В ОДНОМУ МІСЦІ"
        title={`Вітаємо, ${profile.full_name.split(" ")[0]} 👋`}
        description="Новий день — нові можливості для маленьких відкриттів."
      >
        <Button variant="outline" asChild>
          <Link href="/leads">
            <Inbox size={17} />
            До заявок
          </Link>
        </Button>
        <EntityEditor kind="campaigns" data={data} />
      </PageHeading>
      <div className="date-label">
        <CalendarDays size={15} />
        {new Intl.DateTimeFormat("uk-UA", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Europe/Kyiv",
        }).format(now)}
        <span className="live-dot" />
        Усе під контролем
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Нові заявки сьогодні",
            value: today,
            sub: `${week} за останні 7 днів`,
            Icon: Inbox,
            tone: "purple",
            href: "/leads?status=Нова",
          },
          {
            label: "Активні заявки",
            value: active.length,
            sub: `${fresh} ще чекають на знайомство`,
            Icon: UsersRound,
            tone: "blue",
            href: "/leads",
          },
          {
            label: "Активні набори",
            value: campaigns.length,
            sub: "Відкриті для нових історій",
            Icon: Megaphone,
            tone: "peach",
            href: "/campaigns",
          },
          {
            label: "Учні школи",
            value: data.students.length,
            sub: "Навчаються та зростають",
            Icon: Sparkles,
            tone: "green",
            href: "/students",
          },
        ].map(({ label, value, sub, Icon, tone, href }) => (
          <Link href={href} className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={"stat-icon " + tone}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="stat-value">{value}</strong>
            <div className="stat-bottom">
              <span>{sub}</span>
              <ArrowUpRight size={17} />
            </div>
          </Link>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="card activity-card">
          <div className="card-heading">
            <div>
              <h2>Як зростає інтерес</h2>
              <p className="muted">Нові заявки за останній тиждень</p>
            </div>
            <Badge>Останні 7 днів</Badge>
          </div>
          <div className="chart-summary">
            <strong>{week}</strong>
            <span className="muted">заявок за тиждень</span>
            <span className="chart-note">
              <span className="legend-dot" />
              Заявки
            </span>
          </div>
          <div className="bar-chart" aria-label="Заявки за останні 7 днів">
            {days.map((d, i) => (
              <div className="chart-column" key={i}>
                <div className="bar-track">
                  <div
                    className={"chart-bar " + (i === 6 ? "current" : "")}
                    style={{
                      height:
                        Math.max(d.count ? 8 : 0, (d.count / max) * 100) + "%",
                    }}
                  >
                    <span>{d.count}</span>
                  </div>
                </div>
                <small>{d.label}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="attention-card">
          <div className="card-heading">
            <h2>
              <CircleAlert size={20} />
              Потребують уваги
            </h2>
            <span className="attention-count">{fresh + overdue}</span>
          </div>
          <p className="muted">Трохи турботи — і ще одна дитина з нами.</p>
          <Link href="/leads?status=Нова">
            <span className="attention-icon purple">
              <Inbox size={19} />
            </span>
            <div>
              <strong>{fresh} нових заявок</strong>
              <small>Чекають на перше знайомство</small>
            </div>
            <ArrowRight size={17} />
          </Link>
          <Link href="/leads?attention=overdue">
            <span className="attention-icon peach">
              <Clock3 size={19} />
            </span>
            <div>
              <strong>{overdue} без відповіді понад 24 год</strong>
              <small>Саме час нагадати про себе</small>
            </div>
            <ArrowRight size={17} />
          </Link>
          <Link href="/leads?attention=ungrouped">
            <span className="attention-icon blue">
              <UsersRound size={19} />
            </span>
            <div>
              <strong>{ungrouped} заявок без групи</strong>
              <small>Допоможемо знайти свою команду</small>
            </div>
            <ArrowRight size={17} />
          </Link>
          <div className="attention-footer">Кожна розмова має значення ♡</div>
        </section>
      </div>
      <LeadsPage data={data} compact />
      <div className="section-heading">
        <h2>
          Активні набори <span className="count-pill">{campaigns.length}</span>
        </h2>
        <Link className="text-link" href="/campaigns">
          Усі набори <ArrowRight size={16} />
        </Link>
      </div>
      <div className="campaign-grid">
        {campaigns.map((c, i) => {
          const course = data.courses.find((co) => co.id === c.course_id),
            direction = data.directions.find(
              (d) => d.id === course?.direction_id,
            );
          const leads = active.filter((l) => l.campaign_id === c.id);
          return (
            <Link
              className="campaign-card"
              href={"/campaigns/" + c.id}
              key={c.id}
            >
              <div className="campaign-card-top">
                <span className={"course-icon course-icon-" + (i % 3)}>
                  {direction?.emoji || "✦"}
                </span>
                <Badge tone="green">● Активний</Badge>
              </div>
              <h3>{course?.name}</h3>
              <p>{c.name}</p>
              <div className="campaign-meta">
                <span>
                  <UsersRound size={15} />
                  {c.min_age}–{c.max_age} років
                </span>
                <span>{leads.length} заявок</span>
              </div>
              <div className="campaign-progress">
                <span
                  style={{
                    width:
                      (leads.length
                        ? (leads.filter((l) => l.status === "Записаний")
                            .length /
                            leads.length) *
                          100
                        : 0) + "%",
                  }}
                />
              </div>
              <div className="campaign-bottom">
                <span>
                  {leads.filter((l) => l.status === "Записаний").length}{" "}
                  записаних
                </span>
                <ArrowUpRight size={19} />
              </div>
            </Link>
          );
        })}
        <Link href="/campaigns" className="new-campaign-card">
          <span>＋</span>
          <h3>Час для нового набору</h3>
          <p>
            Дайте дітям ще одну
            <br />
            можливість відкрити себе
          </p>
        </Link>
      </div>
    </>
  );
}
