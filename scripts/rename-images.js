// scripts/rename-images.js
// Renames images in category folders to clean, sequential names: 001.jpg, 002.jpg, ...
// Categories: street, landscape, architecture. Skips non-JPEG files and hidden/system files.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMAGES = path.join(ROOT, 'images');
const CATS = ['street', 'landscape', 'architecture'];

const JPG_EXTS = new Set(['.jpg', '.jpeg', '.JPG', '.JPEG']);

function getIndexFromName(name) {
  const m = /(\d+)(?=\.[a-zA-Z0-9]+$)/.exec(name);
  return m ? parseInt(m[1], 10) : 0;
}

function pad(n) {
  if (n < 1000) return String(n).padStart(3, '0');
  return String(n);
}

function renameCategory(cat) {
  const dir = path.join(IMAGES, cat);
  if (!fs.existsSync(dir)) return console.warn(`Missing: ${dir}`);

  const entries = fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.') && JPG_EXTS.has(path.extname(f)))
    .sort((a, b) => getIndexFromName(a) - getIndexFromName(b));

  if (!entries.length) {
    console.log(`No JPEGs found in ${cat}`);
    return;
  }

  // First pass: move to temp names to avoid collisions
  const temps = [];
  for (const f of entries) {
    const from = path.join(dir, f);
    const tmp = path.join(dir, `__tmp__${f}`);
    fs.renameSync(from, tmp);
    temps.push({ from: tmp, orig: f });
  }

  // Second pass: assign clean sequential names
  let i = 1;
  for (const t of temps) {
    const to = path.join(dir, `${pad(i++)}.jpg`);
    fs.renameSync(t.from, to);
  }

  console.log(`Renamed ${entries.length} files in ${cat} -> 001.jpg..${pad(entries.length)}.jpg`);
}

for (const c of CATS) renameCategory(c);
console.log('Done. Consider re-running: node generate-manifest.js');

