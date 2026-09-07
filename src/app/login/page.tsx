import { currentProfile } from "@/services/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login-form";
export default async function Login() {
  if (await currentProfile()) redirect("/");
  return (
    <LoginForm
      configured={
        !!process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.CRM_TEST_MODE === "1"
      }
    />
  );
}
