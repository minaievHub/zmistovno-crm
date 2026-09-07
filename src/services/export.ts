import type { CrmData, Lead, Student } from "@/types/crm";
export function csvCell(value: unknown) {
  let v = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}
export function toCsv(rows: unknown[][]) {
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function downloadCsv(rows: unknown[][], filename: string) {
  const url = URL.createObjectURL(
    new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportLeads(leads: Lead[], data: CrmData) {
  downloadCsv(
    [
      [
        "Дата",
        "Ім’я",
        "Прізвище",
        "Вік",
        "Телефон",
        "Telegram",
        "Батьки",
        "Курс",
        "Набір",
        "Статус",
        "Група",
        "Менеджер",
      ],
      ...leads.map((l) => {
        const c = data.campaigns.find((c) => c.id === l.campaign_id);
        return [
          l.created_at,
          l.first_name,
          l.last_name,
          l.age,
          l.phone,
          l.telegram,
          l.parent_name,
          data.courses.find((co) => co.id === c?.course_id)?.name,
          c?.name,
          l.status,
          data.groups.find((g) => g.id === l.group_id)?.name,
          data.profiles.find((p) => p.id === l.manager_id)?.full_name,
        ];
      }),
    ],
    "zmistovno-leads.csv",
  );
}
export function exportStudents(students: Student[]) {
  downloadCsv(
    [
      ["Ім’я", "Прізвище", "Вік", "Телефон", "Telegram", "Дата створення"],
      ...students.map((s) => [
        s.first_name,
        s.last_name,
        s.age,
        s.phone,
        s.telegram,
        s.created_at,
      ]),
    ],
    "zmistovno-students.csv",
  );
}
