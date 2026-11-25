# ABA hospitality sign-up

Volunteer sign-up sheet for [Ada Business Association](https://github.com/VanderWinn/aba-hospitality-signup) hospitality jobs: ribbon cuttings, happy hours, and lunch and learns. It replaces the SignUpGenius page "Hospitality Jobs for ABA Board and Ambassadors."

Anyone with the link can sign up. There is no account and no Google sign-in. The page shows names. Email addresses stay in a private Google Sheet.

**Site:** https://vanderwinn.github.io/aba-hospitality-signup/

The page loads the live sheet from the Apps Script web app. Past dates are marked closed. `data/seed.json` remains the Nov 17, 2026 copy (11 events, 59 tasks, 300 spots, 24 sign-ups) and is what the page shows if that web app cannot be reached.

Version 2 adds confirmation and reminder email, calendar files, and a private change/cancel link. The event header can add the whole event to Apple Calendar on an iPhone, the confirmation email attaches invite.ics, and a volunteer can click their name to cancel with the email they used. The spreadsheet stores sign-up rows only. Event capacities stay in `apps-script/Seed.gs`. See **Upgrading to v2** in `SETUP.md`. Until that script version is deployed, this page still reads and accepts sign-ups from the current web app.

## What is in this repo

- `index.html`, `css/`, `js/` — the static site GitHub Pages publishes
- `home/` — the password-gated board portal. `home/dashboard.html` is the membership and events dashboard
- `data/seed.json` — the preview data
- `source/signupgenius-2026-11-17.json` — the SignUpGenius export the seed was built from
- `apps-script/Code.gs` and `apps-script/Seed.gs` — the web app bound to the existing spreadsheet
- `SETUP.md` — how to paste the script, run `setup`, deploy it as **Anyone**, and paste the `/exec` URL into `js/config.js`

The spreadsheet already exists (`1wVRyW_PRfB-rgPB716lWkqQraBBnw1lXuPH5o2-4u74`). The script does not create a new one.

## Membership and events dashboard

`home/dashboard.html` is a separate page from the portal home. It is the Concept 2b board view: member total, new members, net gain, gains versus losses, events held, attendance, and attendance by member or guest.

The portal home links to it only after a board member enters the portal password. Opening `home/dashboard.html` with no portal session returns to the portal login (`home/index.html?next=dashboard`). After a correct password, that login continues to the dashboard. The public sign-up page does not link here.

The page checks the same session the portal stores and the same SHA-256 hash in `home/portal.json` (`PORTAL_PASSWORD_SHA256` on the script). It does not read a plaintext password from the repo.

While the figures are the example set, an **Example data** badge stays visible.

### Data adapter

Every number on the page comes from `js/dashboard-data.js`. The page calls `loadExecutiveSource()`. Today that returns the placeholder records in the same file. `fromSheetTabs()` is the seam for the Google Sheet: it accepts tab arrays and returns the normalized model below. `js/dashboard-model.js` only reads that model. Swapping in the sheet means changing `loadExecutiveSource()` and nothing else on the page.

Normalized model:

| Field | Meaning |
| --- | --- |
| `example` | `true` shows the Example data badge. A live sheet sets this to `false`. |
| `asOf` | `YYYY-MM-DD` anchor for Year, Quarter, Month, and Last 12 months. The placeholder is `2026-11-24`, the date of the approved sketch. A live source should use today's date in America/Detroit. |
| `events` | `{ id, date, type }`. `type` is `Lunch & Learn`, `Ribbon Cutting`, or `Happy Hour`. |
| `attendance` | `{ eventId, audience, count }`. `audience` is `Member` or `Guest`. `count` is a number of people, not a list of people. |
| `openings` | `{ date, audience, eventType, count }`. Member or guest total at that date, before later changes. |
| `changes` | `{ date, audience, eventType, joins, losses }`. People who joined or left that day. |

`fromSheetTabs()` drops columns named email, phone, mobile, name, attendee, or first or last name. Do not put those columns on these tabs. Names on the existing hospitality dashboard still come only from the password-checked `dashboard` POST. This page does not request or render them.

With no pie slice selected, the membership cards use the Member roster. Attendance and events use everyone. Clicking **Members** or **Guests** limits the whole page, including the membership cards, to that audience. Click the slice again to clear it. **Reset filters** also clears it, and returns the current year, the Year period, and all event types.

Year, Quarter, and Month follow the Year control. In the current year they run through `asOf`. In a past year, Year is the full calendar year, and Quarter and Month run through the end of that quarter or month (the quarter and month that contain `asOf`). Last 12 months is the trailing 12 months ending on `asOf`, from the first day of the month 11 months earlier, and it ignores the Year control. Charts use months for Year and Last 12 months, weeks for Quarter, and days for Month. Comparisons are the same number of days, ending one month, one quarter, or one year earlier.

### Sheet tabs to add later

Use the spreadsheet this site already uses. Add tabs, do not put emails, phones, or people's names on them.

**Events**

| Column | Required | Notes |
| --- | --- | --- |
| `date` | yes | `YYYY-MM-DD` |
| `event_id` | yes | Stable id, used by Attendance |
| `event_type` | yes | `Lunch & Learn`, `Ribbon Cutting`, or `Happy Hour` |
| `event_name` | no | Title of the event only. The dashboard does not read this column today |

**Attendance**

| Column | Required | Notes |
| --- | --- | --- |
| `event_id` | yes | Matches Events |
| `audience` | yes | `Member` or `Guest` |
| `count` | yes | How many people in that audience at that event |

**Membership**

| Column | Required | Notes |
| --- | --- | --- |
| `date` | yes | `YYYY-MM-DD` |
| `audience` | yes | `Member` or `Guest` |
| `event_type` | yes | Same three event types. All types together are the unfiltered cards |
| `joins` | yes | People who joined that day |
| `losses` | yes | People who left that day. What counts as left (a lapse, a non-renewal, or a removal) is still open |

**MembershipOpening**

| Column | Required | Notes |
| --- | --- | --- |
| `as_of` | yes | Date this balance is true |
| `audience` | yes | `Member` or `Guest` |
| `event_type` | yes | Same three event types |
| `count` | yes | Total at `as_of`, before Membership rows after that date |

Guest rows are what the Guests slice uses for the membership cards. The sheet Donny receives still needs a real rule for who counts as a guest member. Until then the placeholder carries an example guest ledger.

### Apps Script

This page does not need an Apps Script change. The placeholder never calls the web app.

When the sheet above exists, connect it like this:

1. In the Apps Script project bound to the existing spreadsheet, add an `executiveDashboard` action beside `dashboard`. It must check `PORTAL_PASSWORD_SHA256` the same way `dashboardAction_` does. On a wrong or missing password, return `{ ok: false, status: 401 }` and no rows.
2. Read only the columns in the tabs above. Return the normalized model (`events`, `attendance`, `openings`, `changes`, `asOf`, `example: false`). Do not return emails, phones, or names.
3. Publish that script: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The web app URL stays the same, so `js/config.js` does not change.
4. Change `loadExecutiveSource()` in `js/dashboard-data.js` so it POSTs `{ action: 'executiveDashboard', password }` as `text/plain`, the same way `js/portal-page.js` posts `{ action: 'dashboard', password }`, then passes the JSON through `fromSheetTabs()` or `normalize()`. No other page needs an edit.

## Checks

```bash
node --test test/signup.test.js
node --test test/executive-dashboard.test.js
```

`node test/mock-server.js` serves the preview. `node test/mock-server.js --live` serves it against a local stand-in for the Apps Script web app.
