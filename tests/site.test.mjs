import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const routes = [
  { file: 'snake-jack/index.html', game: 'Snake Jack', lang: 'en', privacy: false, switchHref: '../tr/snake-jack/' },
  { file: 'snake-jack/privacy/index.html', game: 'Snake Jack', lang: 'en', privacy: true, switchHref: '../../tr/snake-jack/privacy/' },
  { file: 'pulsar-jack/index.html', game: 'Pulsar Jack', lang: 'en', privacy: false, switchHref: '../tr/pulsar-jack/' },
  { file: 'pulsar-jack/privacy/index.html', game: 'Pulsar Jack', lang: 'en', privacy: true, switchHref: '../../tr/pulsar-jack/privacy/' },
  { file: 'tr/snake-jack/index.html', game: 'Snake Jack', lang: 'tr', privacy: false, switchHref: '../../snake-jack/' },
  { file: 'tr/snake-jack/privacy/index.html', game: 'Snake Jack', lang: 'tr', privacy: true, switchHref: '../../../snake-jack/privacy/' },
  { file: 'tr/pulsar-jack/index.html', game: 'Pulsar Jack', lang: 'tr', privacy: false, switchHref: '../../pulsar-jack/' },
  { file: 'tr/pulsar-jack/privacy/index.html', game: 'Pulsar Jack', lang: 'tr', privacy: true, switchHref: '../../../pulsar-jack/privacy/' },
];

