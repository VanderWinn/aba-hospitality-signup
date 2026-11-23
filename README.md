# ABA hospitality sign-up

Volunteer sign-up sheet for [Ada Business Association](https://github.com/VanderWinn/aba-hospitality-signup) hospitality jobs: ribbon cuttings, happy hours, and lunch and learns. It replaces the SignUpGenius page "Hospitality Jobs for ABA Board and Ambassadors."

Anyone with the link can sign up. There is no account and no Google sign-in. The page shows names. Email addresses stay in a private Google Sheet.

**Site:** https://vanderwinn.github.io/aba-hospitality-signup/

The page loads the live sheet from the Apps Script web app. Past dates are marked closed. `data/seed.json` remains the Nov 17, 2026 copy (11 events, 59 tasks, 300 spots, 24 sign-ups) and is what the page shows if that web app cannot be reached.

Version 2 adds confirmation and reminder email, calendar files, and a private change/cancel link. The event header can add the whole event to Apple Calendar on an iPhone, the confirmation email attaches invite.ics, and a volunteer can click their name to cancel with the email they used. The spreadsheet stores sign-up rows only. Event capacities stay in `apps-script/Seed.gs`. See **Upgrading to v2** in `SETUP.md`. Until that script version is deployed, this page still reads and accepts sign-ups from the current web app.

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
