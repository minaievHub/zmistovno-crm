"use client";
import { setProfileRole } from "@/app/actions";
import { PageHeading, Badge, useMutation } from "@/components/common";
import { formatDate } from "@/lib/utils";
import type { CrmData, Profile } from "@/types/crm";
import Link from 'next/link';
const entities: Record<string, string> = {
  directions: "Напрямок",
  courses: "Курс",
  campaigns: "Набір",
  leads: "Заявка",
  groups: "Група",
  students: "Учень",
  group_students: "Склад групи",
  links: "Посилання",
  lead_notes: "Примітка",
  registration_form_fields: "Поле форми",
};
const verbs: Record<string, string> = {
  INSERT: "Створено",
  UPDATE: "Оновлено",
  DELETE: "Видалено",
};
export function SettingsPage({
  data,
  profile,
}: {
  data: CrmData;
  profile: Profile;
}) {
  const { pending, run } = useMutation();
  return (
    <>
      <PageHeading
        title="Налаштування"
        description="Команда школи та історія важливих дій."
      />
      <section className="card mt"><h2>Telegram</h2><p className="muted">Бот школи та захищена авторизація власника.</p><Link href="/settings/telegram" className="btn btn-outline mt">Налаштувати Telegram →</Link></section>
      <section className="card">
        <h2>Команда</h2>
        <p className="muted">
          Нові облікові записи створює адміністратор через Supabase Auth за
          інструкцією в README.
        </p>
        {data.profiles.map((p) => (
          <div className="list-row" key={p.id}>
            <div>
              <strong>{p.full_name}</strong>
              {p.id === profile.id && <Badge>Це ви</Badge>}
            </div>
            <select
              aria-label={"Роль " + p.full_name}
              disabled={
                pending || profile.role !== "admin" || p.id === profile.id
              }
              value={p.role}
              onChange={(e) => run(() => setProfileRole(p.id, e.target.value))}
            >
              {["admin", "manager", "teacher", "call_center"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        ))}
        <p className="muted mt">
          Admin керує ролями. Admin і manager працюють з каталогом, заявками,
          наборами, групами та учнями. Teacher і call_center зарезервовані для
          майбутніх модулів і поки не мають доступу до CRM.
        </p>
      </section>
      <section className="card mt">
        <h2>Журнал активності</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Хто</th>
                <th>Дія</th>
                <th>Об’єкт</th>
              </tr>
            </thead>
            <tbody>
              {[...data.audit_logs]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, 100)
                .map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.created_at)}</td>
                    <td>
                      {data.profiles.find((p) => p.id === a.actor_id)
                        ?.full_name || "Система / публічна форма"}
                    </td>
                    <td>{verbs[a.action] || a.action}</td>
                    <td>
                      {entities[a.entity_type] || a.entity_type}{" "}
                      <small className="muted">{a.entity_id.slice(0, 8)}</small>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Останні 100 подій. Повний журнал зберігається в базі даних.
        </p>
      </section>
    </>
  );
}
