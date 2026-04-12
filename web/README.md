# SNS Parking (web)

Mobile-first web client. Live vehicle data uses **`my_new_collection`** / **`my_new_collection_1`** (cloned from the legacy `your_collection` / `your_collection1` used by the Android APK).

## Local setup

1. Copy `.env.example` → `.env` and set Firebase Web app values (especially `VITE_FIREBASE_APP_ID`).
2. `npm install` then `npm run dev`.

### Migrating vehicle data (new collections, legacy Android stops seeing live data)

Do this **before** deploying a build that reads `my_new_collection` / `my_new_collection_1`, or the site will list empty collections until the copy exists. (You can also clone in the Firebase Console instead of this script.)

1. In Firebase Console → **Project settings** → **Service accounts** → **Generate new private key**. Store the JSON safely (do not commit it; `web/.gitignore` ignores common service-account filenames).
2. From `web/`:

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/to/your-service-account.json"
   npm run migrate:vehicles -- --dry-run
   npm run migrate:vehicles
   ```

3. Deploy: `npm run deploy` (updates Hosting + Firestore rules so clients use the new paths).
4. Confirm the web app shows vehicles. When you are sure, delete **`your_collection`** and **`your_collection1`** in the Firestore **Data** tab (optional; until then the old documents still exist but rules no longer grant client access to those paths).

## Sign-in (Firebase Authentication)

### Admin approval (Spark / no paid Cloud Functions)

New staff use **Request access** (email + optional note). A row is added to Firestore `access_requests` (works even if a Firebase session is still open in the browser). Nothing is created in **Authentication** until the **admin** signs in and opens **Manage access** → **Approve**. The app then creates the user with a secondary Firebase client and triggers Firebase’s **password reset email** to that address so they can set a password and sign in.

The admin account is recognized by **Firebase Auth UID** and/or **email** (`sarveshkum9999@gmail.com`):

- `web/src/adminConfig.ts` — `ADMIN_UID` and `ADMIN_EMAIL` (either match shows **Manage access**)
- `web/firestore.rules` — `isParkingAdmin()` checks the same UID **or** that email in the ID token

If **`VITE_LEGACY_LOGIN=true`** in `.env`, the app uses the legacy demo login and **does not** attach a Firebase `User`, so **Manage access** will not appear. Use Firebase sign-in for admin (set `VITE_LEGACY_LOGIN` unset or `false`).

**Staff list:** Approved users are stored under `app_users/{uid}`. **Remove** in Manage access only deletes that Firestore row; to stop sign-in completely, also delete the user under **Firebase Console → Authentication → Users** if needed.

### Firestore rules (required for Request access)

`web/firestore.rules` is deployed with **`npm run deploy`** (Hosting + rules). It allows:

- unauthenticated **create** on `access_requests` (pending requests only),
- **admin-only** read/update on `access_requests`,
- **admin-only** read/write on `app_users`,
- approved staff read/write on the web vehicle collections (see `firestore.rules`).

If you already have custom rules in the console, **merge** these paths into your existing rules instead of overwriting blindly.

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
4. Deploy Hosting + Firestore rules: `npm run deploy` from the `web/` folder

After the first deploy, the app is available at:

- **https://sns-parking-app-blr-d40c7.web.app**
- **https://sns-parking-app-blr-d40c7.firebaseapp.com**

In [Firebase Console](https://console.firebase.google.com/) → your project → **Hosting**, you can add a **custom domain** later.

### Firestore / API access from the hosted URL

- Deploy `web/firestore.rules` with `npm run deploy` (or paste equivalent rules in the console). Android can keep using the same collections if rules match.
- If your **Google Cloud API key** is restricted by HTTP referrer, add  
  `https://sns-parking-app-blr-d40c7.web.app/*` (and `firebaseapp.com` if needed).

## Scripts

| Command        | Purpose                          |
| -------------- | -------------------------------- |
| `npm run dev`  | Local development                |
| `npm run build`| Production build → `dist/`       |
| `npm run deploy` | Build web, then `firebase deploy --only hosting,firestore` |
| `npm run deploy:hosting` | Build web, then `firebase deploy --only hosting` only (skips rules deploy) |