async function source(file) {
  return readFile(path.join(root, file), 'utf8');
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

test('root is a bilingual selector for both support centers, not a game host', async () => {
  const html = await source('index.html');
  assert.match(html, /<html\s+lang="en"/i);
  assert.match(html, /Snake Jack/);
  assert.match(html, /Pulsar Jack/);
  assert.match(html, /href="snake-jack\/"/);
  assert.match(html, /href="pulsar-jack\/"/);
  assert.match(html, /href="tr\/snake-jack\/"/);
  assert.match(html, /href="tr\/pulsar-jack\/"/);
  assert.doesNotMatch(html, /href="(?:\.\/)?tr\/"/i);
  assert.doesNotMatch(html, />\s*Play online\s*</i);
});

for (const route of routes) {
  test(`${route.file} has the correct language, identity, navigation, and switch`, async () => {
    const html = await source(route.file);
    assert.match(html, new RegExp(`<html\\s+lang="${route.lang}"`, 'i'));
    assert.match(html, new RegExp(`<h1[^>]*>[^<]*${route.game}`, 'i'));
    assert.match(html, /mailto:cuneyterem8@gmail\.com/i);
    assert.match(html, />\s*(?:Support|Destek)\s*</i);
    assert.match(html, />\s*(?:Privacy|Gizlilik)\s*</i);
    assert.match(html, new RegExp(`href="${route.switchHref.replaceAll('/', '\\/')}"`, 'i'));
    assert.match(html, />\s*(?:Türkçe|English)\s*</i);
  });
}

test('Snake Jack support copy documents gameplay, local progress, purchase, and diagnostic details', async () => {
  for (const file of ['snake-jack/index.html', 'tr/snake-jack/index.html']) {
    const html = await source(file);
    assert.match(html, /gameplay|oynanış/i);
    assert.match(html, /local progress|yerel ilerleme/i);
    assert.match(html, /snake_product1/);
    assert.match(html, /10(?:,|\.)000 (?:credits|kredi)/i);
    assert.match(html, /device model|cihaz modeli/i);
    assert.match(html, /iOS version|iOS sürümü/i);
    assert.match(html, /issue description|sorun açıklaması/i);
  }
});

test('Pulsar Jack support copy preserves device-only analytics and optional 20,000 credits', async () => {
  for (const file of ['pulsar-jack/index.html', 'tr/pulsar-jack/index.html']) {
    const html = await source(file);
    assert.match(html, /SessionAnalytics/);
    assert.match(html, /device-only|yalnızca cihazda/i);
    assert.match(html, /optional|isteğe bağlı/i);
    assert.match(html, /20(?:,|\.)000 (?:credits|kredi)/i);
    assert.match(html, /device model|cihaz modeli/i);
    assert.match(html, /iOS version|iOS sürümü/i);
    assert.match(html, /issue description|sorun açıklaması/i);
  }
});

test('English privacy policies make separate complete no-collection disclosures', async () => {
  for (const game of ['snake-jack', 'pulsar-jack']) {
    const html = await source(`${game}/privacy/index.html`);
    assert.match(html, /does not collect personal data/i);
    assert.match(html, /no user accounts/i);
    assert.match(html, /no advertising trackers/i);
    assert.match(html, /no remote analytics/i);
    assert.match(html, /transaction identifiers[^.]*remain on the device/i);
    assert.match(html, /Apple processes App Store purchases under Apple(?:'|’|&#39;)s terms/i);
    assert.match(html, /support email is used only to respond/i);
    assert.match(html, /Effective date:\s*2026-07-15/i);
    assert.match(html, /Developer:\s*Cüneyt Erem/i);
  }
});

test('Turkish privacy policies independently make the same complete disclosures', async () => {
  for (const game of ['snake-jack', 'pulsar-jack']) {
    const html = await source(`tr/${game}/privacy/index.html`);
    assert.match(html, /kişisel veri toplamaz/i);
    assert.match(html, /kullanıcı hesabı yoktur/i);
    assert.match(html, /reklam takipçisi yoktur/i);
    assert.match(html, /uzaktan analiz yoktur/i);
    assert.match(html, /işlem kimlikleri[^.]*cihazda kalır/i);
    assert.match(html, /Apple[^.]*App Store satın alımlarını[^.]*işler/i);
    assert.match(html, /destek e-postası[^.]*yalnızca[^.]*yanıtlamak için/i);
    assert.match(html, /Yürürlük tarihi:\s*2026-07-15/i);
    assert.match(html, /Geliştirici:\s*Cüneyt Erem/i);
  }
});

test('Pulsar privacy calls SessionAnalytics device-only gameplay history', async () => {
  const english = await source('pulsar-jack/privacy/index.html');
  const turkish = await source('tr/pulsar-jack/privacy/index.html');
  assert.match(english, /SessionAnalytics[^.]*device-only gameplay history/i);
  assert.match(turkish, /SessionAnalytics[^.]*yalnızca cihazda tutulan oyun geçmiş/i);
});

test('all pages are static, local-resource-only, and tracker-free', async () => {
  const htmlFiles = ['index.html', ...routes.map(({ file }) => file)];
  for (const file of htmlFiles) {
    const html = await source(file);
    assert.doesNotMatch(html, /<script\b/i, `${file} must not execute JavaScript`);
    assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i, `${file} must not load remote styles or fonts`);
    assert.doesNotMatch(html, /cookie banner|google analytics|segment\.com|mixpanel|facebook pixel/i);
    assert.match(html, /<meta\s+name="viewport"/i);
  }

  const allFiles = await walk(root);
  const relative = allFiles.map((file) => path.relative(root, file).replaceAll('\\', '/'));
  assert.equal(relative.some((file) => /(?:phaser|vite|bundle|dist\/|game-container)/i.test(file)), false);
  const text = (await Promise.all(allFiles
    .filter((file) => !file.startsWith(path.join(root, 'tests')))
    .filter((file) => /\.(?:html|css|md)$/i.test(file))
    .map((file) => readFile(file, 'utf8')))).join('\n');
  assert.doesNotMatch(text, /game-container|>\s*Play online\s*</i);
});

test('shared CSS supplies responsive, keyboard-visible, 44px touch targets', async () => {
  const css = await source('assets/site.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /--accent:/);
  assert.match(css, /--snake-accent:/);
  assert.match(css, /--pulsar-accent:/);
  assert.doesNotMatch(css, /@import|url\(\s*["']?https?:\/\//i);
});
