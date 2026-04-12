# SNS Parking (web)

Mobile-first web client for the same Firestore data as the Android app (`your_collection` / `your_collection1`).

## Local setup

1. Copy `.env.example` → `.env` and set Firebase Web app values (especially `VITE_FIREBASE_APP_ID`).
2. `npm install` then `npm run dev`.

## Sign-in (Firebase Authentication)

The web app uses **Email / password** via Firebase Auth (not the old hardcoded demo).

1. In [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Sign-in method** → enable **Email/Password**.
2. **Authentication** → **Users** → **Add user** — create each staff email and initial password (they can change it via **Forgot password?** on the login screen).
3. Optional: set `VITE_LEGACY_LOGIN=true` in `.env` to bring back the temporary **nirankar / nirankar** demo login while you migrate (not recommended for production).

**Forgot password:** sends a **password reset link** email from Google/Firebase to the address the user enters (standard industry flow). We do **not** email a random password from this app (that would require a custom server and is less secure).

**Suggest strong password:** generates a random password in the browser, fills the field, and copies it to the clipboard — useful when setting a new password after opening the reset link or when updating a user in the Console.

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
