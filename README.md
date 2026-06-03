# Academic Notes

A static GitHub Pages site for sharing academic material with juniors.

## How it works

The website reads `site-data.json` and displays your folders/files automatically.

You only need to manage the repo folders, for example:

```text
sem3/
  dsa/
    notes.pdf
    assignments.pdf
  cn/
    notes.pdf
sem4/
  dbms/
    unit-1.pdf
```

After you push changes to GitHub, the included GitHub Action runs `scripts/build-index.js` during deployment. The generated `site-data.json` is included in the deployed website without creating an extra commit.

## Adding material

1. Add or update any folder/file in the repo.
2. Commit and push to GitHub.
3. Wait for the `Deploy GitHub Pages` action to finish.
4. Refresh the GitHub Pages website.

## Local preview

Generate the folder index:

```bash
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
2. Set source to `GitHub Actions`.
3. Save if GitHub shows a save button.

Your site will be available at:

```text
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

## Notes

- The site ignores internal files like `index.html`, `style.css`, `app.js`, `.github`, and `scripts`.
- Public GitHub Pages repos are easiest for juniors to access.
- Keep file names readable, such as `unit-1-notes.pdf` or `dsa-assignment-2.pdf`.
