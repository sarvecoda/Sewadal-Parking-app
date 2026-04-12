# SNS Parking (web)

Mobile-first web client for the same Firestore data as the Android app (`your_collection` / `your_collection1`).

## Local setup

1. Copy `.env.example` → `.env` and set Firebase Web app values (especially `VITE_FIREBASE_APP_ID`).
2. `npm install` then `npm run dev`.

## Sign-in (Firebase Authentication)

The web app uses **Firebase Email / password**. On the login screen staff type a **username** (not your personal Gmail). Behind the scenes that becomes `username@YOUR_DOMAIN` — you choose `YOUR_DOMAIN` and create matching users in Firebase.

### One-time setup

1. **Authentication** → **Sign-in method** → enable **Email/Password**.
2. Pick a domain you control (or a single shared mailbox pattern), e.g. `park.yourorg.com` with Google Workspace / DNS, or another hoster. Each worker is a Firebase user like `mandeep@park.yourorg.com` (local part = what they type as **username**).
3. In `web/.env` set **`VITE_LOGIN_EMAIL_DOMAIN=park.yourorg.com`** (no `@`). Rebuild / redeploy after changing env.
4. Optional: set `VITE_LEGACY_LOGIN=true` for the old **nirankar / nirankar** demo only while migrating.

**Full email still works:** if someone types an address with `@`, it is used as-is (for admins).

### Forgot password

- No email is shown on screen. **Forgot password?** uses the **username** already typed on the sign-in form and sends Firebase’s reset mail to the address on file for that account.
- **Reset link “expired / already used” right away:** often an **email scanner** opened the link before you (one-time links). Try **Resend link**, wait a minute, open from **desktop Gmail in a browser**, or **“Open in Safari/Chrome”** instead of an in-app webview. Avoid preview panes that fetch URLs.
- **Spam:** ask users to **“Not spam”** / add the sender to contacts. For a custom domain, set up **SPF/DKIM** for that domain in Google Workspace or your DNS host so Google trusts the mail more.

**Suggest strong password:** fills the password field and copies a random password to the clipboard (for use after the reset link or when editing a user in the Console).

## Firebase Hosting (same idea as [Book Inventory on web.app](https://book-inventory-app-f1a77.web.app))

This project deploys the **built** `dist/` folder to **Firebase Hosting** in project **`sns-parking-app-blr-d40c7`**.

1. Install deps: `npm install`
2. Ensure `web/.env` exists so `npm run build` embeds your Firebase config (`.env` is not committed).
3. Log in once: `npx firebase login` (use the GitHub/Google account that owns this Firebase project).
4. Deploy: `npm run deploy`

After the first deploy, the app is available at:

- **https://sns-parking-app-blr-d40c7.web.app**
- **https://sns-parking-app-blr-d40c7.firebaseapp.com**

In [Firebase Console](https://console.firebase.google.com/) → your project → **Hosting**, you can add a **custom domain** later.

### Firestore / API access from the hosted URL

- In **Firestore → Rules**, allow access from this web client the same way you do for Android (or tighten with auth later).
- If your **Google Cloud API key** is restricted by HTTP referrer, add  
  `https://sns-parking-app-blr-d40c7.web.app/*` (and `firebaseapp.com` if needed).

## Scripts

| Command        | Purpose                          |
| -------------- | -------------------------------- |
| `npm run dev`  | Local development                |
| `npm run build`| Production build → `dist/`       |
| `npm run deploy` | Build + `firebase deploy --only hosting` |
