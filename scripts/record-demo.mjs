/**
 * Records an AccessHub walkthrough and saves docs/demo/accesshub-demo.gif.
 * Needs the API and the web app running on fresh demo data (see docs/DEMO_RECORDING.md):
 *   cd scripts && npm install && npx playwright install chromium && npm run record
 *
 * The story: an access request arrives live while the admin watches the dashboard (a teammate sends it through
 * the API in the background), the admin approves it for a week, flips a permission in the matrix and undoes it,
 * asks the access checker a question, and jumps to a person with Ctrl+K.
 */
import { spawn } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'demo');
const videoDir = path.join(outDir, '_video');
const gifPath = path.join(outDir, 'accesshub-demo.gif');

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:5177';
const VIEWPORT = { width: 1280, height: 720 };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The viewer asks for the Billing role, through the API, as if from another computer. */
async function viewerRequestsBilling() {
  const login = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'viewer@acme.local', password: 'Viewer123!' }),
  });
  const { tokens } = await login.json();
  const auth = { Authorization: `Bearer ${tokens.accessToken}`, 'Content-Type': 'application/json' };
  const options = await (await fetch(`${API_URL}/api/access-requests/options?permission=invoices.write`, { headers: auth })).json();
  const billing = options.find((role) => role.name === 'Billing');
  const response = await fetch(`${API_URL}/api/access-requests`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ roleId: billing.id, permission: 'invoices.write', reason: 'Covering quarter-end invoicing while Priya is away.' }),
  });
  if (!response.ok) throw new Error(`The access request failed: ${response.status} ${await response.text()}`);
}

async function record() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light', recordVideo: { dir: videoDir, size: VIEWPORT } });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('theme', 'light');
      localStorage.removeItem('accesshub-accent');
    } catch {}
  });
  const page = await context.newPage();

  // Sign in with a demo badge.
  await page.goto(`${WEB_URL}/login`);
  await wait(1500);
  await page.locator('button[value="org-admin"]').hover();
  await wait(600);
  await page.locator('button[value="org-admin"]').click();
  await page.waitForURL('**/app');
  await page.getByText('Live', { exact: true }).waitFor({ timeout: 20000 });
  await wait(2200);

  // A request arrives while the admin is looking at the dashboard.
  await viewerRequestsBilling();
  await page.getByText('Acme Viewer asked for Billing').waitFor();
  await wait(1800);
  await page.getByRole('button', { name: 'Review' }).click();
  await page.waitForURL('**/app/access-requests');
  await wait(1500);
  const card = page.locator('li').filter({ hasText: 'quarter-end invoicing' });
  await card.getByRole('button', { name: 'Approve' }).click();
  await wait(900);
  await page.getByRole('radio', { name: '1 week' }).click();
  await wait(700);
  await page.getByLabel(/Note for/).pressSequentially('Until Priya is back.', { delay: 45 });
  await wait(500);
  await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await page.getByText(/Acme Viewer now has Billing until/).waitFor();
  await wait(2200);

  // The permission matrix: change a role, then undo it.
  await page.getByRole('link', { name: 'Permission matrix' }).click();
  await page.waitForURL('**/app/roles/matrix');
  await wait(1400);
  await page.getByRole('checkbox', { name: 'Support: invoices.read' }).click();
  await page.getByText('Added invoices.read to Support').waitFor();
  await wait(1300);
  await page.getByRole('button', { name: 'Undo' }).click();
  await wait(1800);

  // The access checker: can the viewer create invoices now?
  await page.getByRole('link', { name: 'Access checker' }).click();
  await page.waitForURL('**/app/access-checker');
  await page.getByRole('combobox', { name: 'Person' }).click();
  await wait(500);
  await page.getByRole('option', { name: /Acme Viewer/ }).click();
  await page.getByRole('combobox', { name: 'Permission' }).click();
  await wait(500);
  await page.getByRole('option', { name: /Create invoices/ }).click();
  await page.getByText('Allowed', { exact: true }).waitFor();
  await wait(2600);

  // Ctrl+K: jump to anyone or anything.
  await page.keyboard.press('Control+k');
  await wait(500);
  await page.getByPlaceholder('Type a page, an action or a name…').pressSequentially('audit', { delay: 90 });
  await wait(900);
  await page.keyboard.press('Enter');
  await page.waitForURL('**/app/audit');
  await wait(2500);

  await context.close();
  await browser.close();
}

function convertToGif(input, output) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', input,
      '-vf', 'fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
      '-loop', '0',
      output,
    ];
    const proc = spawn(ffmpegPath, args, { stdio: 'inherit' });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(url)).status < 500) return;
    } catch {
      // not up yet
    }
    await wait(500);
  }
  throw new Error(`Not reachable: ${url}`);
}

await waitFor(`${API_URL}/health`);
await waitFor(`${WEB_URL}/login`);
await rm(videoDir, { recursive: true, force: true });
await record();

const webm = (await readdir(videoDir)).find((file) => file.endsWith('.webm'));
if (!webm) throw new Error('No recording found');
await convertToGif(path.join(videoDir, webm), gifPath);
await rm(videoDir, { recursive: true, force: true });
console.log(`Demo GIF saved: ${gifPath}`);
