import { readFileSync, readdirSync } from 'node:fs';

const redundantNavigation = /\bawait\s+(\w+)\.reload\([^;]*?\);\s*await\s+loginAndEnterWorld\(\s*\1\s*,/g;
const countRedundantNavigations = source => [...source.matchAll(redundantNavigation)].length;

test.each([
    ["await page.reload();\nawait loginAndEnterWorld(page, credentials);", 1],
    ["await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);", 1],
    ["await first.reload(); await loginAndEnterWorld(second, credentials);", 0],
    ["await page.reload(); await inspectOfflineState(page); await loginAndEnterWorld(page, credentials);", 0],
    ["await loginAndEnterWorld(page, credentials);", 0],
    ["await page.reload();", 0]
])('navigation guard only flags adjacent same-page reload/login pairs: %s', (source, count) => {
    expect(countRedundantNavigations(source)).toBe(count);
});

test('fresh-login QA leaves navigation and its failure scope to the login helper', () => {
    const offenders = readdirSync('tests/e2e').filter(name => name.endsWith('.js'))
        .map(name => ({ name, count: countRedundantNavigations(readFileSync(`tests/e2e/${name}`, 'utf8')) }))
        .filter(entry => entry.count > 0);
    expect(offenders).toEqual([]);
});
