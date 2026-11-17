import { expect, test } from '@playwright/test';
import { signInWithBadge } from './helpers';

test('audit filters live in the URL and the filtered view downloads as CSV', async ({ page }) => {
  await signInWithBadge(page, 'org-admin');
  await page.goto('/app/audit');

  await page.getByRole('combobox', { name: 'What' }).click();
  await page.getByRole('option', { name: 'Role grants' }).click();
  await expect(page).toHaveURL(/entity=RoleAssignment/);
  await expect(page.getByText(/gave .* role/).first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/^accesshub-audit-.*\.csv$/);
});

const PAGES = ['/app', '/app/users', '/app/roles', '/app/roles/matrix', '/app/access-requests', '/app/access-checker', '/app/invoices', '/app/audit', '/app/account'];

for (const width of [360, 768, 1280]) {
  test(`nothing sticks out past the screen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    await signInWithBadge(page, 'org-admin');
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const offenders = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const found: string[] = [];
        for (const element of document.querySelectorAll('body *')) {
          const style = getComputedStyle(element);
          if (style.position === 'fixed' || style.display === 'none') continue;
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.right <= viewport + 1) continue;
          // Content inside its own scroll container (the matrix, wide tables) is meant to scroll.
          let parent = element.parentElement;
          let scrolls = false;
          while (parent && parent !== document.body) {
            if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) {
              scrolls = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (!scrolls) found.push(`${element.tagName.toLowerCase()}.${String(element.className).slice(0, 40)}`);
        }
        return found.slice(0, 3);
      });
      expect(offenders, `${path} at ${width}px`).toEqual([]);
    }
  });
}
