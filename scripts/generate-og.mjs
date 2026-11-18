// Renders the social card and the iOS home-screen icon.
//
//   node scripts/generate-og.mjs [--id 3763]
//
// Writes preview/remaster/public/og.png (1200x630) and apple-touch-icon.png (180x180).
// Run by hand; not part of the build. Committed outputs use hero punk #3763 (most changed pixels).
import { join } from 'path';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { ROOT, canvasLib } from './_deps.mjs';
import { createStackCompositor } from '../lib/stack-compositor.js';

const { createCanvas, loadImage, GlobalFonts } = canvasLib();
const dataDir = join(ROOT, 'data');
const pubDir = join(ROOT, 'preview/remaster/public');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ACCENT = '#1a43c8', INK = '#181818', MUTED = '#6b6b6b', BG = '#638596';

// Static instances cut from Montserrat (SIL OFL), registered as separate families.
GlobalFonts.registerFromPath(join(ROOT, 'scripts/assets/fonts/Montserrat-ExtraBold.ttf'), 'MontserratXB');
GlobalFonts.registerFromPath(join(ROOT, 'scripts/assets/fonts/Montserrat-SemiBold.ttf'), 'MontserratSB');

const eligible = readJson(join(dataDir, 'all-eligible-punks.json'));
const idArg = process.argv.indexOf('--id');
const id = idArg > 0 ? +process.argv[idArg + 1]
  : readJson(join(dataDir, 'remaster-pixel-counts.json')).map((e) => e.id).find((i) => eligible.includes(i));
if (!eligible.includes(id)) throw new Error(`#${id} is not eligible`);

const sheet = await loadImage(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));
const csv = readFileSync(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'), 'utf8');
const punks = {};
for (const l of csv.trim().replace(/\r\n/g, '\n').split('\n').slice(1)) {
  const m = l.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
  if (m) punks[+m[1]] = { id: +m[1], type: m[2], gender: m[3], skinTone: m[4] || null, accessories: m[6].trim() ? m[6].split(' / ').map((a) => a.trim()) : [] };
}
const { stackPunk } = createStackCompositor({ createCanvas: (w, h) => createCanvas(w, h), getSpriteSheet: () => sheet, punks });
const remaster = stackPunk(punks[id]);

const big = await loadImage(join(dataDir, 'punks.png'));
const original = createCanvas(24, 24);
const ox = original.getContext('2d');
ox.fillStyle = BG; ox.fillRect(0, 0, 24, 24);
ox.drawImage(big, (id % 100) * 24, Math.floor(id / 100) * 24, 24, 24, 0, 0, 24, 24);

const W = 1200, H = 630, S = 10, SP = 24 * S;
const c = createCanvas(W, H);
const g = c.getContext('2d');
g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);

const sprite = (img, x, y) => {
  g.save();
  g.beginPath(); g.roundRect(x, y, SP, SP, 8); g.clip();
  g.fillStyle = BG; g.fillRect(x, y, SP, SP);
  g.imageSmoothingEnabled = false; g.drawImage(img, x, y, SP, SP);
  g.restore();
};

// Left column
const fav = await loadImage(join(pubDir, 'favicon.png'));
g.imageSmoothingEnabled = false;
g.drawImage(fav, 72, 100, 64, 64);
g.fillStyle = INK; g.font = '64px MontserratXB';
g.fillText('Punks', 72, 250);
g.fillText('Remastered', 72, 322);
g.fillStyle = MUTED; g.font = '28px MontserratSB';
g.fillText('Soulbound remasters of', 72, 388);
g.fillText('3,434 CryptoPunks.', 72, 426);
g.fillText('Mint free (gas only).', 72, 478);
g.fillText('Follows your punk.', 72, 516);
g.fillStyle = ACCENT; g.font = '28px MontserratXB';
g.fillText('punksremastered.com', 72, 580);

// Right block: original -> remaster (inside the central safe area, x <= 1128)
const y0 = 170, xo = 552, xr = 888, my = y0 + SP / 2;
sprite(original, xo, y0);
sprite(remaster, xr, y0);
g.fillStyle = ACCENT;
g.beginPath();
g.moveTo(xo + SP + 14, my - 5); g.lineTo(xr - 30, my - 5); g.lineTo(xr - 30, my - 14);
g.lineTo(xr - 14, my); g.lineTo(xr - 30, my + 14); g.lineTo(xr - 30, my + 5); g.lineTo(xo + SP + 14, my + 5);
g.closePath(); g.fill();
g.fillStyle = MUTED; g.font = '22px MontserratSB'; g.textAlign = 'center';
g.fillText('Original', xo + SP / 2, y0 + SP + 40);
g.fillText('Remaster', xr + SP / 2, y0 + SP + 40);
writeFileSync(join(pubDir, 'og.png'), await c.encode('png'));

// apple-touch-icon: draw the blocky favicon at the largest integer multiple that fits in 160px
const ic = createCanvas(180, 180);
const ig = ic.getContext('2d');
ig.fillStyle = ACCENT; ig.fillRect(0, 0, 180, 180);
ig.imageSmoothingEnabled = false;
const sz = fav.width <= 160 ? fav.width * Math.floor(160 / fav.width) : 160;
ig.drawImage(fav, (180 - sz) / 2, (180 - sz) / 2, sz, sz);
writeFileSync(join(pubDir, 'apple-touch-icon.png'), await ic.encode('png'));

console.log(`hero #${id}`, ['og.png', 'apple-touch-icon.png'].map((f) => `${f} ${statSync(join(pubDir, f)).size}B`).join(', '));
