import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

async function loginAsAdmin(page: any) {
  await page.goto("/login");

  // Ensure not stuck on loading
  await expect(page.locator("text=Loading...")).toHaveCount(0);

  await page.getByLabel("Email address").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL("**/dashboard");
}

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Loading...")).toHaveCount(0);
});

test("words page loads", async ({ page }) => {
  await page.goto("/words");
  await expect(page.locator("text=Loading")).toHaveCount(0);
});

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Welcome back")).toBeVisible();
});

test("admin login works", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "No admin credentials");

  await loginAsAdmin(page);
  await expect(page).toHaveURL(/dashboard/);
});

test("admin words page loads", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "No admin credentials");

  await loginAsAdmin(page);
  await page.goto("/admin/words");

  await expect(page.locator("text=Manage Words")).toBeVisible();
});

test("logout works", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "No admin credentials");

  await loginAsAdmin(page);

  await page.getByRole("button", { name: /logout/i }).click();
  await page.waitForURL("**/login");

  await expect(page.getByText("Welcome back")).toBeVisible();
});