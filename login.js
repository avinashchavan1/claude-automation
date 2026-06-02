// ONE-TIME local helper. Opens a real browser window so you can log into
// Claude.ai by hand (email -> OTP code). When you're done and see your chat,
// come back to the terminal and press Enter. The browser session (cookies +
// localStorage) is saved to auth.json, which the automation reuses in CI so it
// never has to log in again.
//
// Run locally (NOT in CI):  node login.js

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const readline = require('readline');

chromium.use(stealth);

const AUTH_PATH = 'auth.json';

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => { rl.close(); resolve(); }));
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
  console.log(' Log into Claude.ai in the browser window (enter email, then');
  console.log(' the OTP code from your inbox). Wait until you see your chat.');
  console.log('==============================================================\n');

  await waitForEnter('When you are fully logged in, press Enter here to save the session... ');

  await context.storageState({ path: AUTH_PATH });
  console.log(`\nSaved session to ${AUTH_PATH}`);

  // Print a base64 blob to paste into the GitHub secret CLAUDE_AUTH.
  const fs = require('fs');
  const b64 = fs.readFileSync(AUTH_PATH).toString('base64');
  console.log('\n--- Base64 for GitHub secret CLAUDE_AUTH (copy everything below) ---\n');
  console.log(b64);
  console.log('\n--- end ---\n');

  await browser.close();
  process.exit(0);
})();
