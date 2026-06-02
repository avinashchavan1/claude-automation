# Setup Guide

Step-by-step instructions to get this automation running on GitHub Actions.

## File structure

```
claude-automation/
├── login.js                     # ONE-TIME local helper: log in by hand, save session
├── index.js                     # The automation script (reuses saved session)
├── package.json                 # Dependencies and scripts
├── .gitignore
├── SETUP.md                     # This guide
└── .github/
    └── workflows/
        └── automate.yml         # GitHub Actions workflow (runs every 4 hours)
```

## How login works (important)

Claude.ai has **no password login** — it uses a one-time code (OTP) sent to your
email. A CI job can't receive that code, so this project does **not** log in
during the scheduled run. Instead:

1. You log in **once, locally**, in a real browser (`node login.js`).
2. That saves your session (cookies + localStorage) to `auth.json`.
3. You store the session as a GitHub secret (`CLAUDE_AUTH`).
4. Every scheduled run just **reuses** that session — no login, no OTP.

The session eventually expires (days to weeks). When runs start failing with
"Session expired", repeat step 1 and update the secret.

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

## 3. Generate your session, then add it as a GitHub Actions secret

### 3a. Create the session locally

In the project folder:

```bash
npm install
npx playwright install --with-deps chromium
node login.js
```

A real browser window opens at the Claude.ai login page.

1. Enter your email, then the OTP code Claude emails you.
2. Wait until you can see your normal chat screen.
3. Switch back to the terminal and press **Enter**.

This writes `auth.json` (kept out of git by `.gitignore`) and prints a long
**base64 blob** labelled `CLAUDE_AUTH`. Copy the entire blob.

> Easier copy: pipe it to your clipboard instead of scrolling —
> macOS: `base64 -i auth.json | pbcopy`  •  Linux: `base64 -w0 auth.json | xclip -selection clipboard`

### 3b. Add it as a secret

1. In your repository on GitHub, click **Settings** (top menu of the repo).
2. In the left sidebar, expand **Secrets and variables** → click **Actions**.
3. Click **New repository secret** (green button, top right).
4. Fill in:
   - **Name:** `CLAUDE_AUTH`
   - **Secret:** paste the base64 blob
   - Click **Add secret**.

You should now see `CLAUDE_AUTH` under **Repository secrets**. The workflow
decodes it back into `auth.json` at the start of each run.

> CLI alternative: `base64 -i auth.json | gh secret set CLAUDE_AUTH --repo YOUR_USERNAME/claude-automation`

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

After you've created `auth.json` with `node login.js`:

```bash
node index.js
```

A `screenshot.png` will appear in the folder.

---

## Notes & caveats

- **Session expiry:** The saved session is the weak point. It lasts days to weeks, then runs fail with "Session expired — redirected to login". Fix = re-run `node login.js` and update the `CLAUDE_AUTH` secret. There's no way around re-doing the OTP step periodically.
- **Secret = full account access:** `CLAUDE_AUTH` is a live login session. Anyone with it is logged into your account. Keep the repo **private** and never commit `auth.json`.
- **Terms of Service:** Automating claude.ai may conflict with its Terms of Service. Use on an account you own, at your own risk.
- **Selectors may change:** Claude.ai's HTML can change at any time, breaking the composer selector in `index.js`. If runs fail, check the screenshot artifact and update the selectors.
