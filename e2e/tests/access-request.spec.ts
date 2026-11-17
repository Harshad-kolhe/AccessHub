import { expect, test } from '@playwright/test';
import { newSession, signInWithBadge, waitForLive } from './helpers';

test('a request is approved live and the requester gains the permission without signing in again', async ({ page, browser, baseURL }) => {
  // The admin watches the dashboard.
  await signInWithBadge(page, 'org-admin');
  await waitForLive(page);

  // The viewer, elsewhere, can read invoices but not create them, and asks for access.
  const viewer = await newSession(browser, 'viewer', baseURL!);
  try {
    await viewer.page.goto('/app/invoices');
    await viewer.page.getByRole('link', { name: 'Request access to create invoices' }).click();
    await waitForLive(viewer.page);
    await viewer.page.getByRole('combobox', { name: 'Role' }).click();
    await viewer.page.getByRole('option', { name: /Billing/ }).click();
    await viewer.page.getByLabel('Why do you need it?').fill('I am covering quarter-end invoicing this week.');
    await viewer.page.getByRole('button', { name: 'Send request' }).click();
    await expect(viewer.page.getByText('Asked for Billing')).toBeVisible();

    // The admin is notified in real time and approves it for a week.
    await expect(page.getByText('Acme Viewer asked for Billing')).toBeVisible();
    await page.goto('/app/access-requests');
    const card = page.locator('li').filter({ hasText: 'quarter-end invoicing' });
    await card.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('radio', { name: '1 week' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText(/Acme Viewer now has Billing until/)).toBeVisible();

    // The viewer hears about it at once, and can now create invoices.
    await expect(viewer.page.getByText('Your request for Billing was approved.')).toBeVisible();
    await viewer.page.goto('/app/invoices');
    await expect(viewer.page.getByRole('button', { name: 'New invoice' })).toBeVisible();
  } finally {
    await viewer.context.close();
  }

  // Put the demo data back: the admin removes the temporary role again.
  await page.goto('/app/users');
  await page.locator('table').getByRole('button', { name: 'Actions for Acme Viewer' }).click();
  await page.getByRole('menuitem', { name: 'Manage roles' }).click();
  await page.getByRole('button', { name: 'Remove Billing' }).click();
  await expect(page.getByText('Removed Billing from Acme Viewer')).toBeVisible();
});

test('nobody can approve their own request', async ({ page }) => {
  await signInWithBadge(page, 'viewer');
  await page.goto('/app/access-requests');
  // The viewer has no approval queue at all; deciding needs users.write.
  await expect(page.getByText('Waiting for a decision')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your requests' })).toBeVisible();
});
