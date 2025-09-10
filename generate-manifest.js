// generate-manifest.js
// Scans /images and writes sorted JSON manifests to /data

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'images');
const OUT = path.join(ROOT, 'data');

// categories (folder names under /images)
const CATS = ['street', 'landscape', 'architecture'];

// image file extensions we allow
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.JPG', '.JPEG', '.PNG', '.WEBP', '.GIF']);

// ensure /data exists
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/**
 * Extract a numeric index from file name.
 * Works with names like "strt01-03.jpg", "arch01-12.JPG", "anything-7.png".
 * Falls back to 0 if no number is found.
 */
function getIndexFromName(fileName) {
  // grab the last group of digits before extension
  // e.g. "strt01-03.jpg" -> "03"
  const m = /(\d+)(?=\.[a-zA-Z0-9]+$)/.exec(fileName);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * List images in a directory, return absolute file names (not paths).
 */
function listImageFiles(absDir) {
  if (!fs.existsSync(absDir)) return [];
  return fs
    .readdirSync(absDir)
    .filter(f => exts.has(path.extname(f)));
}

/**
 * Produce a sorted list of web paths for a given category folder.
 * Returns values like "images/street/strt01-01.jpg"
 */
function buildCategoryList(cat) {
  const dirAbs = path.join(SRC, cat);
  const files = listImageFiles(dirAbs);

  // sort by the numeric part so 1..2..10 order is correct
  files.sort((a, b) => getIndexFromName(a) - getIndexFromName(b));

  return files.map(f => `images/${cat}/${encodeURIComponent(f)}`);
}

/**
 * Build the "home" list from images under /images/home
 */
function buildHomeList() {
  const homeDir = path.join(SRC, 'home');
  if (!fs.existsSync(homeDir)) return [];
  const files = fs
    .readdirSync(homeDir)
    .filter(f => exts.has(path.extname(f)))
    .sort((a, b) => getIndexFromName(a) - getIndexFromName(b));

  return files.map(f => `images/home/${encodeURIComponent(f)}`);
}

// -------- build & write files --------
const manifest = {};
for (const cat of CATS) {
  const list = buildCategoryList(cat);
  manifest[cat] = list;
  fs.writeFileSync(path.join(OUT, `${cat}.json`), JSON.stringify(list, null, 2));
  console.log(`Wrote data/${cat}.json  (${list.length} images)`);
}

const homeList = buildHomeList();
fs.writeFileSync(path.join(OUT, 'home.json'), JSON.stringify(homeList, null, 2));
console.log(`Wrote data/home.json  (${homeList.length} images)`);

// combined for convenience
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ ...manifest, home: homeList }, null, 2));
console.log('Wrote data/manifest.json');
