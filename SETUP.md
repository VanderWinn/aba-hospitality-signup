# Connect the sign-up form

The page on GitHub Pages already shows every event. Sign-up stays off until you paste the web app URL into `js/config.js`. Use the spreadsheet that is already in the Ada Business Association folder. Do not create a new one.

Spreadsheet: https://docs.google.com/spreadsheets/d/1wVRyW_PRfB-rgPB716lWkqQraBBnw1lXuPH5o2-4u74/edit

Keep that spreadsheet private. It will store email addresses. The public page shows names only. The web app reads and writes the sheet as you, so visitors do not need access to the file.

## 1. Paste the script

1. Open the spreadsheet link above.
2. Choose **Extensions → Apps Script**.
3. Open `apps-script/Code.gs` in this repo. Select all of it, copy it, and paste it over everything in the Apps Script file named `Code.gs`. Save.
4. In the Apps Script file list, click **+** and choose **Script**. Name the file `Seed`.
5. Open `apps-script/Seed.gs` in this repo. Paste the entire file into `Seed.gs`. Save.

## 2. Seed the sheet

1. In the function dropdown at the top of the editor, choose **setup**.
2. Click **Run**.
3. When Google asks for permission, choose the account that owns the spreadsheet and click **Allow**.
4. When it finishes, you should see: `Setup complete. 59 tasks and 24 existing sign-ups were written to this spreadsheet.`
5. Return to the spreadsheet. Confirm a **Slots** tab (59 tasks) and a **Signups** tab (24 rows). The empty **Sheet1** tab is removed.

Run **setup** only once. If those tabs already have rows, it stops so it does not duplicate them.

## 3. Deploy the web app

1. Click **Deploy → New deployment**.
2. Click the gear next to **Select type** and choose **Web app**.
3. Description: `ABA hospitality signup`
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Click **Deploy**. Authorize again if Google asks.
7. Copy the **Web app** URL. It ends in `/exec`. Do not use the URL that ends in `/dev`.

## 4. Point the website at that URL

1. Open `js/config.js` in this repo.
2. Paste the `/exec` URL between the quotes:

```javascript
window.ABA_CONFIG = {
  backendUrl: "https://script.google.com/macros/s/PASTE_THE_ID/exec"
};
```

3. Commit that change and push it to `main`.

GitHub Pages republishes from `main`. After a minute, reload the site. The preview banner is gone and each open spot has a **Sign up** button. Add yourself to a test task, confirm your name appears on the page, confirm your email does not, and confirm the new row is on the **Signups** tab. Delete that test row if you do not want to keep it.

## Later edits

If you change `Code.gs` or `Seed.gs`: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The web app URL stays the same, so `js/config.js` does not need another edit.

The page sends `POST` requests as `text/plain` so browsers on GitHub Pages can reach the web app without a CORS preflight, and it follows the redirect Apps Script returns.

## Upgrading to v2

The live sheet already has sign-ups. Do not run `setup` again. The website keeps working with the current web app until you publish a new version: the public grid still loads, and a change/cancel link shows a short notice instead of failing the rest of the page.

Capacities live in `apps-script/Seed.gs`, which the script reads. The spreadsheet only stores people who signed up. Each sign-up row includes a Capacity number for that task. The page counts active rows against the list in the script.

Run these once, in this order:

1. In the spreadsheet, choose **Extensions → Apps Script**.
2. Replace all of `Code.gs` with `apps-script/Code.gs` from this repo. Save.
3. Click **+ → Script**, name the file `Mail`, and paste `apps-script/Mail.gs`. Leave `Seed.gs` as it is. Save.
4. Choose the function **migrateV2** and click **Run**. Approve the spreadsheet permission if Google asks. You should see: `Migration complete. Kept 24 sign-up rows.` plus how many capacities and tokens were filled, and that the Slots tab was removed. Every existing name and email stays. Empty tasks are no longer rows. Running `migrateV2` again only fills blanks.
5. Choose **installTriggers** and click **Run**. Approve sending email and managing triggers. You should see that the daily reminder is installed. Running it again does not add a second trigger.
6. Click **Deploy → Manage deployments → pencil icon**. Set **Version** to **New version**. Click **Deploy**. The `/exec` URL stays the same, so `js/config.js` does not change.

After that, a new sign-up emails the participant from the deploying account, with the display name Ada Business Association and reply-to donny@vanderwinn.com. The message includes the event, date, time, task, and location, a plain-text copy, an `.ics` file, and an Add to Google Calendar link. The private change/cancel link is `https://vanderwinn.github.io/aba-hospitality-signup/?manage=` plus that row's token. Seed rows have no email, so they are not emailed.

