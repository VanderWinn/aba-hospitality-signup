# ABA hospitality sign-up

Volunteer sign-up sheet for [Ada Business Association](https://github.com/VanderWinn/aba-hospitality-signup) hospitality jobs: ribbon cuttings, happy hours, and lunch and learns. It replaces the SignUpGenius page "Hospitality Jobs for ABA Board and Ambassadors."

Anyone with the link can sign up. There is no account and no Google sign-in. The page shows names. Email addresses stay in a private Google Sheet.

**Live site:** https://vanderwinn.github.io/aba-hospitality-signup/

Until `js/config.js` has the Apps Script web app URL, that site is a read-only preview of the Nov 17, 2026 export (11 events, 59 tasks, 300 spots, 24 existing sign-ups). Past dates are marked closed.

## What is in this repo

- `index.html`, `css/`, `js/` — the static site GitHub Pages publishes
- `data/seed.json` — the preview data
- `source/signupgenius-2026-11-17.json` — the SignUpGenius export the seed was built from
- `apps-script/Code.gs` and `apps-script/Seed.gs` — the web app bound to the existing spreadsheet
- `SETUP.md` — how to paste the script, run `setup`, deploy it as **Anyone**, and paste the `/exec` URL into `js/config.js`

The spreadsheet already exists (`1wVRyW_PRfB-rgPB716lWkqQraBBnw1lXuPH5o2-4u74`). The script does not create a new one.

## Checks

```bash
node --test test/signup.test.js
```

`node test/mock-server.js` serves the preview. `node test/mock-server.js --live` serves it against a local stand-in for the Apps Script web app.
