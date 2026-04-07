# Zack Ecommerce

This app now targets the `jacmarskomicecomerce` Firebase project for client-side authentication and Firestore data, while product image uploads are handled through Cloudinary and stored as public URLs.

## Tech Stack

- React + Vite
- Firebase Auth
- Cloud Firestore
- Cloudinary (public image URLs)

## Firebase Environment Variables

The local project is already wired for the current Firebase Web App through [`.env.local`](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/.env.local).

If you ever need to reconfigure it, use:

```env
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="sender-id"
VITE_FIREBASE_APP_ID="app-id"
VITE_PAYMENTS_API_BASE_URL="https://your-backend.example.com" # optional for live M-Pesa STK push
VITE_AI_ASSISTANT_API_URL="http://localhost:8787/api/assistant" # optional if you host the AI server elsewhere
```

## Important Firebase Note

The downloaded `firebase-adminsdk-...json` service account file is for secure backend/admin tasks only. The React frontend cannot use that file directly.

If that service-account key was exposed publicly, rotate or revoke it in Google Cloud before using it anywhere else.

## Firebase Project Files

- [firestore.rules](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/firestore.rules) contains the Firestore access policy.
- [firestore.indexes.json](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/firestore.indexes.json) contains the composite indexes used by orders and related Firestore queries.
- [firebase.json](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/firebase.json) points Firebase CLI to the rules and indexes files.
- [.firebaserc](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/.firebaserc) sets the default Firebase project.
- [scripts/manage-admin.mjs](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/scripts/manage-admin.mjs) grants, revokes, or checks admin access using the Firebase Admin SDK.

To deploy Firestore config with Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## Firestore Collections Used

- `products`
- `orders`
- `user_profiles`
- `login_lookup`

## Registration And Login Model

- Institutions register with `institutionName`, `officialEmail`, `phone`, `poBox`, `county`, `schoolCode`, and password.
- Parent/student users register with `role`, `fullName`, `institutionName`, `phone`, `county`, optional `adminNo`, recovery `email`, and password.
- Firebase Auth signs users in with email/password under the hood.
- Firestore stores the full user profile in `user_profiles`.
- Admin access is role-based through `user_profiles/{uid}.accessRole`.
- The `login_lookup` collection stores hashed identifier lookups so institutions can log in with school code and parent/student users can log in with phone number or admin number.
- Suspended accounts are blocked at the profile/rules layer, and identifier lookups are kept in sync with the user status.
- Admin access is not hard-coded. A user becomes an admin when `accessRole` is set to `admin` in that user's Firestore profile.

## Admin Account Setup

1. Create or register the user account in the app first so the user exists in Firebase Auth.
2. Use the local admin script with your service-account JSON to grant access:

```bash
npm run admin:grant -- --email your-admin@example.com --service-account "C:\\path\\to\\service-account.json"
```

3. To verify access:

```bash
npm run admin:check -- --email your-admin@example.com --service-account "C:\\path\\to\\service-account.json"
```

4. To revoke access later:

```bash
npm run admin:revoke -- --email your-admin@example.com --service-account "C:\\path\\to\\service-account.json"
```

5. If Firebase is not delivering password reset emails, generate a direct reset link:

```bash
npm run admin:reset-link -- --email your-admin@example.com --service-account "C:\\path\\to\\service-account.json"
```

You can also use `--uid FIREBASE_UID` instead of `--email`, or set `FIREBASE_SERVICE_ACCOUNT_PATH` as an environment variable.

If you want to switch admins manually later, update `user_profiles/{uid}.accessRole` in Firestore:

```json
{
  "accessRole": "admin"
}
```

Use `"customer"` to remove admin access.

## Admin Capabilities Implemented

- Product create, edit, and delete
- User profile registration and admin-side user status management
- Multi-image product gallery support via Cloudinary URLs
- Featured product control for homepage sections
- Order viewing and status updates (`pending`, `paid`, `processing`, `delivered`, `cancelled`)
- Basic customer insights from order history

## AI Assistant

- The floating assistant replaces the old support chat widget.
- It uses live product data, current cart contents, and signed-in order history to answer store questions instantly.
- It works for guests and logged-in users, with extra order tracking help available after login.
- It now supports a real OpenAI-backed mode through a local Node server in [server/ai-assistant-server.mjs](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/server/ai-assistant-server.mjs).
- The OpenAI API key stays server-side and is never exposed in the frontend bundle.

### OpenAI Setup

1. Set these environment variables before starting the AI server:

```powershell
$env:OPENAI_API_KEY="your-openai-api-key"
$env:OPENAI_MODEL="gpt-5.4"
$env:OPENAI_REASONING_EFFORT="medium"
```

2. Start the AI server in one terminal:

```bash
npm run ai:server
```

3. Start the frontend in another terminal:

```bash
npm run dev
```

4. In local development, Vite proxies `/api/assistant` to `http://localhost:8787`.

If the OpenAI-backed service is unavailable, the widget falls back to offline store-assistant mode so the UI still works.

## Product Shape (recommended)

```json
{
  "name": "A4 Printing Paper",
  "description": "500 sheets, 80gsm",
  "price": 250,
  "stock": 100,
  "category": "Stationery",
  "featured": true,
  "image_url": "https://res.cloudinary.com/...",
  "images": ["https://res.cloudinary.com/..."],
  "created_at": "serverTimestamp"
}
```

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The project build script uses a stable local Vite Node API wrapper in [scripts/build-client.mjs](C:/Users/ME/Desktop/Institutional%20supply%20kit%20and%20products/scripts/build-client.mjs) because the default Vite 8 Rolldown path was hitting out-of-memory failures in this environment.

## Operational Notes

- Product images are expected to be public Cloudinary URLs.
- Client-side product stock deduction was intentionally removed for security. If you want stock decremented atomically after payment, do that in a trusted backend or Cloud Function.
- Live M-Pesa STK push still depends on your external payments backend configured by `VITE_PAYMENTS_API_BASE_URL`.
