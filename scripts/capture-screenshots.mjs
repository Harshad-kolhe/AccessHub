/**
 * Captures the README screenshots into docs/screenshots.
 * Needs the API and the web app running on fresh demo data (see docs/DEMO_RECORDING.md):
 *   cd scripts && npm install && npx playwright install chromium && npm run screenshots
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'screenshots');
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:5177';

const browser = await chromium.launch();
await mkdir(outDir, { recursive: true });

async function session({ scheme = 'light', width = 1440, height = 900, account } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: width < 600 ? 2 : 1 });
  // Default accent and the requested color mode, whatever an earlier run left in storage.
  await context.addInitScript((mode) => {
    try {
      localStorage.setItem('theme', mode);
      localStorage.removeItem('accesshub-accent');
    } catch {}
  }, scheme);
  const page = await context.newPage();
  if (account) {
    await page.goto(`${WEB_URL}/login`);
    await page.locator(`button[value="${account}"]`).click();
    await page.waitForURL('**/app');
  }
  return { context, page };
}

async function shot(page, name, { fullPage = false, settle = 600 } = {}) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(settle);
  const viewport = page.viewportSize();
  if (fullPage) {
    // Grow the window to the whole page instead of stitching, so the fixed sidebar runs the full height.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  if (fullPage) await page.setViewportSize(viewport);
  console.log(`saved ${name}.png`);
}

// Sign-in page and landing page.
{
  const { context, page } = await session();
  await page.goto(`${WEB_URL}/login`);
  await shot(page, 'sign-in');
  await page.goto(WEB_URL);
  await shot(page, 'landing');
  await context.close();
}

// The admin console, light mode.
{
  const { context, page } = await session({ account: 'org-admin' });
  await page.getByText('Live', { exact: true }).waitFor({ timeout: 20000 });
  await shot(page, 'dashboard', { fullPage: true });

  await page.goto(`${WEB_URL}/app/users`);
  await shot(page, 'people');

  await page.locator('table').getByRole('button', { name: 'Actions for Daniel Okafor' }).click();
  await page.getByRole('menuitem', { name: 'Manage roles' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('radio', { name: '1 week' }).click();
  await shot(page, 'role-manager');
  await page.keyboard.press('Escape');

  await page.goto(`${WEB_URL}/app/roles/matrix`);
  await shot(page, 'permission-matrix');

  await page.goto(`${WEB_URL}/app/access-requests`);
  await shot(page, 'access-requests', { fullPage: true });

  await page.goto(`${WEB_URL}/app/access-checker`);
  await page.getByRole('combobox', { name: 'Person' }).click();
  await page.getByRole('option', { name: /Acme Viewer/ }).click();
  await page.getByRole('combobox', { name: 'Permission' }).click();
  await page.getByRole('option', { name: /Create invoices/ }).click();
  await page.getByText('Not allowed').waitFor();
  await shot(page, 'access-checker', { fullPage: true });

  // Filtered to roles, with the permission diff of the Viewer role open.
  await page.goto(`${WEB_URL}/app/audit?entity=Role`);
  await page.locator('li', { hasText: 'changed the Viewer role' }).getByText(/Show what changed/).click();
  await shot(page, 'audit-log');

  await page.goto(`${WEB_URL}/app/account`);
  await page.getByRole('button', { name: 'Set up two-factor sign-in' }).click();
  await page.locator('[aria-label="QR code for your authenticator app"]').waitFor();
  await shot(page, 'account-security', { fullPage: true });
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.goto(`${WEB_URL}/app`);
  // The shortcut is registered once the header has hydrated; the live indicator shows that it has.
  await page.getByText('Live', { exact: true }).waitFor({ timeout: 20000 });
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Type a page, an action or a name…').pressSequentially('acc', { delay: 60 });
  await shot(page, 'command-palette', { settle: 400 });
  await context.close();
}

// Dark mode.
{
  const { context, page } = await session({ scheme: 'dark', account: 'org-admin' });
  await shot(page, 'dashboard-dark');
  await context.close();
}

// The super admin's platform view.
{
  const { context, page } = await session({ account: 'super-admin' });
  await page.goto(`${WEB_URL}/app/organizations`);
  await shot(page, 'organizations');
  await context.close();
}

// Phones.
{
  const { context, page } = await session({ width: 390, height: 844, account: 'org-admin' });
  await shot(page, 'mobile-dashboard');
  await page.goto(`${WEB_URL}/app/users`);
  await shot(page, 'mobile-people');
  await context.close();
}

// The API reference.
{
  const { context, page } = await session();
  await page.goto(`${API_URL}/scalar`);
  await page.waitForTimeout(2500);
  await shot(page, 'api-reference');
  await context.close();
}

await browser.close();
