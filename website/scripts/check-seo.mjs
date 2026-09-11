import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Static publishing checks for this site's authored HTML, not a replacement
// for Lighthouse, Schema.org validation, or an audit of the deployed domain.
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const html = await readFile(join(root, 'index.html'), 'utf8');
const canonical = 'https://eidolonrealms.com/';
const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
assert(title?.includes('Eidolon') && title.includes('RPG'), 'Use a descriptive page title');
assert.equal([...html.matchAll(/<h1\b/g)].length, 1, 'Use exactly one primary heading');
assert.match(html, /<h1\b[^>]*>[\s\S]*?Eidolon[\s\S]*?<\/h1>/);
let previousLevel = 0;
for (const [, level] of html.matchAll(/<h([1-6])\b/g)) {
  assert(Number(level) <= previousLevel + 1, 'Do not skip heading levels');
  previousLevel = Number(level);
}
const tags = [...html.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(([tag]) => tag);
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const findTag = (key, value) => {
  const matches = tags.filter(tag => attribute(tag, key) === value);
  assert.equal(matches.length, 1, `Expected one ${value} tag`);
  return matches[0];
};
assert.equal(attribute(findTag('rel', 'canonical'), 'href'), canonical);
assert.equal(attribute(findTag('property', 'og:url'), 'content'), canonical);
assert.equal(attribute(findTag('property', 'og:title'), 'content'), title);
assert.equal(attribute(findTag('name', 'twitter:title'), 'content'), title);
const description = attribute(findTag('name', 'description'), 'content');
assert(description?.length > 50, 'Write a useful description');
assert(!/noindex|nofollow/i.test(attribute(findTag('name', 'robots'), 'content')));
assert.match(html, /<html\s+lang="en"/);
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(match => match[1].includes('application/ld+json'));
assert.equal(scripts.length, 1, 'Keep structured data in one JSON-LD graph');
assert.match(scripts[0][1], /type="application\/ld\+json"/);
const schema = JSON.parse(scripts[0][2]);
assert.equal(schema['@context'], 'https://schema.org');
const graph = schema['@graph'];
const entityIds = new Set(graph.map(entity => entity['@id']));
assert.equal(entityIds.size, graph.length, 'Schema IDs must be unique');
for (const type of ['WebSite', 'WebPage', 'VideoGame', 'Person']) {
  assert.equal(graph.filter(entity => entity['@type'] === type).length, 1, `Missing ${type}`);
}
function checkReferences(value) {
  if (!value || typeof value !== 'object') return;
  if (value['@id']) assert(entityIds.has(value['@id']), `Unresolved schema reference: ${value['@id']}`);
  Object.values(value).forEach(checkReferences);
}
checkReferences(schema);
const page = graph.find(entity => entity['@type'] === 'WebPage');
assert.equal(page.name, title);
assert.equal(page.description, description);
assert.equal(page.url, canonical);
const game = graph.find(entity => entity['@type'] === 'VideoGame');
assert.equal(game.potentialAction.target, game.url);
await access(join(root, new URL(game.screenshot).pathname));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const [, target] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  if (target.startsWith('#')) assert(ids.includes(target.slice(1)), `Missing anchor: ${target}`);
  if (target.startsWith('/')) await access(join(root, target === '/' ? 'index.html' : target));
}
for (const [, sources] of html.matchAll(/\bsrcset="([^"]+)"/g)) {
  for (const source of sources.split(',')) await access(join(root, source.trim().split(/\s+/)[0]));
}
for (const [image] of html.matchAll(/<img\b[^>]*>/g)) {
  assert(/\balt="[^"]*"/.test(image), 'Images need alt attributes');
  assert(/\bwidth="\d+"/.test(image) && /\bheight="\d+"/.test(image), 'Reserve image dimensions');
}
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
assert(robots.includes(`Sitemap: ${canonical}sitemap.xml`));
assert(!/^Disallow:\s*\/\s*$/m.test(robots));
assert((await readFile(join(root, 'sitemap.xml'), 'utf8')).includes(`<loc>${canonical}</loc>`));
assert.match(await readFile(join(root, '404.html'), 'utf8'), /name="robots"\s+content="noindex"/);
console.log('SEO checks passed: headings, metadata, JSON-LD references, crawl files, anchors and image assets.');
