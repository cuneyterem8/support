import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const rootAllowedHrefs = new Set([
  '#main', './', 'assets/site.css',
  'istanbul-tea-journey/', 'tr/istanbul-tea-journey/',
]);

const policyLinks = new Set([
  'https://policies.google.com/privacy',
  'https://policies.google.com/technologies/partner-sites',
  'https://reportaproblem.apple.com/',
  'https://www.apple.com/legal/privacy/data/en/game-center/',
  'https://www.apple.com/legal/privacy/',
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
  'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
]);
const teaRoutes = ['en', 'tr'].flatMap(lang => ['support', 'privacy', 'terms'].map(page => {
  const sub = page === 'support' ? '' : `/${page}`;
  const directory = `${lang === 'tr' ? 'tr/' : ''}istanbul-tea-journey${sub}`;
  const prefix = '../'.repeat(directory.split('/').length);
  return { file: `${directory}/index.html`, lang, page,
    supportHref: sub ? '../' : './', privacyHref: page === 'privacy' ? './' : `${sub ? '../' : ''}privacy/`,
    termsHref: page === 'terms' ? './' : `${sub ? '../' : ''}terms/`,
    switchHref: `${prefix}${lang === 'en' ? 'tr/' : ''}istanbul-tea-journey${sub}/` };
}));
function allowedHrefsFor(file) {
  if (file === 'index.html') return rootAllowedHrefs;
  const route = teaRoutes.find((candidate) => candidate.file === file);
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
    ...(route.termsHref ? [route.termsHref, ...policyLinks] : []),
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

test('English-first home links only to the active game', async () => {
  const html = await source('index.html');
  assert.match(html, /<html\s+lang="en"/i);
  assert.match(html, /Istanbul Tea Journey/);
  assert.match(html, /href="istanbul-tea-journey\/"/);
  assert.match(html, /href="tr\/istanbul-tea-journey\/"/);
  assert.doesNotMatch(html, /Snake Jack|Pulsar Jack|Blast the Squares|Kareleri Patlat/);
  const files = (await walk(root)).map(file => path.relative(root, file).replaceAll('\\', '/'));
  assert.equal(files.some(file => /(?:snake-jack|pulsar-jack|blast-the-squares)\//.test(file)), false);
});

test('Istanbul Tea Journey pages retain bilingual navigation, publisher identity and accurate service disclosures', async () => {
  for (const route of teaRoutes) {
    const html = await source(route.file);
    assert.match(html,new RegExp(`<html lang="${route.lang}"`));
    assert.match(html,/Mihriban Erem/);assert.match(html,/Cüneyt Erem/);
    assert.match(html,/10(?:,|\.)000/);assert.match(html,/StoreKit|Apple/);
    const anchors=navigationAnchors(html);
    assert.deepEqual(anchors.map(a=>a.href),[route.supportHref,route.privacyHref,route.termsHref,route.switchHref]);
    assert.equal(anchors.filter(a=>attribute(a.attributes,'aria-current')==='page').length,1);
    assert.equal(attribute(anchors[3].attributes,'lang'),route.lang==='en'?'tr':'en');
    assert.equal((html.match(/href="mailto:cuneyterem8@gmail.com"/g)??[]).length,1);
    if(route.page==='privacy'){
      assert.match(html,/GitHub/);assert.match(html,/IP/);
      assert.match(html,route.lang==='en'?/transaction identifiers remain on the device/:/işlem kimlikleri cihazda kalır/);
      assert.match(html,route.lang==='en'?/support correspondence/i:/yazışmalar/i);
    }
    assert.doesNotMatch(html,/AdMob-enabled|reklamla ödül katlanır|Game Center keeps|1,000 Gold|1\.000 Altın/);
  }
});

test('all pages are static, local-resource-only, and tracker-free', async () => {
  const htmlFiles = ['index.html', ...teaRoutes.map(({file})=>file)];
  for (const file of htmlFiles) {
    const html = await source(file);
    assertStaticHtmlSafe(html, file, allowedHrefsFor(file));
    assert.doesNotMatch(html, /cookie banner|google analytics|segment\.com|mixpanel|facebook pixel/i);
    assert.match(html, /<meta\s+name="viewport"/i);

    for (const href of hrefs(html)) {
      if (href === 'mailto:cuneyterem8@gmail.com') continue;
      if (file.includes('istanbul-tea-journey/') && policyLinks.has(href)) continue;
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
  ['internal meta refresh', '<meta http-equiv=refresh content="0;url=istanbul-tea-journey/">'],
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
  assert.match(css, /\.tea-theme/);
  assertStaticCssSafe(css, 'assets/site.css');

  const touchRule = css.match(/\.touch-link\s*\{([^}]*)\}/i);
  assert.ok(touchRule, 'mail/content links need an explicit touch-link rule');
  assert.match(touchRule[1], /display:\s*inline-flex/);
  assert.match(touchRule[1], /min-height:\s*44px/);
  assert.match(css, /\.touch-link:focus-visible\s*\{[^}]*outline:/i);
});
