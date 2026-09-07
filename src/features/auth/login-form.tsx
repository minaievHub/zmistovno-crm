"use client";
import { useActionState } from "react";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">✳</span>змістовно
          <span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow">
            <Sparkles size={16} /> ПРОСТІР МОЖЛИВОСТЕЙ
          </span>
          <h1>
            Великі відкриття
            <br />
            починаються
            <br />
            <em>з маленьких кроків.</em>
          </h1>
          <p>
            А ми допоможемо не загубити жодного.
            <br />
            Усі заявки, діти та групи — в одному місці.
          </p>
          <div className="login-art">
            <BookOpen size={100} strokeWidth={1} />
            <span>а</span>
            <span>✦</span>
            <span>+</span>
          </div>
        </div>
        <small>Онлайн-школа для дітей · Зростаємо змістовно</small>
      </section>
      <section className="login-form-wrap">
        <form action={action} className="login-form">
          <BadgeText />
          <h2>Раді бачити вас знову</h2>
          <p className="muted">Увійдіть до кабінету команди «Змістовно».</p>
          <label>
            Електронна пошта
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@school.com"
              required
            />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Ваш пароль"
              required
              minLength={6}
            />
          </label>
          {state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
          {!configured && (
            <p className="notice">
              Підключіть Supabase за інструкцією у README, щоб увійти.
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Входимо…" : "Увійти до кабінету"}
            <ArrowRight size={18} />
          </Button>
          <small className="muted">
            Доступ для команди школи. Щоб отримати обліковий запис або відновити
            пароль, зверніться до адміністратора.
          </small>
        </form>
      </section>
    </main>
  );
}
function BadgeText() {
  return <span className="eyebrow">КАБІНЕТ КОМАНДИ</span>;
}
