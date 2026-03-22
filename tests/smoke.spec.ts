import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await expect(page.locator("text=Loading...")).toHaveCount(0);

  await page.getByLabel("Email address").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.locator("text=Loading dashboard...")).toHaveCount(0);
}

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText("11+ Succeed");
});

test("words page loads with pagination", async ({ page }) => {
  await page.goto("/words");
  await expect(
    page.getByRole("heading", { name: /vocabulary list/i })
  ).toBeVisible();

  await expect(page.locator("text=Loading vocabulary words...")).toHaveCount(0);
  await expect(page.getByText(/^Page 1$/).first()).toBeVisible();
});

test("login page loads and does not hang", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /welcome back/i })
  ).toBeVisible();
  await expect(page.locator("text=Loading...")).toHaveCount(0);
});

test("admin can log in and dashboard loads", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Missing E2E admin credentials");

  await loginAsAdmin(page);
  await expect(page.locator("text=Welcome")).toBeVisible();
});

test("quiz page loads for logged in user", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Missing E2E admin credentials");

  await loginAsAdmin(page);
  await page.goto("/quiz");

  await expect(page.locator("text=Checking access...")).toHaveCount(0);
  await expect(page.locator("text=Loading quiz...")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /vocabulary quiz/i })
  ).toBeVisible();
});

test("admin words page loads with pagination", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Missing E2E admin credentials");

  await loginAsAdmin(page);
  await page.goto("/admin/words");

  await expect(
    page.getByRole("heading", { name: /manage words/i })
  ).toBeVisible();
  await expect(page.locator("text=Loading words manager...")).toHaveCount(0);
  await expect(page.getByText(/^Page 1$/).first()).toBeVisible();
});

test("admin upload page loads", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Missing E2E admin credentials");

  await loginAsAdmin(page);
  await page.goto("/admin/upload");

  await expect(
    page.getByRole("heading", { name: /upload vocabulary/i })
  ).toBeVisible();
  await expect(page.locator("text=Loading upload page...")).toHaveCount(0);
});

test("logout works", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Missing E2E admin credentials");

  await loginAsAdmin(page);
  await page.getByRole("button", { name: /logout/i }).click();

  await page.waitForURL("**/login");
  await expect(
    page.getByRole("heading", { name: /welcome back/i })
  ).toBeVisible();
});

test("logged in user can complete a full quiz", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Missing E2E admin credentials");

  await loginAsAdmin(page);
  await page.goto("/quiz");

  await expect(page.locator("text=Checking access...")).toHaveCount(0);
  await expect(page.locator("text=Loading quiz...")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /vocabulary quiz/i })
  ).toBeVisible();

  for (let i = 0; i < 10; i += 1) {
    const submitButton = page.getByRole("button", { name: /submit answer/i });

    await expect(submitButton).toBeVisible();

    const optionButtons = page.locator("main button").filter({
      hasNotText: /submit answer|next question|finish quiz/i,
    });

    const optionCount = await optionButtons.count();
    expect(optionCount).toBeGreaterThan(0);

    await optionButtons.first().click();

    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    if (i < 9) {
      const nextButton = page.getByRole("button", { name: /next question/i });
      await expect(nextButton).toBeVisible();
      await nextButton.click();
    } else {
      const finishButton = page.getByRole("button", { name: /finish quiz/i });
      await expect(finishButton).toBeVisible();
      await finishButton.click();
    }
  }

  await expect(
    page.getByRole("heading", { name: /quiz complete/i })
  ).toBeVisible();

  await expect(page.locator("text=You scored")).toBeVisible();
});