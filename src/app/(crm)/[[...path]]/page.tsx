import { notFound } from "next/navigation";
import { requireStaff } from "@/services/auth";
import { readCrm } from "@/services/database";
import { Shell } from "@/components/shell";
import { Dashboard } from "@/features/dashboard/dashboard";
import { LeadsPage } from "@/features/leads/leads-page";
import { CatalogPage } from "@/features/catalog/catalog-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { TelegramPage } from "@/features/telegram/telegram-page";
import { telegramData } from "@/features/telegram/repository";
import { testMode } from "@/lib/test-database";
export const dynamic = "force-dynamic";
export default async function CrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireStaff();
  const { path = [] } = await params;
  const query = await searchParams;
  const section = path[0] || "dashboard";
  if (
    ![
      "dashboard",
      "leads",
      "directions",
      "courses",
      "campaigns",
      "groups",
      "students",
      "archive",
      "settings",
      "telegram",
    ].includes(section) ||
    path.length > 2
  )
    notFound();
  const data = await readCrm();
  let telegram = null;
  let telegramError = "";
  if (
    section === "telegram" ||
    (section === "settings" && path[1] === "telegram")
  ) {
    try {
      telegram = await telegramData();
    } catch {
      telegramError =
        "Підключіть серверний Supabase service key і застосуйте Telegram-міграцію за інструкцією docs/TELEGRAM.md.";
    }
  }
  const content =
    section === "telegram" ||
    (section === "settings" && path[1] === "telegram") ? (
      telegram ? (
        <TelegramPage
          key={JSON.stringify(query) + path.join("/")}
          origin={(process.env.APP_URL || "http://127.0.0.1:3000").replace(
            /\/$/,
            "",
          )}
          data={telegram}
          crm={data}
          profile={profile}
          query={query}
          settings={section === "settings"}
        />
      ) : (
        <section className="card">
          <h1>Telegram Control Center</h1>
          <p className="notice">{telegramError}</p>
          <p>
            {testMode()
              ? "Перезапустіть локальне демо, щоб застосувати нову міграцію."
              : "Модуль готовий до серверного налаштування."}
          </p>
        </section>
      )
    ) : section === "dashboard" ? (
      <Dashboard data={data} profile={profile} />
    ) : section === "leads" ? (
      <LeadsPage
        key={JSON.stringify(query)}
        data={data}
        initialSearch={typeof query.q === "string" ? query.q : ""}
        initialCampaign={
          typeof query.campaign === "string" ? query.campaign : ""
        }
        initialStatus={typeof query.status === "string" ? query.status : ""}
        attention={typeof query.attention === "string" ? query.attention : ""}
      />
    ) : section === "settings" ? (
      <SettingsPage data={data} profile={profile} />
    ) : (
      <CatalogPage
        section={
          section as
            | "directions"
            | "courses"
            | "campaigns"
            | "groups"
            | "students"
            | "archive"
        }
        id={path[1]}
        data={data}
      />
    );
  return (
    <Shell
      profile={profile}
      newCount={
        data.leads.filter(
          (l) =>
            l.status === "Нова" &&
            !l.archived_at &&
            data.campaigns.find((c) => c.id === l.campaign_id)?.status !==
              "Архів",
        ).length
      }
    >
      {content}
    </Shell>
  );
}
