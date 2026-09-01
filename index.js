// Browser automation: reuse a saved Claude.ai session, open a new chat, send
// "hello", and screenshot the result. No login happens here — the session is
// loaded from auth.json (created locally by login.js). Uses playwright-extra +
// stealth to reduce bot detection. Retries up to 3 times.

const fs = require('fs');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const AUTH_PATH = 'auth.json';
const MAX_ATTEMPTS = 3;
const SCREENSHOT_PATH = 'screenshot.png';
const NAV_TIMEOUT = 60_000;
// Reuse one existing conversation instead of creating a new chat every run.
// Override with the CHAT_URL env var if you want a different conversation.
const CHAT_URL =
  process.env.CHAT_URL ||
  'https://claude.ai/chat/6ddfce18-f987-4b67-ae9a-334be6497c79';
// Marker the workflow looks for to tell "session expired" apart from other
// failures (so it can open a GitHub issue to notify you).
const EXPIRED_FLAG = 'session-expired.flag';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (!fs.existsSync(AUTH_PATH)) {
    throw new Error(
      `Missing ${AUTH_PATH}. Run "node login.js" locally to create it, or ` +
        'provide the CLAUDE_AUTH secret (the workflow decodes it to auth.json).'
    );
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    storageState: AUTH_PATH,
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);

  try {
    // Open the existing conversation using the saved session.
    await page.goto(CHAT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(3000);

    // Detect an expired/invalid session: if we got bounced to login, the
    // saved state is stale and must be regenerated with login.js. Drop a
    // marker file so the workflow can notify via a GitHub issue.
    if (/\/login/.test(page.url())) {
      fs.writeFileSync(EXPIRED_FLAG, 'Session expired at ' + new Date().toISOString() + '\n');
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
      throw new Error(
        'Session expired — redirected to login. Re-run "node login.js" and ' +
          'update the CLAUDE_AUTH secret.'
      );
    }

    // Find the message input. Claude's composer is a contenteditable div
    // (sometimes a textarea), so try several selectors.
    const composer = page
      .locator(
        [
          'div[contenteditable="true"]',
          'textarea',
          '[data-testid="chat-input"]',
          'p[data-placeholder]',
        ].join(', ')
      )
      .first();
    await composer.waitFor({ state: 'visible' });

    // Because we reuse the SAME chat every run, the conversation already
    // contains old "hello" messages. Count them before sending, then confirm
    // the count went up — that proves THIS run's message actually posted.
    const helloMsg = page.getByText('hello', { exact: true });
    let before = 0;
    try {
      before = await helloMsg.count();
    } catch (_) {}

    await composer.click();
    await composer.fill('hello').catch(async () => {
      // contenteditable may not support fill(); type instead.
      await composer.type('hello');
    });

    // Submit with Enter.
    await composer.press('Enter');

    // Wait until a new "hello" bubble appears (count increased by 1).
    let sent = false;
    try {
      await page.waitForFunction(
        ({ n }) => {
          const nodes = Array.from(document.querySelectorAll('div, p, span'));
          const count = nodes.filter((el) => el.textContent && el.textContent.trim() === 'hello').length;
          return count > n;
        },
        { n: before },
        { timeout: 20_000 }
      );
      sent = true;
    } catch (_) {
      // count didn't grow
    }

    if (!sent) {
      // Screenshot the failure state for debugging before throwing.
      await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true }).catch(() => {});
      throw new Error('Could not confirm the message was sent (no new "hello" message appeared).');
    }

    // Give the response a moment to start, then screenshot proof.
    await sleep(5000);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    console.log(`Message confirmed sent in ${page.url()}. Screenshot saved to ${SCREENSHOT_PATH}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  // Clear any stale expiry marker from a previous run.
  if (fs.existsSync(EXPIRED_FLAG)) fs.unlinkSync(EXPIRED_FLAG);

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${MAX_ATTEMPTS}...`);
      await run();
      console.log('Success.');
      return;
    } catch (err) {
      lastError = err;
      console.error(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const backoff = attempt * 5000;
        console.log(`Retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
      }
    }
  }
  console.error('All attempts failed.');
  console.error(lastError);

  // Expired session is an expected, recurring state (Claude sessions age out
  // ~monthly and can only be refreshed with an OTP). Treat it as a soft
  // failure: the workflow's notify step opens ONE GitHub issue, and we exit 0
  // so GitHub does not email a "run failed" alert on every run until it's
  // refreshed. Any OTHER failure still exits 1 (red run + failure email).
  if (fs.existsSync(EXPIRED_FLAG)) {
    console.error(
      'Cause: expired session (expected). Exiting 0 — see the open GitHub issue to refresh.'
    );
    process.exit(0);
  }

  process.exit(1);
}

main();
