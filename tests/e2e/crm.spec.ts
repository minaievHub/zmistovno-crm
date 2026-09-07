import { test, expect } from "@playwright/test";
test("manager → public registration → status → note → group → student → archive", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Електронна пошта").fill("test@example.test");
  await page.getByLabel("Пароль", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Увійти до кабінету" }).click();
  await expect(page.getByRole("heading", { name: /Вітаємо/ })).toBeVisible();
  const unique = Date.now().toString();
  const direction = "Англійська " + unique,
    course = "English Speaking Club " + unique,
    campaign = "Вересень " + unique,
    slug = "english-test-" + unique;
  await page.getByRole("link", { name: "Напрямки", exact: true }).click();
  await page.getByRole("button", { name: "Створити напрямок" }).click();
  await page.getByLabel("Назва *", { exact: true }).fill(direction);
  await page.getByRole("button", { name: "Зберегти", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: "Курси", exact: true }).click();
  await page.getByRole("button", { name: "Створити курс" }).click();
  await page.getByLabel("Назва *", { exact: true }).fill(course);
  await page
    .getByRole("combobox", { name: "Напрямок *", exact: true })
    .selectOption({ label: "✦ " + direction });
  await page.getByRole("button", { name: "Зберегти", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: "Набори", exact: true }).click();
  await page.getByRole("button", { name: "Створити набір" }).click();
  await page.getByLabel("Назва *", { exact: true }).fill(campaign);
  await page
    .getByRole("combobox", { name: "Напрямок", exact: true })
    .selectOption({ label: direction });
  await page
    .getByRole("combobox", { name: "Курс *", exact: true })
    .selectOption({ label: course });
  await page
    .getByRole("combobox", { name: "Статус", exact: true })
    .selectOption("Активний");
  await page.getByLabel("Slug публічної форми").fill(slug);
  await page.getByRole("button", { name: "Зберегти", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: campaign, exact: true }) })
    .click();
  await expect(
    page.getByText("/register/" + slug, { exact: true }),
  ).toBeVisible();
  const parent = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const pp = await parent.newPage();
  await pp.goto("/register/" + slug);
  await pp.getByLabel("Ім’я дитини").fill("Тестик");
  await pp.getByLabel("Прізвище дитини").fill(unique);
  await pp.getByLabel("Вік дитини").fill("8");
  await pp.getByLabel("Номер телефону").fill("+380991234567");
  await pp.getByRole("button", { name: "Зареєструвати дитину" }).click();
  await expect(
    pp.getByRole("heading", { name: "Дякуємо за реєстрацію 💛" }),
  ).toBeVisible();
  await parent.close();
  await page.getByRole("link", { name: "Групи", exact: true }).click();
  await page.getByRole("button", { name: "Створити групу" }).click();
  await page
    .getByLabel("Назва *", { exact: true })
    .fill("English 7–9 " + unique);
  await page
    .getByRole("combobox", { name: "Напрямок", exact: true })
    .selectOption({ label: direction });
  await page
    .getByRole("combobox", { name: "Курс *", exact: true })
    .selectOption({ label: course });
  await page.getByRole("button", { name: "Зберегти", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("link", { name: /^Заявки/ }).click();
  await page.getByLabel("Пошук заявок").fill(unique);
  await page
    .getByRole("button", { name: new RegExp("Тестик " + unique) })
    .click();
  await page
    .getByRole("combobox", { name: "Статус", exact: true })
    .selectOption("Зв’язались");
  await expect(
    page.getByRole("combobox", { name: "Статус", exact: true }),
  ).toHaveValue("Зв’язались");
  await page
    .getByLabel("Коментар менеджера")
    .fill("Домовилися про пробне заняття");
  await page.getByRole("button", { name: "Додати примітку" }).click();
  await expect(
    page.getByText("Домовилися про пробне заняття", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Додати до групи", exact: true })
    .selectOption({ label: "English 7–9 " + unique });
  await page
    .getByRole("combobox", { name: "Статус", exact: true })
    .selectOption("Записаний");
  await page
    .getByRole("button", { name: "Створити учня", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Учня вже створено" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Закрити", exact: true }).click();
  await page.getByRole("link", { name: "Групи", exact: true }).click();
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", {
        name: "English 7–9 " + unique,
        exact: true,
      }),
    })
    .click();
  await expect(
    page.getByRole("cell", { name: "Тестик", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Заявки/ }).click();
  await page.getByLabel("Пошук заявок").fill(unique);
  await page
    .getByRole("checkbox", { name: "Вибрати Тестик " + unique })
    .check();
  await page.getByRole("button", { name: "Архівувати", exact: true }).click();
  await page.getByRole("button", { name: "Підтвердити", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Заявок не знайдено" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Архів", exact: true }).click();
  await page.getByLabel("Пошук заявок").fill(unique);
  await page
    .getByRole("checkbox", { name: "Вибрати Тестик " + unique })
    .check();
  await page.getByRole("button", { name: "Відновити", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Заявок не знайдено" }),
  ).toBeVisible();
});
test("closed public form and mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register/not-a-campaign");
  await expect(
    page.getByRole("heading", { name: "Цей набір наразі закрито" }),
  ).toBeVisible();
  await page.goto("/register/english-speaking-club-september-2026");
  await expect(
    page.getByRole("heading", { name: "Познайомимося?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Зареєструвати дитину" }).click();
  await expect(page.getByText(/Заповніть: Ім’я/)).toBeVisible();
});
