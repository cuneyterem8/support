import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const routes = [
  { file: 'snake-jack/index.html', game: 'Snake Jack', lang: 'en', privacy: false, supportHref: './', privacyHref: 'privacy/', switchHref: '../tr/snake-jack/', switchLang: 'tr' },
  { file: 'snake-jack/privacy/index.html', game: 'Snake Jack', lang: 'en', privacy: true, supportHref: '../', privacyHref: './', switchHref: '../../tr/snake-jack/privacy/', switchLang: 'tr' },
  { file: 'pulsar-jack/index.html', game: 'Pulsar Jack', lang: 'en', privacy: false, supportHref: './', privacyHref: 'privacy/', switchHref: '../tr/pulsar-jack/', switchLang: 'tr' },
  { file: 'pulsar-jack/privacy/index.html', game: 'Pulsar Jack', lang: 'en', privacy: true, supportHref: '../', privacyHref: './', switchHref: '../../tr/pulsar-jack/privacy/', switchLang: 'tr' },
  { file: 'tr/snake-jack/index.html', game: 'Snake Jack', lang: 'tr', privacy: false, supportHref: './', privacyHref: 'privacy/', switchHref: '../../snake-jack/', switchLang: 'en' },
  { file: 'tr/snake-jack/privacy/index.html', game: 'Snake Jack', lang: 'tr', privacy: true, supportHref: '../', privacyHref: './', switchHref: '../../../snake-jack/privacy/', switchLang: 'en' },
  { file: 'tr/pulsar-jack/index.html', game: 'Pulsar Jack', lang: 'tr', privacy: false, supportHref: './', privacyHref: 'privacy/', switchHref: '../../pulsar-jack/', switchLang: 'en' },
  { file: 'tr/pulsar-jack/privacy/index.html', game: 'Pulsar Jack', lang: 'tr', privacy: true, supportHref: '../', privacyHref: './', switchHref: '../../../pulsar-jack/privacy/', switchLang: 'en' },
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

function attribute(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return match?.[1];
}

function navigationAnchors(html) {
  const navigation = html.match(/<nav\s+class="site-nav"[^>]*>([\s\S]*?)<\/nav>/i);
  assert.ok(navigation, 'page must expose one site-nav navigation landmark');
  return [...navigation[1].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
    attributes: match[1],
    href: attribute(match[1], 'href'),
    text: match[2].replace(/<[^>]+>/g, '').trim(),
  }));
}

function hrefs(html) {
  return [...html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2]);
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
    const labels = route.lang === 'en'
      ? { support: 'Support', privacy: 'Privacy', language: 'Türkçe' }
      : { support: 'Destek', privacy: 'Gizlilik', language: 'English' };
    const anchors = navigationAnchors(html);
    assert.equal(anchors.length, 3, 'navigation must contain only support, privacy, and language switch links');
    assert.deepEqual(anchors.map(({ href, text }) => ({ href, text })), [
      { href: route.supportHref, text: labels.support },
      { href: route.privacyHref, text: labels.privacy },
      { href: route.switchHref, text: labels.language },
    ]);
    assert.equal(attribute(anchors[0].attributes, 'aria-current'), route.privacy ? undefined : 'page');
    assert.equal(attribute(anchors[1].attributes, 'aria-current'), route.privacy ? 'page' : undefined);
    assert.match(attribute(anchors[2].attributes, 'class') ?? '', /(?:^|\s)language-switch(?:\s|$)/);
    assert.equal(attribute(anchors[2].attributes, 'lang'), route.switchLang);
    assert.equal(attribute(anchors[2].attributes, 'hreflang'), route.switchLang);

    const mailAnchors = [...html.matchAll(/<a\b([^>]*)href="mailto:cuneyterem8@gmail\.com"([^>]*)>/gi)];
    assert.equal(mailAnchors.length, 1, 'each route must expose one support email link');
    const mailClasses = attribute(`${mailAnchors[0][1]} ${mailAnchors[0][2]}`, 'class') ?? '';
    assert.match(mailClasses, /(?:^|\s)touch-link(?:\s|$)/, 'support email link must use the 44px touch-link class');
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
    assert.doesNotMatch(html, /<(?:script|iframe|form|audio|video|img|picture|source|track|canvas|object|embed)\b/i, `${file} must not embed executable, form, or hosted media content`);
    assert.doesNotMatch(html, /\b(?:src|srcset|poster|data)\s*=\s*["']\s*(?:https?:)?\/\//i, `${file} must not load remote media or executable resources`);
    assert.doesNotMatch(html, /cookie banner|google analytics|segment\.com|mixpanel|facebook pixel/i);
    assert.match(html, /<meta\s+name="viewport"/i);

    for (const href of hrefs(html)) {
      if (href === 'mailto:cuneyterem8@gmail.com') continue;
      assert.doesNotMatch(href, /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i, `${file} may link only to the support email or an internal relative target: ${href}`);
      if (href.startsWith('#')) {
        assert.match(html, new RegExp(`\\bid="${href.slice(1)}"`, 'i'), `${file} fragment must target an element`);
        continue;
      }
      const cleanHref = href.split(/[?#]/, 1)[0];
      const target = path.resolve(root, path.dirname(file), cleanHref, cleanHref.endsWith('/') ? 'index.html' : '');
      assert.ok(target === root || target.startsWith(`${root}${path.sep}`), `${file} link must stay inside the repository`);
      await readFile(target);
    }
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
  assert.doesNotMatch(css, /@import|url\(\s*["']?\s*(?:https?:)?\/\//i);

  const touchRule = css.match(/\.touch-link\s*\{([^}]*)\}/i);
  assert.ok(touchRule, 'mail/content links need an explicit touch-link rule');
  assert.match(touchRule[1], /display:\s*inline-flex/);
  assert.match(touchRule[1], /min-height:\s*44px/);
  assert.match(css, /\.touch-link:focus-visible\s*\{[^}]*outline:/i);
});
