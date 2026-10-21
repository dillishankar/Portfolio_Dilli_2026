# Portfolio – Dilli Shankar K

Static, single-page portfolio (HTML + CSS + vanilla JS, Bootstrap 5 via CDN). No build step.

## Run locally
Open `index.html` in a browser, or serve the folder (matches `.vscode/launch.json`, port 8080):

    python -m http.server 8080

Needs an internet connection for the CDN files (Bootstrap, Bootstrap Icons, Google Fonts, Devicon).

## Admin Panel (dynamic content)
The 🔒 lock icon opens `admin/index.html`. Follow `SETUP_ADMIN.md` once to connect it (free Supabase account).
Until then the site works exactly as before with its built-in content.

## Structure
    index.html
    admin/    index.html (admin panel page)
    css/      style.css (global, nav, hero, experience, footer)
              about.css, projects.css, certificates.css, website-transition.css, cursor.css, admin.css
              hero.css  (NOT linked anywhere; its rules already live in style.css – safe to delete)
    js/       script.js, projects.js, certificates.js, website-transition.js, cursor.js,
              dynamic.js (loads admin-managed content), supabase-config.js (your keys), admin.js
    supabase/ schema.sql (database + security rules — run once in Supabase)
    assets/   images/ (logo, portraits, projects/, certificate/), icons/ (Excel, Power BI)
              Dillishankar.k-DA-Resume.pdf

Use lowercase, exact-case paths: GitHub Pages and most servers are case-sensitive.
