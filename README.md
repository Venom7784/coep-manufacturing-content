# Academic Notes

A static GitHub Pages site for sharing academic material with juniors from a Google Drive folder.

## How it works

The website reads `site-data.json` and displays the folders/files from Google Drive automatically.

The current Drive source is:

```text
https://drive.google.com/drive/folders/1vYlQn7uYj7P_cS2mivpexOBRzY6KUfm9
```

Run the `Build folder index` workflow manually whenever the Drive content changes. It runs `scripts/build-index.js`, reads the Drive folder with the Google Drive API, and commits an updated `site-data.json` only when the generated data changed. A push to `main` or `master` also runs the workflow.

The GitHub repository needs a secret named `GOOGLE_DRIVE_API_KEY`. The Drive folder must be accessible to that API key, usually by setting the folder sharing to anyone with the link can view.

## Adding material

1. Add or update any folder/file in the Google Drive folder.
2. Open the repository's `Actions` tab on GitHub.
3. Select `Build folder index`, choose `Run workflow`, and run it.
4. Wait for the workflow to finish.
5. Refresh the GitHub Pages website.

## Local preview

Generate the folder index:

```bash
GOOGLE_DRIVE_API_KEY=your-api-key GOOGLE_DRIVE_FOLDER_URL=your-folder-link node scripts/build-index.js
```

In PowerShell:

```powershell
$env:GOOGLE_DRIVE_API_KEY = "your-api-key"
$env:GOOGLE_DRIVE_FOLDER_URL = "your-folder-link"
node scripts/build-index.js
```

Start a small local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages setup

In your GitHub repo:

1. Go to `Settings` > `Pages`.
2. Set source to `Deploy from a branch`.
3. Select the `main` branch and `/root`.
4. Save.

Your site will be available at:

```text
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

## Notes

- The Drive folder link is configured in `.github/workflows/build-index.yml`.
- The workflow does not run on a timer.
- Public GitHub Pages repos are easiest for juniors to access.
- Keep Drive file names readable, such as `unit-1-notes.pdf` or `dsa-assignment-2.pdf`.
