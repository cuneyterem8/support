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

const rootAllowedHrefs = new Set([
  '#main', './', 'assets/site.css', 'snake-jack/', 'tr/snake-jack/', 'pulsar-jack/', 'tr/pulsar-jack/',
]);

function allowedHrefsFor(file) {
  if (file === 'index.html') return rootAllowedHrefs;
  const route = routes.find((candidate) => candidate.file === file);
  assert.ok(route, `missing route contract for ${file}`);
  const directory = path.posix.dirname(file);
  const depth = directory === '.' ? 0 : directory.split('/').length;
  const rootPrefix = '../'.repeat(depth) || './';
  return new Set([
    '#main',
    rootPrefix,
    `${rootPrefix}assets/site.css`,
    route.supportHref,
    route.privacyHref,
    route.switchHref,
    'mailto:cuneyterem8@gmail.com',
  ]);
}

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

function parseAttributes(raw, file, tagName) {
  const attributes = [];
  let cursor = 0;
  while (cursor < raw.length) {
    while (/\s/.test(raw[cursor] ?? '')) cursor += 1;
    if (cursor >= raw.length) break;
    if (raw[cursor] === '/') {
      cursor += 1;
      continue;
    }

    const nameStart = cursor;
    while (cursor < raw.length && !/[\s=/]/.test(raw[cursor])) cursor += 1;
    const name = raw.slice(nameStart, cursor).toLowerCase();
    assert.ok(name, `${file} contains a malformed attribute on <${tagName}>`);
    while (/\s/.test(raw[cursor] ?? '')) cursor += 1;

    let value;
    if (raw[cursor] === '=') {
      cursor += 1;
      while (/\s/.test(raw[cursor] ?? '')) cursor += 1;
      assert.ok(cursor < raw.length, `${file} attribute ${name} is missing a value`);
      const quote = raw[cursor] === '"' || raw[cursor] === "'" ? raw[cursor] : undefined;
      if (quote) {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < raw.length && raw[cursor] !== quote) cursor += 1;
        assert.ok(cursor < raw.length, `${file} attribute ${name} has an unterminated quoted value`);
        value = raw.slice(valueStart, cursor);
        cursor += 1;
      } else {
        const valueStart = cursor;
        while (cursor < raw.length && !/\s/.test(raw[cursor])) cursor += 1;
        value = raw.slice(valueStart, cursor);
      }
    }
    attributes.push({ name, value });
  }
  return attributes;
}

function tokenizeStartTags(html, file) {
  const tags = [];
  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    if (open === -1) break;
    if (html.startsWith('<!--', open)) {
      const commentEnd = html.indexOf('-->', open + 4);
      assert.notEqual(commentEnd, -1, `${file} contains an unterminated comment`);
      cursor = commentEnd + 3;
      continue;
    }

    const marker = html[open + 1];
    if (marker === '/' || marker === '!' || marker === '?') {
      const declarationEnd = html.indexOf('>', open + 2);
      assert.notEqual(declarationEnd, -1, `${file} contains an unterminated declaration`);
      cursor = declarationEnd + 1;
      continue;
    }

    const nameMatch = html.slice(open + 1).match(/^([a-z][a-z\d:-]*)/i);
    if (!nameMatch) {
      cursor = open + 1;
      continue;
    }
    const name = nameMatch[1].toLowerCase();
    const attributesStart = open + 1 + nameMatch[1].length;
    let quote;
    let end = attributesStart;
    for (; end < html.length; end += 1) {
      const character = html[end];
      if (quote) {
        if (character === quote) quote = undefined;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '>') {
        break;
      }
    }
    assert.ok(end < html.length, `${file} contains an unterminated <${name}> tag`);
    tags.push({
      name,
      attributes: parseAttributes(html.slice(attributesStart, end), file, name),
    });
    cursor = end + 1;
  }
  return tags;
}

const allowedAttributes = new Map([
  ['html', new Set(['lang'])],
  ['head', new Set()],
  ['meta', new Set(['charset', 'name', 'content'])],
  ['title', new Set()],
  ['link', new Set(['rel', 'href'])],
  ['body', new Set(['class'])],
  ['a', new Set(['class', 'href', 'lang', 'hreflang', 'aria-current'])],
  ['header', new Set(['class'])],
  ['main', new Set(['id', 'class'])],
  ['footer', new Set(['class'])],
  ['section', new Set(['class', 'aria-label', 'aria-labelledby'])],
  ['article', new Set(['class'])],
  ['nav', new Set(['class', 'aria-label'])],
  ['h1', new Set(['id'])],
  ['h2', new Set()],
  ['p', new Set(['class'])],
  ['div', new Set(['class', 'aria-hidden'])],
  ['strong', new Set()],
  ['code', new Set()],
  ['br', new Set()],
]);

function assertStaticHtmlSafe(html, file, allowedHrefs) {
  assert.ok(allowedHrefs instanceof Set, `${file} must have an explicit href allowlist`);
  for (const tag of tokenizeStartTags(html, file)) {
    const tagAttributes = allowedAttributes.get(tag.name);
    assert.ok(tagAttributes, `${file} contains disallowed <${tag.name}> content`);
    const seen = new Set();
    for (const attribute of tag.attributes) {
      assert.equal(seen.has(attribute.name), false, `${file} contains duplicate ${attribute.name} on <${tag.name}>`);
      seen.add(attribute.name);
      assert.doesNotMatch(attribute.name, /^on/i, `${file} contains inline event handler ${attribute.name}`);
      assert.notEqual(attribute.name, 'style', `${file} must not use inline style attributes`);
      assert.ok(tagAttributes.has(attribute.name), `${file} contains disallowed ${attribute.name} on <${tag.name}>`);
      if (attribute.name === 'href') {
        assert.ok(allowedHrefs.has(attribute.value), `${file} href is not explicitly allowed: ${attribute.value}`);
      }
    }
    if (tag.name === 'a') assert.ok(seen.has('href'), `${file} anchor is missing href`);
    if (tag.name === 'link') {
      const rel = tag.attributes.find((attribute) => attribute.name === 'rel')?.value;
      assert.equal(rel, 'stylesheet', `${file} may use link only for its local stylesheet`);
    }
  }
}

