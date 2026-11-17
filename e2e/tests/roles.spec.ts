import { expect, test } from '@playwright/test';
import { signInWithBadge } from './helpers';

test('a permission matrix change saves at once and can be undone', async ({ page }) => {
  await signInWithBadge(page, 'org-admin');
  await page.goto('/app/roles/matrix');

  const cell = page.getByRole('checkbox', { name: 'Support: invoices.read' });
  await expect(cell).not.toBeChecked();
  await cell.click();
  await expect(cell).toBeChecked();
  await expect(page.getByText('Added invoices.read to Support')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText(/Undone: Support is back as it was/)).toBeVisible();
  await expect(cell).not.toBeChecked();
});

test('the viewer sees the matrix read-only', async ({ page }) => {
  await signInWithBadge(page, 'viewer');
  await page.goto('/app/roles/matrix');
  await expect(page.getByText('Read-only: changing roles needs roles.write.')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('the access checker explains who can do what, and why', async ({ page }) => {
  await signInWithBadge(page, 'org-admin');
  await page.goto('/app/access-checker');
  await page.getByRole('combobox', { name: 'Person' }).click();
  await page.getByRole('option', { name: /Priya Raman/ }).click();
  await page.getByRole('combobox', { name: 'Permission' }).click();
  await page.getByRole('option', { name: /Create invoices/ }).click();

  await expect(page.getByText('Allowed', { exact: true })).toBeVisible();
  await expect(page.getByText('Granted by')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The console as Priya Raman sees it' })).toBeVisible();
});
