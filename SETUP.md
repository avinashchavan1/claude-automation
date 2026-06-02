# Setup Guide

Step-by-step instructions to get this automation running on GitHub Actions.

## File structure

```
claude-automation/
├── index.js                     # The Playwright automation script
├── package.json                 # Dependencies and scripts
├── .gitignore
├── SETUP.md                     # This guide
└── .github/
    └── workflows/
        └── automate.yml         # GitHub Actions workflow (runs every 4 hours)
```

---

## 1. Create a new GitHub repository

1. Go to <https://github.com> and sign in.
2. Click the **+** icon in the top-right corner → **New repository**.
3. Enter a **Repository name** (e.g. `claude-automation`).
4. Choose **Private** (recommended, since this involves your credentials).
5. Do **not** check "Add a README" / ".gitignore" / "license" — you already have files to push.
6. Click **Create repository**.
7. On the next page, copy the repository URL (e.g. `https://github.com/YOUR_USERNAME/claude-automation.git`).

---

## 2. Push this code to the repository

Open a terminal in the project folder (`claude-automation/`) and run:

```bash
git init
git add .
git commit -m "Initial commit: Claude.ai automation"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/claude-automation.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username (and `claude-automation` if you named the repo differently).

> If `git push` asks for a password, use a **Personal Access Token** (GitHub no longer accepts account passwords over HTTPS). Create one at: GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**, with `repo` scope.

---

## 3. Add CLAUDE_EMAIL and CLAUDE_PASSWORD as GitHub Actions secrets

The script reads credentials from secrets — they are never stored in the code.

1. In your repository on GitHub, click **Settings** (top menu of the repo).
2. In the left sidebar, expand **Secrets and variables** → click **Actions**.
3. Click **New repository secret** (green button, top right).
4. Add the first secret:
   - **Name:** `CLAUDE_EMAIL`
   - **Secret:** your Claude.ai login email
   - Click **Add secret**.
5. Click **New repository secret** again and add the second:
   - **Name:** `CLAUDE_PASSWORD`
   - **Secret:** your Claude.ai password
   - Click **Add secret**.

You should now see both `CLAUDE_EMAIL` and `CLAUDE_PASSWORD` listed under **Repository secrets**. (Values are hidden and cannot be viewed again — only updated.)

---

## 4. Enable GitHub Actions and verify the workflow ran

1. In your repo, click the **Actions** tab.
2. If prompted, click **I understand my workflows, go ahead and enable them**.
3. You will see the **Claude Automation** workflow listed.
4. The cron schedule runs every 4 hours automatically. To test immediately without waiting:
   - Click **Claude Automation** in the left sidebar.
   - Click **Run workflow** (right side) → **Run workflow**.
5. A new run appears at the top of the list. Click it to watch progress.
6. Click the **run** job to expand the step logs. A green check ✅ means success; a red ✗ means it failed (open the failing step to read the error).

> **Note on cron timing:** GitHub Actions scheduled runs are best-effort and can be delayed several minutes (or skipped if the repo is inactive for ~60 days). Times in the cron expression are **UTC**.

---

## 5. View the screenshot artifact from a completed run

1. Go to the **Actions** tab → click the run you want to inspect.
2. Scroll to the bottom of the run summary page to the **Artifacts** section.
3. Click **screenshot** to download a zip.
4. Unzip it and open `screenshot.png` to verify the message was sent.

The screenshot is uploaded even when the script fails (`if: always()`), so you can use it to debug login or selector problems.

---

## Run locally (optional)

```bash
npm install
npx playwright install --with-deps chromium
export CLAUDE_EMAIL="you@example.com"
export CLAUDE_PASSWORD="your-password"
node index.js
```

A `screenshot.png` will appear in the folder.

---

## Notes & caveats

- **Bot detection / login challenges:** Claude.ai may present CAPTCHA, email verification codes, or 2FA. Automated scripts cannot solve those, so login may fail if any are triggered. The stealth plugin reduces — but does not eliminate — detection.
- **Terms of Service:** Automating logins may conflict with Claude.ai's Terms of Service. Use on an account you own, at your own risk.
- **Selectors may change:** Claude.ai's HTML can change at any time, breaking the email/password/composer selectors in `index.js`. If runs start failing, check the screenshot artifact and update the selectors.
