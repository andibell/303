#!/usr/bin/env node
/*
 * Checks that the production build can be reviewed by opening dist/index.html straight from the filesystem
 * (file://), with no server, no network and no machine-specific paths.
 *
 *   node scripts/verify-review-build.mjs [distDir]      (default: dist)
 *
 * It inspects the generated files only; it doesn't start a browser. Exits 1 and lists every problem it finds.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] ?? 'dist');
const problems = [];
const fail = (message) => problems.push(message);
const read = (file) => readFileSync(file, 'utf8');

const indexPath = join(distDir, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`✗ ${indexPath} not found. Run "npm run build" first.`);
  process.exit(1);
}
const html = read(indexPath);

// Tags that load files: they must be relative, and must not use module scripts or CORS-mode loading.
const tags = [...html.matchAll(/<(script|link)\b[^>]*>/gi)].map((match) => match[0]);
const scripts = tags.filter((tag) => /^<script/i.test(tag));
const stylesheets = tags.filter((tag) => /^<link/i.test(tag) && /rel=["']?stylesheet/i.test(tag));
if (scripts.length === 0) fail('index.html loads no script.');

const referenced = [];
for (const tag of [...scripts, ...stylesheets]) {
  const kind = /^<script/i.test(tag) ? 'script' : 'stylesheet';
  if (/type=["']module["']/i.test(tag)) fail(`A ${kind} is a module (blocked from file://): ${tag}`);
  if (/\bcrossorigin\b/i.test(tag)) fail(`A ${kind} uses crossorigin (blocked from file://): ${tag}`);
  const src = /(?:src|href)=["']([^"']+)["']/i.exec(tag)?.[1];
  if (!src) continue;
  if (!/^\.\//.test(src)) fail(`A ${kind} path isn't relative ("./…"): ${src}`);
  else referenced.push(src);
}

// Everything index.html loads must exist.
for (const src of referenced) {
  if (!existsSync(join(dirname(indexPath), src))) fail(`index.html references a missing file: ${src}`);
}

// No network or development-server references, in the page or in the bundled script.
// A dev-server reference carries a port (localhost:5173). A bare "http://localhost" is not one: React Router uses it
// as a dummy base for parsing relative URLs and never requests it.
const FORBIDDEN = [/localhost:\d+/i, /127\.0\.0\.1/, /fonts\.googleapis/i, /fonts\.gstatic/i, /cdnjs/i, /jsdelivr/i, /unpkg\.com/i, /\bcdn\./i];
const bundleFiles = referenced.filter((src) => src.endsWith('.js')).map((src) => join(dirname(indexPath), src));
const cssFiles = referenced.filter((src) => src.endsWith('.css')).map((src) => join(dirname(indexPath), src));
for (const [name, text] of [['index.html', html], ...[...bundleFiles, ...cssFiles].filter(existsSync).map((file) => [file.replace(`${distDir}/`, ''), read(file)])]) {
  for (const pattern of FORBIDDEN) if (pattern.test(text)) fail(`${name} references ${pattern}`);
  if (/^[\s\S]*?(src|href)=["']https?:\/\//i.test(name === 'index.html' ? text : '')) fail('index.html loads a remote file.');
}

// A classic script can't use import.meta, and the dev-only style preview must not ship.
for (const file of bundleFiles.filter(existsSync)) {
  const js = read(file);
  if (/\bimport\.meta\b/.test(js)) fail(`${file.replace(`${distDir}/`, '')} uses import.meta (not valid in a classic script).`);
  if (/style-preview/.test(js)) fail('The dev-only style preview route is in the production bundle.');
}

// Local assets referenced by the bundle must exist beside it.
const assetsDir = join(distDir, 'assets');
const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
for (const file of [...bundleFiles, ...cssFiles].filter(existsSync)) {
  for (const [, asset] of read(file).matchAll(/new URL\(`([^`]+\.(?:svg|woff2?|ttf|png|jpg))`/g)) {
    if (!existsSync(join(assetsDir, asset))) fail(`The bundle refers to ${asset}, which isn't in dist/assets.`);
  }
}

// The reference materials must stay out of the bundle.
const stray = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? stray(join(dir, entry.name)) : /\.(pdf|docx|png|jpg|jpeg|md)$/i.test(entry.name) ? [join(dir, entry.name)] : [],
  );
for (const file of stray(distDir)) fail(`Unexpected reference-type file in dist: ${file.replace(`${distDir}/`, '')}`);

if (problems.length > 0) {
  console.error(`✗ Review build check failed (${distDir}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`✓ Review build is file:// ready: ${referenced.length} relative file(s), ${assets.length} bundled asset(s), no module scripts, no network references.`);
console.log(`  Open ${indexPath}`);
