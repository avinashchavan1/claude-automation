// ONE-TIME local helper. Opens a real browser window so you can log into
// Claude.ai by hand (email -> OTP code). It watches for the login session
// cookie and, as soon as you're logged in, automatically saves the session to
// auth.json and prints a base64 blob for the GitHub secret CLAUDE_AUTH.
//
// Run locally (NOT in CI):  node login.js

const fs = require('fs');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const AUTH_PATH = 'auth.json';
const POLL_MS = 3000;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to finish logging in

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isLoggedIn(context) {
  const cookies = await context.cookies();
  // Claude.ai sets a sessionKey cookie once authenticated.
  return cookies.some((c) => c.name === 'sessionKey' && c.value && c.value.length > 10);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  await page.goto('https://claude.ai/login', { waitUntil: 'domcontentloaded' });

  console.log('\n==============================================================');
  console.log(' A browser opened. Log into Claude.ai (enter email, then the');
  console.log(' OTP code from your inbox). This script auto-detects when you');
  console.log(' are logged in and saves the session — no key press needed.');
  console.log('==============================================================\n');

  const deadline = Date.now() + TIMEOUT_MS;
  let ok = false;
  while (Date.now() < deadline) {
    if (await isLoggedIn(context)) {
      ok = true;
      break;
    }
    process.stdout.write('.');
    await sleep(POLL_MS);
  }
  console.log('');

  if (!ok) {
    console.error('Timed out waiting for login (5 min). Re-run: node login.js');
    await browser.close();
    process.exit(1);
  }

  // Small settle so cookies are fully set, then save.
  await sleep(1500);
  const state = await context.storageState();

  // Keep ONLY cookies — the session (sessionKey) is cookie-based. claude.ai's
  // localStorage holds ~450KB of cache/telemetry that balloons auth.json past
  // GitHub's 48KB secret limit (HTTP 422 "Value is too large"). Dropping it
  // keeps the secret tiny and the session still restores fine.
  state.origins = [];
  fs.writeFileSync(AUTH_PATH, JSON.stringify(state));
  console.log(`Saved session to ${AUTH_PATH} (cookies only, ${fs.statSync(AUTH_PATH).size} bytes)`);

  const b64 = fs.readFileSync(AUTH_PATH).toString('base64');
  console.log('\n--- Base64 for GitHub secret CLAUDE_AUTH (copy everything below) ---\n');
  console.log(b64);
  console.log('\n--- end ---\n');
  console.log('Tip: copy straight to clipboard with:  base64 -i auth.json | pbcopy');

  await browser.close();
  process.exit(0);
})();
