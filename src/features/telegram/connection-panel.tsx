"use client";
import { useState } from "react";
import { Bot, ShieldCheck, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Confirm, useMutation } from "@/components/common";
import {
  telegramConnection,
  beginTelegramLogin,
  finishTelegramLogin,
  disconnectTelegramAccount,
  configureTelegramWebhook,
} from "./actions";
export function ConnectionPanel({
  demo,
  admin,
}: {
  demo: boolean;
  admin: boolean;
}) {
  const [bot, setBot] = useState(""),
    [account, setAccount] = useState<{
      name: string;
      username: string;
      phone: string;
    } | null>(null),
    [login, setLogin] = useState(false),
    [step, setStep] = useState<"phone" | "code" | "password">("phone"),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(false);
  const { pending, run } = useMutation();
  const check = () =>
    run(async () => {
      const result = await telegramConnection();
      if (result.ok && "bot" in result) {
        setBot(result.bot!.username);
        setAccount(result.account || null);
      }
      return result;
    }, "Підключення перевірено");
  return (
    <>
      <div className="tg-connection-grid">
        <section className="card entity-form">
          <span className="tg-big-icon">
            <Bot size={25} />
          </span>
          <h2>Telegram Bot</h2>
          <Badge tone={bot ? "green" : "neutral"}>
            {bot
              ? demo
                ? "● Демо-адаптер"
                : "● Підключено"
              : "Ще не перевірено"}
          </Badge>
          {bot && <strong>@{bot}</strong>}
          <p className="muted">
            Публікації, запрошення, заявки на вступ та адміністрування груп.
          </p>
          <Button
            variant="outline"
            disabled={pending || !admin}
            onClick={check}
          >
            <RefreshCw size={16} />
            Перевірити підключення
          </Button>
          <Button variant="ghost" disabled={pending || !admin} onClick={check}>
            Перепідключити
          </Button>
          <Button
            variant="outline"
            disabled={pending || !admin}
            onClick={() =>
              run(() => configureTelegramWebhook(), "Webhook підключено")
            }
          >
            Підключити webhook
          </Button>
          <small className="muted">
            Для зміни бота адміністратор оновлює TELEGRAM_BOT_TOKEN на сервері й
            повторно перевіряє підключення.
          </small>
        </section>
        <section className="card entity-form">
          <span className="tg-big-icon">
            <ShieldCheck size={25} />
          </span>
          <h2>Telegram Account</h2>
          <Badge tone={account ? "green" : "neutral"}>
            {account
              ? demo
                ? "● Демо-власник"
                : "● Авторизовано"
              : "Не авторизовано / не перевірено"}
          </Badge>
          {account && (
            <p>
              <strong>{account.name}</strong>
              <br />@{account.username} · {account.phone}
            </p>
          )}
          <p className="muted">
            Лише створення груп і призначення бота. Особисті повідомлення з
            цього акаунта не надсилаються.
          </p>
          <Button
            disabled={pending || !admin || demo}
            onClick={() => {
              setLogin(true);
              setStep("phone");
            }}
          >
            {account ? "Перепідключити" : "Авторизувати"}
          </Button>
          <Button
            variant="outline"
            disabled={pending || !admin || !account || demo}
            onClick={() => setConfirm(true)}
          >
            <Unplug size={16} />
            Відключити
          </Button>
          <small className="muted">
            Session зашифрована AES-256-GCM. Коди та пароль 2FA не зберігаються.
          </small>
        </section>
      </div>
      {login && (
        <form
          className="card entity-form mt"
          autoComplete="off"
          onSubmit={async (e) => {
            e.preventDefault();
            if (step === "phone") {
              if (await run(() => beginTelegramLogin(phone), "Код запитано"))
                setStep("code");
            } else {
              await run(async () => {
                const result = await finishTelegramLogin(code, password);
                setPassword("");
                if (result.ok && "needsPassword" in result) {
                  if (result.needsPassword) setStep("password");
                  else {
                    setLogin(false);
                    setCode("");
                    setPhone("");
                  }
                }
                return result;
              }, "Відповідь Telegram отримано");
            }
          }}
        >
          <h3>Авторизація власника</h3>
          {step === "phone" ? (
            <label>
              Номер телефону
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380…"
                required
              />
            </label>
          ) : (
            <>
              <label>
                Код із Telegram
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  required
                />
              </label>
              {step === "password" && (
                <label>
                  Пароль 2FA
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </label>
              )}
            </>
          )}
          <Button disabled={pending}>
            {step === "phone" ? "Отримати код" : "Підтвердити"}
          </Button>
        </form>
      )}
      <section className="card mt">
        <h2>Серверне підключення</h2>
        <p className="muted">
          Параметри Telegram, шифрування, webhook і планувальника описані в
          docs/TELEGRAM.md. Налаштування доступні лише admin. Для заявок на
          вступ і автоматичного виявлення груп потрібен HTTPS webhook.
        </p>
      </section>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Відключити Telegram Account?"
        description="Session буде відкликана у Telegram та видалена з CRM. Бот продовжить працювати."
        pending={pending}
        onConfirm={async () => {
          if (await run(() => disconnectTelegramAccount())) {
            setAccount(null);
            setConfirm(false);
          }
        }}
      />
    </>
  );
}
