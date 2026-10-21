# Admin Panel — Setup Guide (about 15 minutes, free)

Your portfolio stays a normal static website. Content you manage in the Admin Panel
is stored in **Supabase** (a free hosted database + login + file storage) and loaded
into your pages. If Supabase is ever unreachable, your site simply shows its built-in content.

## 1. Create the Supabase project
1. Go to https://supabase.com → sign up (free) → **New project**.
2. Choose a name, a strong database password (save it somewhere), and the region nearest you.
3. Wait ~2 minutes until the project is ready.

## 2. Create YOUR admin login
1. Left menu → **Authentication → Users → Add user → Create new user**.
2. Email: `dillishankar.k30@gmail.com` (use another email? change it in `supabase/schema.sql`, function `_admin_email`).
3. Choose a **long, unique password** (a password manager is ideal). Tick **Auto Confirm User**.

## 3. Turn off public sign-ups (important)
**Authentication → Sign In / Providers → Email** (or *Settings*): switch **off** “Allow new users to sign up”.
This guarantees nobody else can ever create an account.

## 4. Create the tables and security rules
1. Left menu → **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this project, copy everything, paste, click **Run**.
3. You should see “Success”. It also fills in your CURRENT portfolio content, so nothing changes on your site.
   If you see a notice “NO ADMIN YET”, you skipped step 2 — create the user, then run the file again.
   (Running it again is always safe; it never deletes your data.)

## 5. Connect the website
1. **Project Settings → API** → copy **Project URL** and the **anon public** key.
2. Open `js/supabase-config.js` and paste them in. Do NOT use the `service_role` key — it must never be in website code.
3. Upload/deploy the project as usual.

## 6. Sign in
Click the 🔒 lock icon on your site (or open `/admin/index.html`) and sign in.

## What you can manage
Dashboard · Availability · About me · Projects · Certificates · Skills · Resume · Profile (email, WhatsApp, GitHub, LinkedIn) · Contact messages.

## Security notes
* Passwords are handled by Supabase Auth — they are never stored in your code.
* The database itself (Row Level Security) allows ONLY your account to add/edit/delete anything and to read messages. Visitors can read public content and send a message, nothing else.
* The anon key in `js/supabase-config.js` is public by design and safe to publish.
* The admin page signs you out after 30 minutes of inactivity. Use **Sign out** on shared computers.
* Optional extras in Supabase: enable **MFA** for your account, and under *Authentication → Rate limits* keep the defaults.
* The admin page asks search engines not to index it, but its safety comes from the login + database rules, not from hiding it.

## Contact messages
The only form on your site is the footer “Stay Updated” email box. Each submission appears in **Messages** (email + time).
A form with name + message fields would need a small design addition — ask if you want it.

## Good to know
* Uploaded photos are shrunk to a web-friendly size and saved as WebP automatically; PDFs and SVGs are stored as-is.
* The Free plan pauses projects after 1 week of **no** activity at all; a visit to the dashboard wakes it. Regular traffic keeps it awake.
* Back up: Supabase **Database → Backups** (daily on paid plans) or export tables as CSV from **Table Editor**.
