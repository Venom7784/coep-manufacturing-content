const state = {
  data: null,
  activePath: "",
  query: "",
};

const folderTree = document.querySelector("#folderTree");
const currentTitle = document.querySelector("#currentTitle");
const breadcrumb = document.querySelector("#breadcrumb");
const summary = document.querySelector("#summary");
const items = document.querySelector("#items");
const searchInput = document.querySelector("#searchInput");
const repoLink = document.querySelector("#repoLink");
const openFolderLink = document.querySelector("#openFolderLink");
const emptyStateTemplate = document.querySelector("#emptyStateTemplate");

async function init() {
  try {
    const response = await fetch("site-data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("site-data.json was not found");
    }

    state.data = await response.json();
    state.activePath = initialPath(state.data.root);
    render();
  } catch (error) {
    renderError(error);
  }
}

function render() {
  const root = state.data.root;
  const activeNode = findNode(root, state.activePath) || root;
  const visibleRoot = state.query ? filterTree(root, state.query) : root;

  repoLink.href = state.data.sourceUrl || state.data.repositoryUrl || "#";
  repoLink.textContent = state.data.sourceLabel ? `Open ${state.data.sourceLabel}` : "View Repository";
  repoLink.hidden = !repoLink.href || repoLink.href.endsWith("#");

  renderFolderTree(visibleRoot || root);
  renderBreadcrumb(activeNode);
  renderContent(activeNode);
}

function renderFolderTree(root) {
  folderTree.innerHTML = "";
  const folders = flattenFolders(root);

  if (!folders.length) {
    folderTree.append(emptyMessage("No folders yet."));
    return;
  }

  for (const folder of folders) {
    const button = document.createElement("button");
    button.className = `folder-button depth-${Math.min(folder.depth, 4)}`;
    button.textContent = `${folder.depth ? "└ " : ""}${displayName(folder.node)}`;
    button.type = "button";
    button.dataset.path = folder.node.path;
    button.classList.toggle("active", folder.node.path === state.activePath);
    button.addEventListener("click", () => setActivePath(folder.node.path));
    folderTree.append(button);
  }
}

function renderBreadcrumb(node) {
  breadcrumb.innerHTML = "";
  const parts = node.path ? node.path.split("/") : [];
  const crumbs = [{ label: "Home", path: "" }];
  let path = "";

  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    crumbs.push({ label: humanize(part), path });
  }

  crumbs.forEach((crumb, index) => {
    if (index > 0) {
      breadcrumb.append(document.createTextNode("/"));
    }

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = crumb.label;
    button.addEventListener("click", () => setActivePath(crumb.path));
    breadcrumb.append(button);
  });
}

function renderContent(node) {
  currentTitle.textContent = displayName(node);
  openFolderLink.href = node.url || node.path || "./";
  openFolderLink.hidden = !openFolderLink.href || openFolderLink.href.endsWith("#");

  const folders = node.children.filter((child) => child.type === "folder");
  const files = node.children.filter((child) => child.type === "file");
  summary.innerHTML = "";
  summary.append(
    pill(`${folders.length} folder${folders.length === 1 ? "" : "s"}`),
    pill(`${files.length} file${files.length === 1 ? "" : "s"}`),
  );

  items.innerHTML = "";
  const visibleChildren = node.children.filter((child) => matchesQuery(child, state.query));

  if (!visibleChildren.length) {
    items.append(emptyStateTemplate.content.cloneNode(true));
    return;
  }

  for (const child of visibleChildren) {
    items.append(itemCard(child));
  }
}

function itemCard(node) {
  const link = document.createElement("a");
  link.className = "item";
  link.href = node.type === "folder" ? `#${node.path}` : encodeURI(node.url || node.path);
  if (node.type !== "folder" && node.url) {
    link.target = "_blank";
    link.rel = "noopener";
  }
  link.addEventListener("click", (event) => {
    if (node.type !== "folder") {
      return;
    }

    event.preventDefault();
    setActivePath(node.path);
  });

  const icon = document.createElement("div");
  icon.className = "item-icon";
  icon.textContent = node.type === "folder" ? "DIR" : iconForFile(node.name);

  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = displayName(node);

  const meta = document.createElement("div");
  meta.className = "item-meta";
  meta.textContent = node.type === "folder"
    ? `${node.children.length} item${node.children.length === 1 ? "" : "s"}`
    : fileType(node.name);

  link.append(icon, title, meta);
  return link;
}

function flattenFolders(node, depth = 0) {
  if (!node || node.type !== "folder") {
    return [];
  }

  const current = { node, depth };
  const children = node.children
    .filter((child) => child.type === "folder")
    .flatMap((child) => flattenFolders(child, depth + 1));

  return [current, ...children];
}

function findNode(node, path) {
  if (node.path === path) {
    return node;
  }

  for (const child of node.children || []) {
    if (child.type === "folder") {
      const match = findNode(child, path);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function filterTree(node, query) {
  if (!query) {
    return node;
  }

  const children = (node.children || [])
    .map((child) => child.type === "folder" ? filterTree(child, query) : child)
    .filter((child) => matchesQuery(child, query) || (child.children && child.children.length));

  if (!matchesQuery(node, query) && !children.length) {
    return null;
  }

  return { ...node, children };
}

function matchesQuery(node, query) {
  if (!query) {
    return true;
  }

  const text = `${node.name} ${node.path}`.toLowerCase();
  return text.includes(query.toLowerCase());
}

function displayName(node) {
  return node.path ? humanize(node.name) : "All Notes";
}

function humanize(value) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fileType(name) {
  const extension = name.includes(".") ? name.split(".").pop().toUpperCase() : "File";
  return extension === "PDF" ? "PDF document" : `${extension} file`;
}

function iconForFile(name) {
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (extension === "pdf") return "PDF";
  if (["doc", "docx"].includes(extension)) return "DOC";
  if (["ppt", "pptx"].includes(extension)) return "PPT";
  if (["xls", "xlsx", "csv"].includes(extension)) return "XLS";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "IMG";
  if (["zip", "rar", "7z"].includes(extension)) return "ZIP";
  return "FILE";
}

function pill(text) {
  const element = document.createElement("span");
  element.className = "pill";
  element.textContent = text;
  return element;
}

function emptyMessage(text) {
  const element = document.createElement("p");
  element.className = "notice";
  element.textContent = text;
  return element;
}

function renderError(error) {
  currentTitle.textContent = "Index not generated";
  summary.innerHTML = "";
  items.innerHTML = "";
  folderTree.innerHTML = "";
  items.append(emptyMessage(`${error.message}. Run "node scripts/build-index.js" to create it.`));
}

function setActivePath(path) {
  state.activePath = path;
  if (path) {
    window.history.pushState(null, "", `#${encodeURIComponent(path)}`);
  } else {
    window.history.pushState(null, "", window.location.pathname);
  }
  render();
}

function initialPath(root) {
  const path = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return findNode(root, path) ? path : root.path;
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});

window.addEventListener("hashchange", () => {
  const path = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (state.data && findNode(state.data.root, path)) {
    state.activePath = path;
    render();
  }
});

window.addEventListener("popstate", () => {
  if (!state.data) {
    return;
  }

  state.activePath = initialPath(state.data.root);
  render();
});

init();
