# Growing Seed

Growing Seed is a browser-based faith journey app with authentication, daily actions, progress tracking, and an admin dashboard.

## Live Site

- Production URL: https://endless0014.github.io/Growing-Seed/
- App page: https://endless0014.github.io/Growing-Seed/kingdom-roots/index.html

## Current Frontend Status

- Removed unused QR scanner dependency and related dead code paths.
- Kept authentication, profile, admin dashboard, task actions, and tree progression flows.
- Cache-busted frontend assets are loaded via versioned query strings in the app HTML.

## Release Versioning (Current)

- Web cache tag: `20260315-release-1`
- NPM package version: `1.0.1`
- Android versionCode: `2`
- Android versionName: `1.0.1`

## Future Update Checklist (Web + APK)

1. Update app logic/styles in [kingdom-roots/script.js](kingdom-roots/script.js) and/or [kingdom-roots/style.css](kingdom-roots/style.css).
2. Bump cache-busting query string in [kingdom-roots/index.html](kingdom-roots/index.html) for `style.css` and `script.js`.
3. Update root redirect cache tag in [index.html](index.html).
4. Bump project version in [package.json](package.json).
5. Bump Android release identifiers in [android/app/build.gradle](android/app/build.gradle):
	- `versionCode` must increase every APK release.
	- `versionName` should match your release label (example: `1.0.2`).
6. Sync web assets to Android:
	- `npm run cap:copy`
	- or `npm run cap:sync`
7. Build APK:
	- Debug APK: `npm run android:debug`
	- Release APK (from `android/`): `./gradlew assembleRelease`
8. Validate login/admin/daily-checkin flows before publishing:
	- User login/logout
	- Admin dashboard task toggle/edit
	- FP + daily check-in rollback prevention

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
