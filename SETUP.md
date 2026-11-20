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
