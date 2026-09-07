import { normalizePhone, normalizeTelegram } from "@/lib/utils";
import type { Lead } from "@/types/crm";
export function similarLeads(lead: Lead, all: Lead[]) {
  return all.filter(
    (l) =>
      l.id !== lead.id &&
      ((!!lead.phone &&
        normalizePhone(l.phone) === normalizePhone(lead.phone)) ||
        (!!lead.first_name &&
          !!lead.last_name &&
          l.first_name.trim().toLowerCase() ===
            lead.first_name.trim().toLowerCase() &&
          l.last_name.trim().toLowerCase() ===
            lead.last_name.trim().toLowerCase()) ||
        (!!lead.telegram &&
          normalizeTelegram(l.telegram) === normalizeTelegram(lead.telegram))),
  );
}
export function kyivDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
