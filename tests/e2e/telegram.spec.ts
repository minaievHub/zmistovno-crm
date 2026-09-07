import { test, expect } from "@playwright/test";
test("Telegram: create group, preview, publish, message history, schedule and cancel", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByLabel("Електронна пошта").fill("test@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Увійти до кабінету" }).click();
  await expect(page.getByRole("heading", { name: /Вітаємо/ })).toBeVisible();
  await page.getByRole("link", { name: "Telegram", exact: true }).click();
  await expect(page.getByText(/Деморежим · Усі/)).toBeVisible();
  await page.getByRole("button", { name: "Створити / підключити" }).click();
  const title = "Telegram test " + Date.now();
  await page.getByRole("textbox", { name: "Назва Telegram-групи" }).fill(title);
  await page.getByRole("button", { name: "Створити Telegram-групу" }).click();
  await expect(
    page.getByRole("heading", { name: "Групу створено 🎉" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: "Написати", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Текст публікації" })
    .fill("Важлива новина для батьків 💛 " + title);
  await page.getByRole("button", { name: "Попередній перегляд" }).click();
  await expect(
    page.getByText("Повідомлення буде надіслано у 1 чатів: " + title + "."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Опублікувати", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: "Публікації", exact: true }).click();
  const post = page
    .locator("article")
    .filter({ hasText: "Важлива новина для батьків 💛 " + title });
  await expect(post.getByText("Опубліковано", { exact: true })).toBeVisible();
  await post.getByRole("button", { name: "Переглянути" }).click();
  await expect(page.getByText(/Telegram ID:/)).toBeVisible();
  await page.getByRole("button", { name: "Закріпити", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Відкріпити", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Видалити з Telegram" }).click();
  await page.getByRole("button", { name: "Підтвердити", exact: true }).click();
  await expect(page.getByText("Видалено", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Закрити", exact: true }).click();
  await page.getByRole("button", { name: "Нова публікація" }).click();
  await page.getByRole("checkbox", { name: title, exact: true }).check();
  await page
    .getByRole("textbox", { name: "Текст публікації" })
    .fill("Заплановане нагадування " + title);
  await page
    .getByRole("combobox", { name: "Час публікації" })
    .selectOption("schedule");
  await page.getByLabel("Дата і час").fill("2030-06-01T18:00");
  await page.getByRole("button", { name: "Попередній перегляд" }).click();
  await page.getByRole("button", { name: "Підтвердити планування" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const scheduled = page
    .locator("article")
    .filter({ hasText: "Заплановане нагадування " + title });
  await expect(
    scheduled.getByText("Заплановано", { exact: true }),
  ).toBeVisible();
  await scheduled
    .getByRole("button", { name: "Скасувати", exact: true })
    .click();
  await page.getByRole("button", { name: "Підтвердити", exact: true }).click();
  await expect(scheduled.getByText("Скасовано", { exact: true })).toBeVisible();
  expect((await request.get("/api/telegram/cron")).status()).toBe(401);
  expect((await request.get("/api/telegram/cron", { headers: { Authorization: "Bearer e2e-local-cron-only" } })).status()).toBe(200);
  expect(
    (
      await request.post("/api/telegram/webhook", { data: { update_id: 1 } })
    ).status(),
  ).toBe(401);
});
