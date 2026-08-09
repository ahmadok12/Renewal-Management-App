# Renewal Reminder App V1

An installable renewal and expiry tracker built for GitHub Pages + Supabase. It includes per-user login, secure cloud storage, repeatable reminder rules, renewal history, calendar, family/business assignment, cost visibility, responsive mobile UI, and PWA installation.

## Updating an existing installation

This is the V1.1 visual update. Upload the contents of this package over the existing repository files and commit the changes. Keep your existing GitHub variables and Supabase project unchanged. GitHub Actions will redeploy automatically, and the updated service-worker cache will replace the older interface after the app is reopened or refreshed.

V1.1 introduces a warm smart-control design, substantially larger typography, larger touch targets, rounded modular cards, proper switches for binary settings, and a mobile calendar that scrolls inside its own panel without widening the page. No database migration is required.

## 1. Create the Supabase database

1. Create a project at https://supabase.com/dashboard.
2. Open **SQL Editor → New query**.
3. Copy the complete contents of `supabase-schema.sql`, paste it, and click **Run**.
4. Open **Authentication → Providers → Email** and enable email/password login.
5. For private testing, you may temporarily disable email confirmation. Enable it before a public launch.
6. Open **Project Settings → API Keys** and copy the project URL and the `sb_publishable_...` key.

The schema enables Row Level Security. Each signed-in user can only read and change their own records. Never add a secret key or service-role key to this project.

## 2. Test locally (optional)

1. Duplicate `.env.example` and name the copy `.env`.
2. Replace the two placeholder values with your Supabase project URL and publishable key.
3. Run:

```bash
npm install
npm run dev
```

## 3. Upload to GitHub

1. Create a new GitHub repository, for example `renewal-reminder-app`.
2. Upload every file and folder from this package to the repository root.
3. In the repository, open **Settings → Secrets and variables → Actions → Variables**.
4. Create these repository variables:

   - `VITE_SUPABASE_URL` — your `https://...supabase.co` project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — your `sb_publishable_...` key

5. Open **Settings → Pages** and choose **Source: GitHub Actions**.
6. Open the **Actions** tab. The `Deploy to GitHub Pages` workflow runs automatically after upload.
7. When it is green, open **Settings → Pages** to find the live URL.

## 4. Connect the live URL to Supabase Auth

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to your exact GitHub Pages URL, including the repository path.
3. Add the same URL with `/**` at the end under **Redirect URLs**.
4. Save.

Example:

```text
Site URL:      https://YOUR-USERNAME.github.io/renewal-reminder-app/
Redirect URL:  https://YOUR-USERNAME.github.io/renewal-reminder-app/**
```

## 5. Verify the deployment

1. Create an account and sign in.
2. Add an item with at least two reminder rules.
3. Reload and confirm the item remains.
4. Mark it renewed and confirm the next date changes.
5. Delete a test item.
6. Sign out and confirm records are hidden.
7. Sign in on a second device and confirm the same records appear.
8. In Supabase **Table Editor**, verify rows exist in `renewal_items` and `renewal_events`.
9. In **Database → Security Advisor**, confirm there are no missing-RLS warnings for these tables.

## Install on a phone

### Android

Open the live URL in Chrome → menu → **Add to Home screen** or **Install app**.

### iPhone/iPad

Open the live URL in Safari → Share → **Add to Home Screen**. iOS does not show the same browser install prompt as Android.

## Native iOS and Android later

This V1 is structured as a PWA and can later be wrapped with Capacitor without replacing Supabase or the application UI. App Store and Play Store packaging, native push notifications, deep links, biometric login, privacy/support pages, and store assets belong in the next mobile release.

## Important V1 limitation

The app stores reminder schedules, but automatic email and push delivery is not included yet. Reliable alerts when the browser is closed require a scheduled backend job and notification service.
