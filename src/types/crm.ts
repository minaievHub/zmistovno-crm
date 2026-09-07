export const leadStatuses = [
  "Нова",
  "Потрібно зв’язатися",
  "Зв’язались",
  "Зацікавлені",
  "Записаний",
  "Думають",
  "Не відповідають",
  "Відмовились",
  "Неактуально",
] as const;
export const campaignStatuses = [
  "Чернетка",
  "Активний",
  "Призупинений",
  "Завершений",
  "Архів",
] as const;
export type Role = "admin" | "manager" | "teacher" | "call_center";
export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}
export interface Direction {
  id: string;
  name: string;
  description: string;
  emoji: string;
  active: boolean;
}
export interface Course {
  id: string;
  name: string;
  direction_id: string;
  description: string;
  min_age: number;
  max_age: number;
  active: boolean;
}
export interface Campaign {
  id: string;
  name: string;
  course_id: string;
  description: string;
  min_age: number;
  max_age: number;
  start_date: string | null;
  end_date: string | null;
  status: (typeof campaignStatuses)[number];
  slug: string;
  internal_note: string;
  created_at: string;
}
export const fieldKeys = [
  "first_name",
  "last_name",
  "age",
  "phone",
  "telegram",
  "parent_name",
  "comment",
] as const;
export type FieldKey = (typeof fieldKeys)[number];
export interface FormField {
  id: string;
  campaign_id: string;
  key: FieldKey;
  label: string;
  placeholder: string;
  required: boolean;
  enabled: boolean;
  position: number;
}
export interface Lead {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string;
  age: number | null;
  phone: string;
  telegram: string;
  parent_name: string;
  comment: string;
  status: (typeof leadStatuses)[number];
  manager_id: string | null;
  group_id: string | null;
  archived_at: string | null;
  is_test: boolean;
  created_at: string;
}
export interface Group {
  id: string;
  name: string;
  course_id: string;
  min_age: number;
  max_age: number;
  teacher: string;
  day: string;
  time: string;
  active: boolean;
}
export interface Student {
  id: string;
  lead_id: string | null;
  first_name: string;
  last_name: string;
  age: number | null;
  phone: string;
  telegram: string;
  created_at: string;
}
export interface GroupStudent {
  id: string;
  group_id: string;
  student_id: string;
  created_at: string;
}
export interface EntityLink {
  id: string;
  label: string;
  url: string;
  type: string;
  entity_type: "courses" | "campaigns" | "groups";
  entity_id: string;
}
export interface LeadNote {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}
export interface History {
  id: string;
  lead_id: string;
  actor_id: string | null;
  old_status: string | null;
  new_status: string;
  created_at: string;
}
export interface AuditLog {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  created_at: string;
}
export interface CrmData {
  profiles: Profile[];
  directions: Direction[];
  courses: Course[];
  campaigns: Campaign[];
  registration_form_fields: FormField[];
  leads: Lead[];
  groups: Group[];
  students: Student[];
  group_students: GroupStudent[];
  links: EntityLink[];
  lead_notes: LeadNote[];
  lead_status_history: History[];
  audit_logs: AuditLog[];
}
export type TableName = keyof CrmData;
export type PublicCampaign = Pick<
  Campaign,
  "id" | "name" | "description" | "min_age" | "max_age" | "slug"
> & { course_name: string; fields: FormField[] };
