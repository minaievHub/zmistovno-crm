import { createClient } from "@supabase/supabase-js";
const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  ADMIN_EMAIL: email,
  ADMIN_PASSWORD: password,
  ADMIN_NAME: name,
} = process.env;
if (!url || !key || !email || !password || password.length < 12)
  throw new Error(
    "Set URL, service key, ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in .env.local",
  );
const sb = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) throw new Error(error.message);
const result = await sb.from("profiles").insert({
  id: data.user.id,
  full_name: name || "Адміністратор",
  role: "admin",
});
if (result.error) {
  await sb.auth.admin.deleteUser(data.user.id);
  throw new Error(result.error.message);
}
console.log(
  "Admin created. Sign in at /login. Remove ADMIN_PASSWORD; retain the server-only service key for Telegram.",
);
