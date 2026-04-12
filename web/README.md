# SNS Parking (web)

Mobile-first web client for the same Firestore data as the Android app (`your_collection` / `your_collection1`).

## Local setup

1. Copy `.env.example` → `.env` and set Firebase Web app values (especially `VITE_FIREBASE_APP_ID`).
2. `npm install` then `npm run dev`.

## Sign-in (Firebase Authentication)

There is **no built-in username or password** in the app. You create the first (and every) account in the Firebase Console.

### First login — what to use?

1. Open [Firebase Console](https://console.firebase.google.com/) → your project → **Authentication** → **Users** → **Add user**.
2. Enter an **email** (this is only stored in Firebase; staff can still sign in with the **part before `@`** as username if you configure the domain below).
   - Example: create `admin@park.yourorg.com` and set a temporary password.
3. In `web/.env` set **`VITE_LOGIN_EMAIL_DOMAIN=park.yourorg.com`** (same domain as that email, no `@`).
4. On the app login screen: **Username** = `admin` (the part before `@`), **Password** = the password you just set.

Anyone else: add another user the same way (e.g. `mandeep@park.yourorg.com`); they sign in with username **`mandeep`**.

**Optional:** set `VITE_LEGACY_LOGIN=true` for the old fixed **nirankar / nirankar** demo only while migrating.

### One-time setup

1. **Authentication** → **Sign-in method** → enable **Email/Password**.
2. Pick a domain you control so every user email looks like `someone@park.yourorg.com`.
3. Set **`VITE_LOGIN_EMAIL_DOMAIN=park.yourorg.com`** in `web/.env`. Rebuild / redeploy after changes.

**Full email still works:** if someone types a value with `@`, it is used as-is.

### Forgot password (one tap, no extra screens)

Set **`VITE_PASSWORD_RESET_EMAIL`** in `web/.env` to the **exact** email of the Firebase user who should receive reset links (e.g. your main admin). The login page then shows **Forgot password?** only; one click sends Firebase’s reset mail to that address — no modal and no address shown in the UI.

If reset links expire before you click, an **email scanner** may have opened them first; try again from a desktop browser or mark mail as “Not spam”.

**Suggest strong password:** fills the password field and copies a random password to the clipboard.

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
