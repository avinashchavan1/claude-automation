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
    // Open a fresh chat directly using the saved session.
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(3000);

    // Detect an expired/invalid session: if we got bounced to login, the
    // saved state is stale and must be regenerated with login.js.
    if (/\/login/.test(page.url())) {
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
    await composer.click();
    await composer.fill('hello').catch(async () => {
      // contenteditable may not support fill(); type instead.
      await composer.type('hello');
    });

    // Submit with Enter.
    await composer.press('Enter');

    // Give the response a moment to start, then screenshot.
    await sleep(5000);
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    console.log(`Message sent. Screenshot saved to ${SCREENSHOT_PATH}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
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
  process.exit(1);
}

main();
