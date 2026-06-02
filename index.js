// Browser automation: log into Claude.ai, open a new chat, send "hello",
// then screenshot the result. Uses playwright-extra + stealth to reduce
// bot detection. Credentials come from env vars CLAUDE_EMAIL / CLAUDE_PASSWORD.

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const EMAIL = process.env.CLAUDE_EMAIL;
const PASSWORD = process.env.CLAUDE_PASSWORD;

const MAX_ATTEMPTS = 3;
const SCREENSHOT_PATH = 'screenshot.png';
const NAV_TIMEOUT = 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('Missing CLAUDE_EMAIL or CLAUDE_PASSWORD environment variables.');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
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
    // 1. Go to login page.
    await page.goto('https://claude.ai/login', { waitUntil: 'domcontentloaded' });

    // 2. Enter email. The login form uses an email field; some flows show a
    //    "Continue with email" step first.
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(EMAIL);

    // Click the continue/submit button after entering email.
    const continueBtn = page
      .getByRole('button', { name: /continue|next|log ?in|sign ?in/i })
      .first();
    if (await continueBtn.count()) {
      await continueBtn.click().catch(() => {});
    } else {
      await emailInput.press('Enter');
    }

    // 3. Enter password once the field appears.
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible' });
    await passwordInput.fill(PASSWORD);

    const submitBtn = page
      .getByRole('button', { name: /continue|log ?in|sign ?in|submit/i })
      .first();
    if (await submitBtn.count()) {
      await submitBtn.click().catch(() => {});
    } else {
      await passwordInput.press('Enter');
    }

    // 4. Wait for the app to load after login.
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(3000);

    // 5. Open a fresh chat directly.
    await page.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(3000);

    // 6. Find the message input. Claude's composer is a contenteditable div
    //    (sometimes a textarea), so try several selectors.
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

    // 7. Submit with Enter.
    await composer.press('Enter');

    // 8. Give the response a moment to start, then screenshot.
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
