import html
import os
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build


ROOT_DIR = Path(__file__).resolve().parent
INDEX_FILE = ROOT_DIR / "index.html"
SERVICE_ACCOUNT_FILE = ROOT_DIR / "service_account.json"
PLACEHOLDER = "<!-- DYNAMIC_CONTENT -->"
START_MARKER = "<!-- DYNAMIC_CONTENT_START -->"
END_MARKER = "<!-- DYNAMIC_CONTENT_END -->"
FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"


def list_children(service, folder_id):
    children = []
    page_token = None

    while True:
        response = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields="nextPageToken, files(id, name, mimeType)",
                orderBy="folder,name_natural",
                pageSize=1000,
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        children.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return children


def fetch_folder(service, folder_id, name="", path=""):
    folders = []
    files = []

    for item in list_children(service, folder_id):
        item_path = f"{path}/{item['name']}".strip("/")
        if item["mimeType"] == FOLDER_MIME_TYPE:
            folders.append(fetch_folder(service, item["id"], item["name"], item_path))
        else:
            files.append(
                {
                    "id": item["id"],
                    "name": item["name"],
                    "path": item_path,
                }
            )

    return {
        "name": name,
        "path": path,
        "folders": folders,
        "files": files,
    }


def render_file(file):
    name = html.escape(file["name"])
    url = f"https://drive.google.com/file/d/{file['id']}/view"
    return (
        f'            <a class="item" href="{url}" target="_blank" rel="noopener">\n'
        '              <span class="item-icon">FILE</span>\n'
        f'              <span class="item-title">{name}</span>\n'
        '              <span class="item-meta">Open in Google Drive</span>\n'
        "            </a>"
    )


def render_folder(folder, depth=0):
    heading_level = min(depth + 3, 6)
    folder_name = html.escape(folder["name"] or "Drive files")
    folder_path = html.escape(folder["path"], quote=True)
    parts = [
        f'        <section class="drive-folder" data-drive-path="{folder_path}">',
        f"          <h{heading_level}>{folder_name}</h{heading_level}>",
    ]

    if folder["files"]:
        parts.append('          <div class="items">')
        parts.extend(render_file(file) for file in folder["files"])
        parts.append("          </div>")

    for child in folder["folders"]:
        parts.append(render_folder(child, depth + 1))

    if not folder["files"] and not folder["folders"]:
        parts.append('          <p class="item-meta">No files in this folder.</p>')

    parts.append("        </section>")
    return "\n".join(parts)


def render_dynamic_content(root):
    return "\n".join(
        [
            START_MARKER,
            '      <section class="drive-sections" aria-label="Google Drive files">',
            render_folder(root),
            "      </section>",
            END_MARKER,
        ]
    )


def inject_dynamic_content(rendered):
    source = INDEX_FILE.read_text(encoding="utf-8")

    if START_MARKER in source and END_MARKER in source:
        start = source.index(START_MARKER)
        end = source.index(END_MARKER) + len(END_MARKER)
        updated = source[:start] + rendered + source[end:]
    elif PLACEHOLDER in source:
        updated = source.replace(PLACEHOLDER, rendered, 1)
    else:
        raise RuntimeError(f"{INDEX_FILE.name} does not contain {PLACEHOLDER}")

    if updated != source:
        INDEX_FILE.write_text(updated, encoding="utf-8")


def print_summary(folder):
    label = folder["path"] or "/"
    print(f"{label}: {len(folder['files'])} file(s)")
    for child in folder["folders"]:
        print_summary(child)


def count_files(folder):
    return len(folder["files"]) + sum(count_files(child) for child in folder["folders"])


def main():
    folder_id = os.environ.get("GDRIVE_FOLDER_ID", "").strip()
    if not folder_id:
        raise RuntimeError("GDRIVE_FOLDER_ID environment variable is required")
    if not SERVICE_ACCOUNT_FILE.exists():
        raise RuntimeError(f"{SERVICE_ACCOUNT_FILE.name} was not found in the repository root")

    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=[DRIVE_SCOPE],
    )
    service = build("drive", "v3", credentials=credentials, cache_discovery=False)
    root = fetch_folder(service, folder_id)

    inject_dynamic_content(render_dynamic_content(root))
    print_summary(root)
    print(f"Total: {count_files(root)} file(s)")


if __name__ == "__main__":
    main()
