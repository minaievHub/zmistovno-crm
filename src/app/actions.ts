"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { testMode, testToken } from "@/lib/test-database";
import { requireStaff } from "@/services/auth";
import {
  deleteRows,
  insertRow,
  updateRows,
  rpc,
  readTable,
} from "@/services/database";
import {
  directionSchema,
  courseSchema,
  campaignSchema,
  groupSchema,
  linkSchema,
  formFieldSchema,
  leadPatchSchema,
  registrationSchema,
} from "@/lib/validation";
import type { PublicCampaign } from "@/types/crm";
export async function loginAction(
  _previous: { error: string },
  form: FormData,
) {
  const email = String(form.get("email") || ""),
    password = String(form.get("password") || "");
  if (testMode()) {
    if (
      email !== process.env.CRM_TEST_EMAIL ||
      password !== process.env.CRM_TEST_PASSWORD
    )
      return { error: "Неправильна пошта або пароль" };
    (await cookies()).set("crm-test-session", testToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
  } else {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return { error: "Спочатку налаштуйте Supabase. Інструкція — у README." };
    const { error } = await (
      await supabaseServer()
    ).auth.signInWithPassword({ email, password });
    if (error) return { error: "Неправильна пошта або пароль" };
  }
  redirect("/");
}
export async function logoutAction() {
  if (testMode()) (await cookies()).delete("crm-test-session");
  else await (await supabaseServer()).auth.signOut();
  redirect("/login");
}
const schemas = {
  directions: directionSchema,
  courses: courseSchema,
  campaigns: campaignSchema,
  groups: groupSchema,
  links: linkSchema,
  registration_form_fields: formFieldSchema,
};
export async function saveEntity(
  table: keyof typeof schemas,
  id: string | null,
  input: unknown,
) {
  await requireStaff();
  try {
    if (!(table in schemas)) throw new Error("Невідома сутність");
    const values = schemas[table].parse(input);
    if (id) {
      z.uuid().parse(id);
      await updateRows(table, [id], values);
    } else {const created=await insertRow(table,values) as {id:string};id=created.id;}
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function changeLeads(ids: string[], input: unknown) {
  await requireStaff();
  try {
    z.array(z.uuid()).min(1).max(1000).parse(ids);
    const values = leadPatchSchema.parse(input);
    await updateRows("leads", ids, values);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function removeEntities(
  table: "leads" | "campaigns" | "links",
  ids: string[],
) {
  await requireStaff();
  try {
    z.enum(["leads", "campaigns", "links"]).parse(table);
    z.array(z.uuid()).min(1).max(1000).parse(ids);
    await deleteRows(table, ids);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function addNote(leadId: string, body: string) {
  const profile = await requireStaff();
  try {
    z.uuid().parse(leadId);
    z.string().trim().min(1).max(2000).parse(body);
    await insertRow("lead_notes", {
      lead_id: leadId,
      body: body.trim(),
      author_id: profile.id,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function convertStudent(leadId: string) {
  await requireStaff();
  try {
    z.uuid().parse(leadId);
    await rpc("convert_student", { p_lead_id: leadId }, true);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function setProfileRole(id: string, role: string) {
  const actor = await requireStaff();
  try {
    if (actor.role !== "admin") throw new Error("Потрібна роль адміністратора");
    if (id === actor.id) throw new Error("Власну роль змінювати не можна");
    z.uuid().parse(id);
    z.enum(["admin", "manager", "teacher", "call_center"]).parse(role);
    await updateRows("profiles", [id], { role });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function getPublicCampaign(slug: string) {
  return (await rpc("public_campaign", {
    p_slug: slug,
  })) as PublicCampaign | null;
}
export async function registerChild(
  slug: string,
  submissionId: string,
  input: unknown,
) {
  try {
    z.uuid().parse(submissionId);
    const campaign = await getPublicCampaign(slug);
    if (!campaign) throw new Error("Реєстрацію на цей набір закрито");
    const values = registrationSchema(
      campaign.fields,
      campaign.min_age,
      campaign.max_age,
    ).parse(input);
    await rpc("submit_registration", {
      p_slug: slug,
      p_data: values,
      p_submission_id: submissionId,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
export async function refreshData() {
  await requireStaff();
  return readTable("leads");
}
function message(e: unknown) {
  if (e instanceof z.ZodError) return e.issues.map((i) => i.message).join(". ");
  if (e instanceof Error) {
    if (e.message.includes("duplicate key"))
      return "Такий slug уже існує. Вкажіть інший.";
    if (e.message.includes("foreign key"))
      return "Є пов’язані записи. Спочатку обробіть заявки або використайте архів.";
    return e.message;
  }
  return "Не вдалося зберегти зміни";
}
