#!/usr/bin/env node
/**
 * App Store ve Google Play mağaza görsellerini üretir.
 *
 * Kullanım:
 *   node scripts/store-screenshots/render.js              # Türkçe
 *   node scripts/store-screenshots/render.js --lang en    # İngilizce
 *   node scripts/store-screenshots/render.js --lang all   # ikisi
 *   node scripts/store-screenshots/render.js --only iphone          # yalnız iPhone
 *   node scripts/store-screenshots/render.js --only ipad,feature    # iPad + öne çıkan görsel
 *   (--only: iphone, ipad, android, feature ya da hedef adı, virgülle)
 *
 * Girdi  : assets/images/Store/<sürüm>/kaynak/{iphone,ipad,android}/<ekran-id>.png
 *          (ekran id'leri ve ne çekileceği: screens.json)
 * Çıktı  : assets/images/Store/<sürüm>/<dil>/<hedef>/<ekran-id>.png
 *          assets/images/Store/<sürüm>/<dil>/play-feature-graphic.png
 *
 * Güncel ekran görüntüsü olmayan ekranlar "TASLAK" şeridiyle ve "-TASLAK"
 * sonekiyle üretilir; bunlar mağazaya yüklenmemeli.
 *
 * Ölçüler (Eylül 2026, resmi dokümanlardan doğrulandı):
 *  - App Store iPhone 6,9": 1320x2868 (6,5" verilmezse zorunlu olan bu)
 *  - App Store iPhone 6,5": 1284x2778
 *  - App Store iPad 13"   : 2064x2752 (uygulama iPad'de çalıştığı için zorunlu)
 *  - Google Play telefon  : 1080x1920 (9:16; öne çıkarılmak için en az 4 adet)
 *  - Google Play öne çıkan görsel: 1024x500 (zorunlu)
 * İki mağaza da alfa kanalı içeren PNG kabul etmiyor; çıktılar 24 bit RGB.
 *
 * Gereken: Chrome ya da Edge (headless) ve ffmpeg.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const VERSION = require(path.join(ROOT, 'app.json')).expo.version;
const STORE = path.join(ROOT, 'assets', 'images', 'Store', VERSION);
const INPUT = path.join(STORE, 'kaynak');
const PLACEHOLDER_DIR = path.join(ROOT, 'assets', 'images', 'screenShot');
const TEMPLATE = path.join(__dirname, 'template.html');
const LOGO = path.join(ROOT, 'assets', 'images', 'logo.png');
const BALL = path.join(ROOT, 'assets', 'images', 'ball.png');
const { screens, feature } = JSON.parse(fs.readFileSync(path.join(__dirname, 'screens.json'), 'utf8'));

const TARGETS = [
  { id: 'appstore-iphone-6.9', w: 1320, h: 2868, kind: 'iphone', sources: ['iphone'] },
  { id: 'appstore-iphone-6.5', w: 1284, h: 2778, kind: 'iphone', sources: ['iphone'] },
  { id: 'appstore-ipad-13', w: 2064, h: 2752, kind: 'ipad', sources: ['ipad'] },
  // Android görüntüsü yoksa iPhone görüntüsü kullanılır ama TASLAK sayılır:
  // Android çerçevesinde iOS durum çubuğu yanıltıcı olur.
  { id: 'play-phone', w: 1080, h: 1920, kind: 'android', sources: ['android', 'iphone'] },
];
const FEATURE = { w: 1024, h: 500 };
const DRAFT_LABEL = 'TASLAK • güncel ekran görüntüsü ekleyin';

// ------------------------------------------------------------ araçlar

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function findFfmpeg() {
  const works = (bin) => bin && spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
  const local = process.env.LOCALAPPDATA || '';
  for (const bin of [process.env.FFMPEG_PATH, 'ffmpeg', path.join(local, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')]) {
    if (works(bin)) return bin;
  }
  // winget kurulumu PATH'e henüz girmemiş olabilir.
  const pkgs = path.join(local, 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(pkgs)) {
    for (const d of fs.readdirSync(pkgs).filter((n) => /ffmpeg/i.test(n))) {
      for (const sub of fs.readdirSync(path.join(pkgs, d))) {
        const bin = path.join(pkgs, d, sub, 'bin', 'ffmpeg.exe');
        if (works(bin)) return bin;
      }
    }
  }
  return null;
}

/** PNG başlığından genişlik, yükseklik ve renk türü (2 = RGB, alfasız). */
function pngInfo(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}

function findInput(folder, id) {
  const dir = path.join(INPUT, folder);
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => {
    const ext = path.extname(f).toLowerCase();
    return path.basename(f, path.extname(f)) === id && ['.png', '.jpg', '.jpeg'].includes(ext);
  });
  return hit ? path.join(dir, hit) : null;
}

const fileUrl = (p) => pathToFileURL(p).href;

// ------------------------------------------------------------ çizim

const BROWSER = findBrowser();
const FFMPEG = findFfmpeg();
if (!BROWSER) throw new Error('Chrome ya da Edge bulunamadı (CHROME_PATH ile belirtebilirsiniz).');
if (!FFMPEG) throw new Error('ffmpeg bulunamadı (FFMPEG_PATH ile belirtebilirsiniz).');
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-store-'));

