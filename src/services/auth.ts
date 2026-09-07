import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { testMode, validTestToken, TEST_ADMIN } from "@/lib/test-database";
import type { Profile } from "@/types/crm";
export async function currentProfile(): Promise<Profile | null> {
  if (testMode()) {
    const value = (await cookies()).get("crm-test-session")?.value;
    return value && validTestToken(value)
      ? { id: TEST_ADMIN, full_name: "Олена Коваль", role: "admin" }
      : null;
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return null;
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  return profile;
}
export async function requireStaff() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!["admin", "manager"].includes(profile.role))
    throw new Error(
      "Для цієї ролі кабінет ще недоступний. Зверніться до адміністратора.",
    );
  return profile;
}
