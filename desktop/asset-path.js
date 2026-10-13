'use strict';

const path = require('node:path');

/** Resolve a terrain://app/ URL to one file inside the bundled site directory. */
function resolveAssetPath(siteRoot, requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'terrain:' || url.host !== 'app' || url.username || url.password || url.port) {
    return null;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  if (pathname.split('/').some(part => part === '.' || part === '..')) return null;

  const root = path.resolve(siteRoot);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  return resolved.startsWith(root + path.sep) ? resolved : null;
}

module.exports = { resolveAssetPath };