Reminder rule: around 9:00 AM Eastern, the script emails each active sign-up that has an email when the event date is exactly two Eastern calendar days away, and only if that row has not already been reminded. A move clears the reminder mark so the new date can get its own reminder. Cancelled rows are skipped and no longer fill a spot.

Calendar rule: a time such as 4:30 PM is a 2-hour event in America/New_York, because the list has no end time. A task with no clock time is an all-day event. Every current event has a time.

To change how many spots a task has, edit that role in `apps-script/Templates.gs`, paste the updated file, and deploy a new version. The Capacity column on a sign-up row is a copy for the sheet; the script enforces the number in the template. To add a future event, append one object to `abaEvents()` in that file.

## Upgrading to v3

The website keeps working with the current script until you publish a new version. Open spots can still be claimed. Role times and the new task names appear after the new version is deployed.

Run these once, in this order. Do not run `setup` or `migrateV2` again.

1. In the spreadsheet, choose **Extensions → Apps Script**.
2. Replace `Code.gs` with `apps-script/Code.gs`. Replace `Mail.gs` with `apps-script/Mail.gs`.
3. Click **+ → Script**, name the file `Templates`, and paste `apps-script/Templates.gs`. Leave `Seed.gs` as it is. Save.
4. Choose **migrateV3** and click **Run**. It keeps every sign-up row, stores the old task name in `oldTask`, and points recognized rows at the new roles. `Ambassadors - Full lunch` rows are marked `needs-review` and stay off the public grid. Running it again does not remap a row that already has `oldTask`.
5. Click **Deploy → Manage deployments → pencil icon**. Set **Version** to **New version**. Click **Deploy**. The `/exec` URL stays the same.

Role times are what the page, the emails, and the calendar file use. A Ribbon Cutting with no end time treats "through end of event" as 60 minutes after the start. Set `end` on that event in `abaEvents()` when you know the real end. Every Happy Hour is 4:30–6:30 PM. Drink Delivery is 2:00–3:00 PM the day before the lunch.

## Resolve the full-lunch rows

After v3 is deployed, paste `apps-script/FixFullLunch.gs` as a new script file named `FixFullLunch`. Also paste the updated `Templates.gs` and `Code.gs` (`Mail.gs` is unchanged). Run **resolveFullLunchV3** once. It does not send email. Then **Deploy → Manage deployments → pencil → New version → Deploy**, because `Templates.gs` and `Code.gs` changed. The `/exec` URL stays the same.

The run before January 21, 2027 should log: `Resolved 5 Ambassadors - Full lunch rows. Created 15 sign-ups. Skipped 0 roles already held. Over capacity: none. Left 4 past rows unchanged. Updated 1 Drink Delivery time to 2:00–3:00 PM the day before.` Running it again logs zeros for created rows and Drink Delivery updates.

## Upgrading to v4

This splits the Signups `location` column into `venue` and `address`, and hides the columns the page needs but you do not edit: `signupId`, `slotId`, `source`, `token`, `oldTask`, `previousSlotId`, `sequence`, `reminderSent`, and `updatedAt`. Those values stay in the sheet. `status` and `createdAt` stay visible. The public page still shows names only. It does not return email addresses or tokens.

Do not run `setup`, `migrateV2`, or `migrateV3` again.

1. In the spreadsheet, choose **Extensions → Apps Script**.
2. Replace `Code.gs`, `Mail.gs`, `Templates.gs`, and `FixFullLunch.gs` with the copies in `apps-script/`. Save.
3. Choose **migrateV4** and click **Run**. It does not send email, does not delete rows, and does not change any status. Running it again does not rewrite the rows.
4. Click **Deploy → Manage deployments → pencil icon**. Set **Version** to **New version**. Click **Deploy**. The `/exec` URL stays the same.

The first run logs: `Migration v4 complete. Split location into venue and address on N sign-up rows. Hid signupId, slotId, source, token, oldTask, and the other internal columns. Statuses were not changed.` A second run logs that v4 is already applied and no rows were changed.

A matching event in `abaEvents()` supplies the venue and street. Any other row is split from the old location text. New sign-ups write venue and address separately. Confirmation email and the calendar file still show the full place, such as `Ada Hotel, 7415 River St SE, Ada`.

## Upgrading to v5

Sheets turned some date and time cells into real date values, so a time like `11:30 AM` displays as `12/30/1899`. Paste the updated `apps-script/Code.gs`, save, and run **normalizeDatesV5** once. It rewrites only the date and time columns as plain text (`2027-01-21` and `11:30 AM`), sets those columns to plain text, and leaves every other cell alone. It writes to the log only. Running it again changes nothing. Then publish a new deployment version so new sign-ups keep storing those columns as text. The `/exec` URL stays the same.
