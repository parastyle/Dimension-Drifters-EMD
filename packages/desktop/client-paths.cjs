const path = require("node:path");

const CLIENT_SCHEME = "ddapp";

function normalizeServerHost(serverHost) {
  const host = serverHost.trim().toLowerCase();
  if (!host || /[\s/:?#@\\]/.test(host)) {
    throw new Error(
      `DD_SERVER_HOST must be a hostname without a scheme or port; received ${JSON.stringify(serverHost)}`,
    );
  }
  return host;
}

function makeClientURL(serverHost) {
  return `${CLIENT_SCHEME}://${normalizeServerHost(serverHost)}/`;
}

function resolveClientRequest(clientRoot, requestUrl, serverHost) {
  const url = new URL(requestUrl);
  if (url.protocol !== `${CLIENT_SCHEME}:` || url.hostname !== normalizeServerHost(serverHost)) {
    return null;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\0")) return null;

  const requestedPath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const filePath = path.resolve(clientRoot, `.${requestedPath}`);
  const relativePath = path.relative(clientRoot, filePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
  return filePath;
}

module.exports = {
  CLIENT_SCHEME,
  makeClientURL,
  normalizeServerHost,
  resolveClientRequest,
};
