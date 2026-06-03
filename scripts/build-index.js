const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outputFile = path.join(rootDir, "site-data.json");

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

const data = {
  generatedAt: new Date().toISOString(),
  repositoryUrl: repositoryUrl(),
  root: buildNode(rootDir),
};

fs.writeFileSync(outputFile, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Generated ${path.relative(rootDir, outputFile)}`);
