import { expect, test } from '@playwright/test';
import { sidebar, signInWithBadge } from './helpers';

test('the console is closed to visitors who are not signed in', async ({ page }) => {
  await page.goto('/app/users');
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fusers$/);
});

test('the org admin sees and can change everything in their organization', async ({ page }) => {
  await signInWithBadge(page, 'org-admin');
  await expect(page.getByText('Waiting for a decision', { exact: true })).toBeVisible();

  // The dashboard's People card is a link too, so go through the sidebar.
  await sidebar(page).getByRole('link', { name: 'People', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/users$/);
  await expect(page.getByRole('button', { name: 'Invite person' })).toBeVisible();
  await expect(sidebar(page).getByRole('link', { name: 'Organizations' })).toHaveCount(0);
});

test('the viewer reads but is offered access requests instead of write actions', async ({ page }) => {
  await signInWithBadge(page, 'viewer');
  await expect(page.getByRole('link', { name: 'Request more access' })).toBeVisible();

  await page.goto('/app/users');
  await expect(page.getByRole('button', { name: 'Invite person' })).toHaveCount(0);
  await page.goto('/app/invoices');
  await expect(page.getByRole('link', { name: 'Request access to create invoices' })).toBeVisible();
});

test('the super admin oversees every organization', async ({ page }) => {
  await signInWithBadge(page, 'super-admin');
  await sidebar(page).getByRole('link', { name: 'Organizations' }).click();
  await expect(page).toHaveURL(/\/app\/organizations$/);
  // At desktop width the table is shown (the phone card list is hidden).
  const table = page.getByRole('table');
  await expect(table.getByRole('cell', { name: 'Blue Harbor Logistics', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Acme Corp', exact: true })).toBeVisible();
});

test('a wrong password says so without revealing whether the account exists', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('That email and password don’t match an active account.')).toBeVisible();
});
