import json
import os
import re
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


ROOT_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = ROOT_DIR / "site-data.json"
SERVICE_ACCOUNT_FILE = ROOT_DIR / "service_account.json"
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
                fields="nextPageToken, files(id, name, mimeType, size, modifiedTime)",
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


def drive_folder_url(folder_id):
    return f"https://drive.google.com/drive/folders/{folder_id}"


def drive_file_url(file_id):
    return f"https://drive.google.com/file/d/{file_id}/view"


def node_sort_key(node):
    return (node["type"] != "folder", node["name"].casefold())


def fetch_folder(service, folder_id, name="", path=""):
    children = []

    for item in list_children(service, folder_id):
        item_path = f"{path}/{item['name']}".strip("/")
        if item["mimeType"] == FOLDER_MIME_TYPE:
            children.append(fetch_folder(service, item["id"], item["name"], item_path))
            continue

        children.append(
            {
                "type": "file",
                "name": item["name"],
                "path": item_path,
                "url": drive_file_url(item["id"]),
                "size": int(item.get("size", 0)),
                "updatedAt": item.get("modifiedTime", ""),
            }
        )

    return {
        "type": "folder",
        "name": name,
        "path": path,
        "url": drive_folder_url(folder_id),
        "children": sorted(children, key=node_sort_key),
    }


def print_summary(folder):
    label = folder["path"] or "/"
    files = [child for child in folder["children"] if child["type"] == "file"]
    print(f"{label}: {len(files)} file(s)")
    for child in folder["children"]:
        if child["type"] == "folder":
            print_summary(child)


def count_files(folder):
    return sum(
        count_files(child) if child["type"] == "folder" else 1
        for child in folder["children"]
    )


def normalize_folder_id(value):
    match = re.search(r"drive\.google\.com/drive/(?:u/\d+/)?folders/([^/?#]+)", value)
    return match.group(1) if match else value


def main():
    folder_id = normalize_folder_id(os.environ.get("GDRIVE_FOLDER_ID", "").strip())
    if not folder_id:
        raise RuntimeError("GDRIVE_FOLDER_ID environment variable is required")
    if not SERVICE_ACCOUNT_FILE.exists():
        raise RuntimeError(f"{SERVICE_ACCOUNT_FILE.name} was not found in the repository root")

    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=[DRIVE_SCOPE],
    )
    service = build("drive", "v3", credentials=credentials, cache_discovery=False)
    try:
        root_metadata = (
            service.files()
            .get(fileId=folder_id, fields="id, name, mimeType", supportsAllDrives=True)
            .execute()
        )
        if root_metadata["mimeType"] != FOLDER_MIME_TYPE:
            raise RuntimeError("GDRIVE_FOLDER_ID must identify a Google Drive folder")
        root = fetch_folder(service, folder_id, root_metadata["name"])
    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        raise RuntimeError(
            "Google Drive request failed "
            f"(HTTP {status}). Confirm that the Drive API is enabled and the folder "
            "is shared with the service account client_email."
        ) from error

    data = {
        "sourceUrl": drive_folder_url(folder_id),
        "sourceLabel": "Google Drive",
        "root": root,
    }
    OUTPUT_FILE.write_text(f"{json.dumps(data, indent=2)}\n", encoding="utf-8")
    print_summary(root)
    print(f"Total: {count_files(root)} file(s)")


if __name__ == "__main__":
    main()
