# Growing Seed

Growing Seed is a browser-based faith journey app with authentication, daily actions, progress tracking, and an admin dashboard.

## Live Site

- Production URL: https://endless0014.github.io/Growing-Seed/
- App page: https://endless0014.github.io/Growing-Seed/kingdom-roots/index.html

## Current Frontend Status

- Removed unused QR scanner dependency and related dead code paths.
- Kept authentication, profile, admin dashboard, task actions, and tree progression flows.
- Cache-busted frontend assets are loaded via versioned query strings in the app HTML.

## MySQL Transfer Preparation (Retained)

The project intentionally keeps MySQL migration prep for a later backend transfer.

- Schema file retained: [database/mysql_schema.sql](database/mysql_schema.sql)
- Existing client-side storage/cloud sync logic is still present for current runtime behavior.
- Future backend migration should map user/session/task-completion data to the schema above.

## Project Structure

- App frontend: [kingdom-roots/index.html](kingdom-roots/index.html), [kingdom-roots/script.js](kingdom-roots/script.js), [kingdom-roots/style.css](kingdom-roots/style.css)
- Database prep: [database/mysql_schema.sql](database/mysql_schema.sql)
- Data and experiments: [data](data), [notebooks](notebooks)

## Local Run

From repository root:

1. Start static server: `python -m http.server 8000`
2. Open: `http://localhost:8000/kingdom-roots/index.html`
