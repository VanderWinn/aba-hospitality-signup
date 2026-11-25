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
| `asOf` | `YYYY-MM-DD` anchor for the fiscal year, Quarter, Month, and Last 12 months. The placeholder is `2026-11-24`, the date of the approved sketch, which falls in FY2027. A live source should use today's date in America/Detroit. |
| `events` | `{ id, date, type }`. `type` is `Lunch & Learn`, `Ribbon Cutting`, or `Happy Hour`. |
| `attendance` | `{ eventId, audience, count }`. `audience` is `Member` or `Guest`. `count` is a number of people, not a list of people. |
| `openings` | `{ date, audience, eventType, count }`. Member or guest total at that date, before later changes. |
| `changes` | `{ date, audience, eventType, joins, losses }`. People who joined or left that day. |

`fromSheetTabs()` drops columns named email, phone, mobile, name, attendee, or first or last name. Do not put those columns on these tabs. Names on the existing hospitality dashboard still come only from the password-checked `dashboard` POST. This page does not request or render them.

With no pie slice selected, the membership cards use the Member roster. Attendance and events use everyone. Clicking **Members** or **Guests** limits the whole page, including the membership cards, to that audience. Click the slice again to clear it. **Reset filters** also clears it, and returns the current fiscal year to date, Year grouping, and all event types.

Dates drive every total. The year is ABA's fiscal year, July 1 through June 30, named for the year it ends. FY2026 is July 1, 2025 through June 30, 2026. With `asOf` of November 24, 2026, the current year is FY2027, July 1, 2026 through June 30, 2027, and the default Dates range is that year to date: July 1, 2026 through November 24, 2026. A past fiscal year uses the full July 1 through June 30. **Last 12 months** stays the trailing 12 months ending on `asOf`, from the first day of the month 11 months earlier, and ignores the Year control. From and To override either preset. After a custom range is picked, Year, Quarter, and Month do not put the preset dates back. They only change how **Membership Gains V Losses** is grouped inside those dates. Reset, or choosing Last 12 months, clears a custom range. Reset returns to the current fiscal year to date.

Year, Quarter, and Month group that bar chart only:

- **Year** is one bar for each fiscal year in the date range, labeled FY2027 and so on.
- **Quarter** is the fiscal quarters the range covers: Q1 July–September, Q2 October–December, Q3 January–March, Q4 April–June.
- **Month** is one bar per month. A full fiscal year runs J A S O N D J F M A M J, July through June.
- **Last 12 months** sets the trailing range and groups that chart by month. That keeps one control for "the last 12 months, by month" instead of a separate grouping switch.

The events and attendance lines stay month by month for the selected dates, in that same July-through-June order when the range is a fiscal year. They do not follow the Year or Quarter grouping. Last month and last quarter are the same number of days, ending one month or one quarter earlier. Last year is the same dates in the prior fiscal year.

**Open** on a card, or the big number, lists the records behind that total. The list uses the same Year, Period, Dates, event types, companies, people, name search, and Members or Guests choice. Back returns to the dashboard with those filters still set. Reset clears every filter, and an open list refreshes to the unfiltered records.

On the left, under Event type, **Company** then **Person** are separate multi-select lists. Each has Select all, Clear all, checkboxes, and a type-to-filter box. Enter in that box checks the first match. Select all, while a filter is typed, adds only the visible matches. Choices inside one list combine with OR. Event type, company, person, and a name search combine with AND. The person list shows only people at the selected companies. Removing a company removes its people from the person selection. Guests can belong to a company that is not a member company; those companies are not in the Company list.

The top bar order is Year, Period, Dates, Search, Reset. Search suggests people and companies. Choosing a suggestion adds that person or company to the left-rail selection. Enter on text that you do not pick applies a case-insensitive “name contains” match. On a phone the search field is full width at the top of the filter area.

Placeholder mode uses about ten obviously fake companies and fake people. Attendance emails end in `@example.com` and phone numbers start with `555`. Those contact fields are not on the summary cards. They appear only in the attendance drill-down, which also shows any extra field on the record, such as `notes`.

The attendance drill-down shows contact information to anyone who has the portal password. Real names, emails, and phone numbers must come from the password-checked `executiveDrilldown` POST when the list opens. They are not stored in this repo, in static JavaScript, or in `localStorage`. The placeholder page does not call that endpoint.

`fromSheetTabs()` still drops email, phone, and name from the headline tabs. It keeps them on `attendanceRecords` only.

**Members** (member companies for the Company list; not guest companies)

| Column | Required | Notes |
| --- | --- | --- |
| `company_name` | yes | One member company per row, shown in the Company list |

**AttendanceRecords** (one person per visit; used when a drill-down opens)

| Column | Required | Notes |
| --- | --- | --- |
| `name` | yes | The attendee, not a company total |
| `member_or_guest` | yes | `Member` or `Guest` |
| `event` | yes | Event name |
| `date` | yes | `YYYY-MM-DD` |
| `email` | no | Shown only in this drill-down |
| `phone` | no | Shown only in this drill-down |
| `company` | no | Matched by the Company filter. A guest company that is not on Members stays off the Company list |
| any other column | no | Shown automatically as its own column |

### Apps Script for the drill-down

No deployment yet. The page still uses placeholder data. When the sheet is ready:

1. Add the Members and AttendanceRecords tabs above. Do not put those columns on the public sign-up tabs.
2. The repo already has `executiveDrilldownAction_` and routes `action: 'executiveDrilldown'`. It checks `PORTAL_PASSWORD_SHA256` the same way as the portal dashboard. A wrong password returns status 401 and no rows.
3. Publish it only when you want it live: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The `/exec` URL stays the same.
4. Point the drill-down loader at that POST. Send `{ action: 'executiveDrilldown', password }` as `text/plain` when the list opens, then pass the JSON through `fromSheetTabs()`. Do not send the records on the first dashboard load.

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
| `losses` | yes | People who left that day. What counts as left (a lapse, a non-renewal, or a removal) is still open. Losses taken from the Deactivated tab are dated `2026-06-30`, the last day of FY2026 |

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
