import { expect, type Browser, type Page } from '@playwright/test';

export type DemoAccount = 'org-admin' | 'viewer' | 'super-admin';

/** Signs in with one of the demo badges on the sign-in page. */
export async function signInWithBadge(page: Page, account: DemoAccount) {
  await page.goto('/login');
  await page.locator(`button[value="${account}"]`).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
}

/** A second, separate browser session: another person at another computer. */
export async function newSession(browser: Browser, account: DemoAccount, baseURL: string) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await signInWithBadge(page, account);
  return { context, page };
}

/** The console's sidebar navigation (links elsewhere on a page can share its names). */
export function sidebar(page: Page) {
  return page.locator('[data-sidebar="sidebar"]:visible');
}

/** Waits until the realtime connection is up (the "Live" pill in the header). */
export async function waitForLive(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible({ timeout: 20_000 });
}
