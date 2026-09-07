"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Check,
  Globe2,
  Heart,
  Sparkles,
  UsersRound,
  LoaderCircle,
} from "lucide-react";
import { registerChild } from "@/app/actions";
import { registrationSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import type { PublicCampaign } from "@/types/crm";
export function RegistrationForm({
  campaign: c,
}: {
  campaign: PublicCampaign;
}) {
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const submission = useRef<string | null>(null);
  const lock = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registrationSchema(c.fields, c.min_age, c.max_age)),
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) =>
    handleSubmit(async (values) => {
      if (lock.current) return;
      lock.current = true;
      setServerError("");
      submission.current ??= crypto.randomUUID();
      try {
        const result = await registerChild(c.slug, submission.current, values);
        if (result.ok) setSuccess(true);
        else setServerError(result.error || "Спробуйте ще раз.");
      } catch {
        setServerError(
          "Не вдалося надіслати заявку. Перевірте з’єднання та спробуйте ще раз.",
        );
      } finally {
        lock.current = false;
      }
    })(event);
  return (
    <main className="public-page">
      <header className="public-header">
        <div className="brand">
          <span className="brand-mark">✳</span>змістовно
          <span className="brand-dot">.</span>
        </div>
        <span>Онлайн-школа для дітей</span>
      </header>
      {success ? (
        <section className="success-card" role="status">
          <span className="success-symbol">
            <Check size={44} />
          </span>
          <span className="eyebrow">ПЕРШИЙ КРОК ЗРОБЛЕНО</span>
          <h1>Дякуємо за реєстрацію 💛</h1>
          <p>Ваша заявка успішно отримана.</p>
          <p>Менеджер «Змістовно» зв’яжеться з вами у Telegram.</p>
          <div className="success-note">
            <Heart size={20} />З нетерпінням чекаємо на знайомство!
          </div>
        </section>
      ) : (
        <div className="registration-layout">
          <section className="registration-story">
            <span className="public-tag">
              <Sparkles size={15} />
              ВІДКРИВАЄМО СВІТ РАЗОМ
            </span>
            <h1>{c.course_name}</h1>
            <p className="public-description">{c.description}</p>
            <div className="public-facts">
              <span>
                <UsersRound size={19} />
                {c.min_age}–{c.max_age} років
              </span>
              <span>
                <Globe2 size={19} />
                Онлайн, з будь-якої точки світу
              </span>
            </div>
            <div className="public-illustration" aria-hidden="true">
              <div className="speech speech-one">
                Hello!<span>✦</span>
              </div>
              <div className="speech speech-two">
                Привіт!<span>♡</span>
              </div>
              <div className="orbit-circle" />
              <span className="floating-star">✳</span>
            </div>
            <div className="public-care">
              <Heart size={22} />
              <p>
                Групи формуються залежно від віку дитини.
                <br />
                Кожному — увага, підтримка та простір бути собою.
              </p>
            </div>
          </section>
          <section className="registration-card">
            <span className="eyebrow">ЗРОБІМО ПЕРШИЙ КРОК</span>
            <h2>Познайомимося?</h2>
            <p className="muted">
              Залиште кілька слів про дитину, а про решту подбаємо ми.
            </p>
            <form onSubmit={submit} noValidate>
              {c.fields
                .filter((f) => f.enabled)
                .sort((a, b) => a.position - b.position)
                .map((f) => (
                  <label key={f.id}>
                    {f.label}
                    {f.required && <span className="required"> *</span>}
                    {f.key === "comment" ? (
                      <textarea
                        {...register(f.key)}
                        placeholder={f.placeholder}
                        rows={3}
                        aria-invalid={!!errors[f.key]}
                        aria-describedby={
                          errors[f.key] ? f.key + "-error" : undefined
                        }
                      />
                    ) : (
                      <input
                        {...register(f.key)}
                        type={
                          f.key === "age"
                            ? "number"
                            : f.key === "phone"
                              ? "tel"
                              : "text"
                        }
                        placeholder={f.placeholder}
                        min={f.key === "age" ? c.min_age : undefined}
                        max={f.key === "age" ? c.max_age : undefined}
                        autoComplete={f.key === "phone" ? "tel" : "off"}
                        aria-invalid={!!errors[f.key]}
                        aria-describedby={
                          errors[f.key] ? f.key + "-error" : undefined
                        }
                      />
                    )}
                    {errors[f.key] && (
                      <span className="form-error" id={f.key + "-error"}>
                        {String(errors[f.key]?.message)}
                      </span>
                    )}
                  </label>
                ))}
              {serverError && (
                <p className="form-error" role="alert">
                  {serverError}
                </p>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="registration-submit"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="spin" size={18} />
                    Надсилаємо…
                  </>
                ) : (
                  <>
                    Зареєструвати дитину
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
              <small className="public-privacy">
                Використаємо ваші контакти, щоб зв’язатися щодо навчання дитини.
              </small>
            </form>
          </section>
        </div>
      )}
      <footer className="public-footer">
        Змістовно · Навчаємо з любов’ю, зростаємо зі змістом
      </footer>
    </main>
  );
}