function shoot(cfg, w, h, outFile) {
  const tmp = outFile + '.tmp.png';
  const url = fileUrl(TEMPLATE) + '#' + encodeURIComponent(JSON.stringify(cfg));
  execFileSync(BROWSER, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--user-data-dir=' + PROFILE, '--virtual-time-budget=10000',
    `--window-size=${w},${h}`, '--screenshot=' + tmp, url,
  ], { stdio: 'ignore' });
  // Alfa kanalını at: iki mağaza da saydamlık içeren PNG'yi reddediyor.
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', tmp, '-pix_fmt', 'rgb24', outFile]);
  fs.unlinkSync(tmp);

  const info = pngInfo(outFile);
  if (info.w !== w || info.h !== h) throw new Error(`${outFile}: ${info.w}x${info.h}, beklenen ${w}x${h}`);
  if (info.colorType !== 2) throw new Error(`${outFile}: alfa kanalı temizlenemedi (renk türü ${info.colorType})`);
}

// ------------------------------------------------------------ çalıştır

const langArg = (process.argv[process.argv.indexOf('--lang') + 1] || 'tr').toLowerCase();
const LANGS = process.argv.includes('--lang') ? (langArg === 'all' ? ['tr', 'en'] : [langArg]) : ['tr'];

// --only: yalnızca istenen hedefleri üret; diğer klasörlere dokunulmaz.
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx >= 0 ? String(process.argv[onlyIdx + 1] || '').split(',').map((x) => x.trim()).filter(Boolean) : null;
const SELECTED = ONLY ? TARGETS.filter((t) => ONLY.includes(t.kind) || ONLY.includes(t.id)) : TARGETS;
const RENDER_FEATURE = !ONLY || ONLY.includes('feature');
if (ONLY && !SELECTED.length && !RENDER_FEATURE) throw new Error('--only ile eşleşen hedef yok: ' + ONLY.join(','));

for (const folder of ['iphone', 'ipad', 'android']) fs.mkdirSync(path.join(INPUT, folder), { recursive: true });

const missing = new Map(); // klasör -> eksik ekranlar
const summary = [];

for (const lang of LANGS) {
  for (const target of SELECTED) {
    const outDir = path.join(STORE, lang, target.id);
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(outDir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(outDir, f));

    let finals = 0;
    let drafts = 0;
    for (const screen of screens) {
      const text = screen[lang];
      let img = null;
      let draft = false;

      // Asıl kaynak klasörü (ör. android), yoksa yedek (ör. iphone).
      const primary = findInput(target.sources[0], screen.id);
      if (primary) {
        img = primary;
      } else {
        draft = true;
        if (!missing.has(target.sources[0])) missing.set(target.sources[0], new Set());
        missing.get(target.sources[0]).add(screen.id);
        const fallback = target.sources[1] && findInput(target.sources[1], screen.id);
        if (fallback) img = fallback;
        else if (target.kind !== 'ipad' && screen.placeholder) img = path.join(PLACEHOLDER_DIR, screen.placeholder);
      }

      const cfg = {
        kind: target.kind,
        hero: !!screen.hero,
        kicker: text.kicker,
        headline: text.headline,
        sub: text.sub,
        logo: fileUrl(LOGO),
        img: img ? fileUrl(img) : null,
        placeholderText: `${target.kind === 'ipad' ? 'iPad' : 'Telefon'} ekran görüntüsü:\n${screen.shot}`,
        draft: draft ? DRAFT_LABEL : null,
      };
      const out = path.join(outDir, `${screen.id}${draft ? '-TASLAK' : ''}.png`);
      shoot(cfg, target.w, target.h, out);
      draft ? drafts++ : finals++;
    }
    summary.push(`${lang}/${target.id}: ${finals} hazır, ${drafts} taslak (${target.w}x${target.h})`);
  }

  if (RENDER_FEATURE) {
    const fg = feature[lang];
    const fgOut = path.join(STORE, lang, 'play-feature-graphic.png');
    shoot({ mode: 'feature', headline: fg.headline, sub: fg.sub, logo: fileUrl(LOGO), ball: fileUrl(BALL) }, FEATURE.w, FEATURE.h, fgOut);
    summary.push(`${lang}/play-feature-graphic: hazır (${FEATURE.w}x${FEATURE.h})`);
  }
}

fs.rmSync(PROFILE, { recursive: true, force: true });

console.log('\nÜretildi (ölçüler ve alfasız RGB doğrulandı):');
for (const line of summary) console.log('  ' + line);

if (missing.size) {
  console.log(`\nEksik güncel ekran görüntüleri -> ${path.relative(ROOT, INPUT)}/<klasör>/<ekran-id>.png`);
  for (const [folder, ids] of missing) {
    console.log(`  ${folder}/`);
    for (const s of screens.filter((x) => ids.has(x.id))) console.log(`    ${s.id}.png  — ${s.shot}`);
  }
}