function legacyGuardAllows(html) {
  try {
    assert.doesNotMatch(html, /<(?:script|iframe|form|audio|video|img|picture|source|track|canvas|object|embed)\b/i);
    assert.doesNotMatch(html, /\b(?:src|srcset|poster|data)\s*=\s*["']\s*(?:https?:)?\/\//i);
    for (const href of hrefs(html)) {
      if (href === 'mailto:cuneyterem8@gmail.com') continue;
      assert.doesNotMatch(href, /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i);
    }
    return true;
  } catch {
    return false;
  }
}

function assertStaticCssSafe(css, file) {
  assert.doesNotMatch(css, /@import/i, `${file} must not import CSS resources`);
  assert.doesNotMatch(css, /(?:javascript\s*:|expression\s*\()/i, `${file} must not execute CSS expressions or JavaScript URLs`);
  assert.doesNotMatch(css, /url\(\s*["']?\s*(?:https?:|\/\/|data:)/i, `${file} must not load external or embedded CSS resources`);
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
    assertStaticHtmlSafe(html, file, allowedHrefsFor(file));
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

const legacyBypasses = [
  { name: 'unquoted external link href', html: '<a href=https://attacker.invalid>External</a>' },
  { name: 'inline event handler', html: '<p onmouseover=alert(1)>Event</p>' },
  { name: 'inline style remote URL', html: '<p style="background:url(//attacker.invalid/pixel)">Style</p>' },
  { name: 'meta refresh redirect', html: '<meta http-equiv=refresh content="0;url=https://attacker.invalid">' },
];

for (const mutation of legacyBypasses) {
  test(`resource guard rejects legacy bypass: ${mutation.name}`, async () => {
    const html = (await source('index.html')).replace('</body>', `${mutation.html}</body>`);
    assert.equal(legacyGuardAllows(html), true, 'mutation must demonstrate a real bypass in the previous guard');
    assert.throws(() => assertStaticHtmlSafe(html, mutation.name, rootAllowedHrefs));
  });
}

const forbiddenHtmlMutations = [
  ['quoted event handler', '<p onclick="alert(1)">Event</p>'],
  ['unquoted event handler', '<p onfocus=alert(1)>Event</p>'],
  ['inline style JavaScript URL', '<p style="background:url(javascript:alert(1))">Style</p>'],
  ['inline style expression', '<p style="width:expression(alert(1))">Style</p>'],
  ['inline style element import', '<style>@import "https://attacker.invalid/x.css";</style>'],
  ['inline style element URL', '<style>body{background:url(//attacker.invalid/x)}</style>'],
  ['external meta refresh', '<meta http-equiv="refresh" content="0;url=https://attacker.invalid">'],
  ['internal meta refresh', '<meta http-equiv=refresh content="0;url=snake-jack/">'],
  ['JavaScript href scheme', '<a href=javascript:alert(1)>Link</a>'],
  ['data href scheme', '<a href="data:text/html,unsafe">Link</a>'],
  ['external quoted href', '<a href="https://attacker.invalid">Link</a>'],
  ['protocol-relative href', '<a href=//attacker.invalid>Link</a>'],
  ['external src', '<div src=https://attacker.invalid/x></div>'],
  ['protocol-relative srcset', '<div srcset="//attacker.invalid/x 1x"></div>'],
  ['external action', '<div action=https://attacker.invalid></div>'],
  ['external poster', '<div poster=//attacker.invalid/x></div>'],
  ['external data', '<div data=https://attacker.invalid/x></div>'],
  ...['script', 'iframe', 'embed', 'object', 'form', 'audio', 'video', 'source', 'img']
    .map((tag) => [`disallowed ${tag} element`, `<${tag}></${tag}>`]),
];

for (const [name, mutation] of forbiddenHtmlMutations) {
  test(`resource guard rejects ${name}`, async () => {
    const html = (await source('index.html')).replace('</body>', `${mutation}</body>`);
    assert.throws(() => assertStaticHtmlSafe(html, name, rootAllowedHrefs));
  });
}

for (const [name, mutation] of [
  ['CSS import', '@import "https://attacker.invalid/x.css";'],
  ['external CSS URL', 'body{background:url(https://attacker.invalid/x)}'],
  ['protocol-relative CSS URL', 'body{background:url(//attacker.invalid/x)}'],
  ['CSS JavaScript URL', 'body{background:url(javascript:alert(1))}'],
  ['CSS expression', 'body{width:expression(alert(1))}'],
]) {
  test(`stylesheet guard rejects ${name}`, () => {
    assert.throws(() => assertStaticCssSafe(mutation, name));
  });
}

test('shared CSS supplies responsive, keyboard-visible, 44px touch targets', async () => {
  const css = await source('assets/site.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /--accent:/);
  assert.match(css, /--snake-accent:/);
  assert.match(css, /--pulsar-accent:/);
  assertStaticCssSafe(css, 'assets/site.css');

  const touchRule = css.match(/\.touch-link\s*\{([^}]*)\}/i);
  assert.ok(touchRule, 'mail/content links need an explicit touch-link rule');
  assert.match(touchRule[1], /display:\s*inline-flex/);
  assert.match(touchRule[1], /min-height:\s*44px/);
  assert.match(css, /\.touch-link:focus-visible\s*\{[^}]*outline:/i);
});
