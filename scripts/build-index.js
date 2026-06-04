const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outputFile = path.join(rootDir, "site-data.json");
const defaultDriveFolder = "https://drive.google.com/drive/folders/1vYlQn7uYj7P_cS2mivpexOBRzY6KUfm9";
const driveFolderId = parseDriveFolderId(
  process.env.GOOGLE_DRIVE_FOLDER_URL
    || process.env.GOOGLE_DRIVE_FOLDER_ID
    || defaultDriveFolder,
);
const driveApiKey = process.env.GOOGLE_DRIVE_API_KEY || "";
const driveFolderMimeType = "application/vnd.google-apps.folder";

const ignoredNames = new Set([
  ".git",
  ".github",
  "node_modules",
  "scripts",
]);

const ignoredFiles = new Set([
  "app.js",
  "index.html",
  "README.md",
  "site-data.json",
  "style.css",
]);

function buildNode(absolutePath, relativePath = "") {
  const stats = fs.statSync(absolutePath);
  const name = relativePath ? path.basename(relativePath) : "";

  if (!stats.isDirectory()) {
    return {
      type: "file",
      name,
      path: toPosixPath(relativePath),
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
    };
  }

  const children = fs.readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => shouldInclude(entry, relativePath))
    .map((entry) => {
      const childRelativePath = path.join(relativePath, entry.name);
      return buildNode(path.join(absolutePath, entry.name), childRelativePath);
    })
    .sort(compareNodes);

  return {
    type: "folder",
    name,
    path: toPosixPath(relativePath),
    children,
  };
}

function shouldInclude(entry, relativePath) {
  if (entry.name.startsWith(".")) {
    return false;
  }

  if (entry.isDirectory()) {
    return !ignoredNames.has(entry.name);
  }

  if (!relativePath && ignoredFiles.has(entry.name)) {
    return false;
  }

  return true;
}

function compareNodes(a, b) {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function repositoryUrl() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo) {
    return `https://github.com/${repo}`;
  }

  return normalizeRemoteUrl(readOriginRemote());
}

function readOriginRemote() {
  const gitConfigPath = path.join(rootDir, ".git", "config");
  if (!fs.existsSync(gitConfigPath)) {
    return "";
  }

  const config = fs.readFileSync(gitConfigPath, "utf8");
  const originSection = config.match(/\[remote "origin"\]([\s\S]*?)(?:\n\[|$)/);
  if (!originSection) {
    return "";
  }

  const urlLine = originSection[1].match(/^\s*url\s*=\s*(.+)$/m);
  return urlLine ? urlLine[1].trim() : "";
}

function normalizeRemoteUrl(remote) {
  if (!remote) {
    return "";
  }

  if (remote.startsWith("git@github.com:")) {
    return `https://github.com/${remote.slice("git@github.com:".length).replace(/\.git$/, "")}`;
  }

  return remote.replace(/\.git$/, "");
}

function driveFolderUrl(id) {
  return `https://drive.google.com/drive/folders/${id}`;
}

function parseDriveFolderId(value) {
  const folder = value.trim();
  const urlMatch = folder.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([^/?#]+)/);
  return urlMatch ? urlMatch[1] : folder;
}

function driveFileUrl(id) {
  return `https://drive.google.com/file/d/${id}/view`;
}

async function listDriveChildren(folderId) {
  if (!folderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_URL or GOOGLE_DRIVE_FOLDER_ID is required");
  }

  if (!driveApiKey) {
    throw new Error("GOOGLE_DRIVE_API_KEY is required to index Google Drive content");
  }

  const children = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("key", driveApiKey);
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("orderBy", "folder,name_natural");

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url);
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Google Drive API request failed (${response.status}): ${message}`);
    }

    const data = await response.json();
    children.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return children;
}

async function buildDriveNode(folderId, relativePath = "", name = "") {
  const children = await Promise.all((await listDriveChildren(folderId)).map(async (entry) => {
    const childRelativePath = path.posix.join(relativePath, entry.name);

    if (entry.mimeType === driveFolderMimeType) {
      return buildDriveNode(entry.id, childRelativePath, entry.name);
    }

    return {
      type: "file",
      name: entry.name,
      path: childRelativePath,
      url: entry.webViewLink || driveFileUrl(entry.id),
      size: Number(entry.size || 0),
      updatedAt: entry.modifiedTime || "",
    };
  }));

  return {
    type: "folder",
    name,
    path: relativePath,
    url: driveFolderUrl(folderId),
    children: children.sort(compareNodes),
  };
}

async function buildData() {
  if (driveFolderId) {
    return {
      repositoryUrl: repositoryUrl(),
      sourceUrl: driveFolderUrl(driveFolderId),
      sourceLabel: "Google Drive",
      root: await buildDriveNode(driveFolderId),
    };
  }

  return {
    repositoryUrl: repositoryUrl(),
    sourceUrl: "",
    sourceLabel: "Repository",
    root: buildNode(rootDir),
  };
}

buildData()
  .then((data) => {
    fs.writeFileSync(outputFile, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`Generated ${path.relative(rootDir, outputFile)}`);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
