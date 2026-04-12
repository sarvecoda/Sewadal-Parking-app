# SNS Parking (web)

Mobile-first web client for the same Firestore data as the Android app (`your_collection` / `your_collection1`).

## Local setup

1. Copy `.env.example` → `.env` and set Firebase Web app values (especially `VITE_FIREBASE_APP_ID`).
2. `npm install` then `npm run dev`.

## Sign-in (Firebase Authentication)

### Admin approval (default)

New staff use **Request access** (email + optional note) while **signed out**. Nothing is created in Authentication until the **admin** signs in and opens **Manage access** → approves the request. The admin then copies a **one-time password-reset link** and shares it with the new user (e.g. WhatsApp). That user opens the link, sets a password, and signs in on **Sign in**.

The admin account is fixed in code by **Firebase Auth UID** (and should match `sarveshkum9999@gmail.com` on that account):

- `web/src/adminConfig.ts` — `ADMIN_UID`
- `web/functions/src/index.ts` — same `ADMIN_UID` constant

If you ever change admin user, update **both** files and redeploy **hosting + functions**.

### Cloud Functions (required)

Access requests and approvals use **callable Cloud Functions** in `web/functions/` (Node 20). Deploy them with Hosting:

```bash
cd web && npm run deploy
```

That runs `npm run build` in `web/functions/` then `firebase deploy --only hosting,functions`.

**Billing:** Cloud Functions for Firebase usually require the **Blaze** plan on the Firebase project. If deploy fails, upgrade billing in the Firebase console, then run `npm run deploy` again. Until then you can ship **only** the web app with `npm run deploy:hosting` (approval flows will not work until Functions are deployed).

**Region:** Functions use **`asia-south1`**. The web app uses `getFunctions(..., 'asia-south1')` by default; override with **`VITE_FUNCTIONS_REGION`** in `web/.env` if you change the function region.

### First login — what to use?

1. **Authentication** → **Sign-in method** → enable **Email/Password**.
2. Ensure the **admin** account exists (same UID as `ADMIN_UID` in code) so they can open **Manage access**.
3. **Optional:** add other users manually in the console, or rely entirely on **Request access** + approval.

**Username sign-in (no `@` typed in the app):** the app builds the Firebase email as **`{username}@{domain}`**:

- If **`VITE_LOGIN_EMAIL_DOMAIN`** is set in `web/.env`, `domain` is that value (e.g. `park.yourorg.com` → user `admin` signs in as `admin@park.yourorg.com`).
- If it is **not** set, `domain` defaults to **`VITE_FIREBASE_AUTH_DOMAIN`** from your Firebase Web config (usually `your-project-id.firebaseapp.com`). Example: create the user **`snmparking@sns-parking-app-blr-d40c7.firebaseapp.com`** (replace with your project’s auth domain) so the login username **`snmparking`** works.

Rebuild / redeploy after changing `.env`.

**Full email still works:** if someone types a value with `@` in the username field, it is used as-is.

**Optional:** set `VITE_LEGACY_LOGIN=true` for the old fixed **nirankar / nirankar** demo only while migrating.

### One-time setup (custom domain for emails)

If you prefer addresses like `someone@park.yourorg.com`, set **`VITE_LOGIN_EMAIL_DOMAIN=park.yourorg.com`** in `web/.env` and create Firebase users with that domain.

### Forgot password

**Forgot password?** is always on the login page. It sends Firebase’s reset email to:

- **`VITE_PASSWORD_RESET_EMAIL`** if set in `web/.env` (always that account), or  
- otherwise the account for the **username** you typed above (same mapping as sign-in).

No modal. If Email/Password is disabled in Firebase, sign-in and reset fail until you enable it.

### Point password-reset emails at this app (recommended)

Firebase’s default reset link often hits **inbox link preview / security scanners** first, which uses the one-time code and then shows “expired” or “already been used”.

1. Firebase Console → **Authentication** → **Templates** → **Password reset**.
2. Set **Action URL** / **Customize action URL** to your **Hosting** root, e.g. `https://sns-parking-app-blr-d40c7.web.app/` (must appear under **Authentication** → **Settings** → **Authorized domains**).
3. Save. New reset emails open this web app (`?mode=resetPassword&oobCode=…`) so you choose a new password here.

If you keep the default Firebase reset page, try opening the link from a phone mail app or disable Safelinks / link tracking for that message, then request a **new** reset from the login screen.

**Suggest strong password:** fills the password field and copies a random password to the clipboard.

## Firebase Hosting (same idea as [Book Inventory on web.app](https://book-inventory-app-f1a77.web.app))

This project deploys the **built** `dist/` folder to **Firebase Hosting** in project **`sns-parking-app-blr-d40c7`**.

1. Install deps: `npm install`
2. Ensure `web/.env` exists so `npm run build` embeds your Firebase config (`.env` is not committed).
3. Log in once: `npx firebase login` (use the GitHub/Google account that owns this Firebase project).
4. Deploy (Hosting + Cloud Functions): `npm run deploy` from the `web/` folder

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
| `npm run deploy` | Build web + functions, then `firebase deploy --only hosting,functions` |
| `npm run deploy:hosting` | Build web only, then `firebase deploy --only hosting` (no Cloud Functions) |
