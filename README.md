# Academic Notes

A static GitHub Pages site for sharing academic material with juniors from a Google Drive folder.

## How it works

The website reads `site-data.json` and displays the folders/files from Google Drive automatically.

Run the `Update site from Drive` workflow manually whenever the Drive content changes. It authenticates with a service account, recursively reads the configured Drive folder, and commits `site-data.json` only when the generated Drive index changed.

The GitHub repository needs secrets named `GDRIVE_SERVICE_KEY` and `GDRIVE_FOLDER_ID`. Share the Drive folder with the service account's `client_email`.

## Adding material

1. Add or update any folder/file in the Google Drive folder.
2. Open the repository's `Actions` tab on GitHub.
3. Select `Update site from Drive`, choose `Run workflow`, and run it.
4. Wait for the workflow to finish.
5. Refresh the GitHub Pages website.

## Local preview

Generate the Drive index:

```powershell
$env:GDRIVE_FOLDER_ID = "your-folder-id"
python generate_site.py
```

Local generation also requires the service account key at `service_account.json`.

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

- The Drive folder ID is stored in the `GDRIVE_FOLDER_ID` GitHub Actions secret.
- The workflow does not run on a timer.
- Public GitHub Pages repos are easiest for juniors to access.
- Keep Drive file names readable, such as `unit-1-notes.pdf` or `dsa-assignment-2.pdf`.
