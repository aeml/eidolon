import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const questSource = readFileSync(new URL('../../server/internal/game/quests.go', import.meta.url), 'utf8');
const dropTable = questSource.match(/var chronicleDropSources = [^\n]+\{([\s\S]*?)\n\}/)?.[1] || '';
const expectedNames = [...dropTable.matchAll(/"([^"]+)":\s*\{/g)].map(match => match[1]).sort();
const darkNames = JSON.parse(readFileSync(new URL('../../server/internal/game/content/dark-realm-chronicle.json', import.meta.url), 'utf8'))
    .filter(chapter => chapter.type === 'COLLECT').map(chapter => chapter.item);

for (const width of [1440, 390]) {
test(`all Chronicle bag icons decode at inventory size without overflow (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const names = await page.evaluate(async () => {
        const { PROCEDURAL_ITEM_ICON_DEFINITIONS } = await import('/src/art/ProceduralIcons.js');
        const { UIManager } = await import('/src/ui/UIManager.js');
        const names = Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.quest);
        const fixture = document.createElement('section');
        fixture.id = 'quest-icon-fixture';
        Object.assign(fixture.style, { position: 'fixed', zIndex: '99999', inset: '20px 20px auto 20px', padding: '16px', background: '#111923', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '16px', color: '#eee', font: '13px sans-serif' });
        for (const name of names) {
            const item = document.createElement('div');
            Object.assign(item.style, { display: 'grid', justifyItems: 'center', gap: '10px', minWidth: '0', textAlign: 'center' });
            const image = document.createElement('img');
            image.alt = name;
            image.width = 48;
            image.height = 48;
            image.src = UIManager.prototype.getItemIconPath({ id: 'chronicle-item-fixture', name, type: 'RELIC', slot: 'relic', stack: 4 });
            item.append(image, document.createTextNode(name));
            fixture.appendChild(item);
        }
        document.body.appendChild(fixture);
        await Promise.all([...fixture.querySelectorAll('img')].map(image => image.decode()));
        return names;
    });
    expect(expectedNames).toHaveLength(8);
    expect(names).toHaveLength(8);
    expect(names.sort()).toEqual(expectedNames);
    expect(darkNames).toHaveLength(4);
    for (const name of darkNames) expect(names).toContain(name);
    const fixture = page.locator('#quest-icon-fixture');
    await expect(fixture.locator('img')).toHaveCount(8);
    expect(await fixture.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    expect(await fixture.locator('img').evaluateAll(images => new Set(images.map(image => image.src)).size)).toBe(8);
    expect(await fixture.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const name of names) await expect(fixture.getByRole('img', { name, exact: true })).toBeInViewport();
    await fixture.screenshot({ path: testInfo.outputPath('chronicle-inventory-icons.png') });
});
}

test('selected quests stay accessible in a bounded scrollable tracker', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { QuestUI } = await import('/src/ui/QuestUI.js');
        const quests = [{ id: 'chronicle_fixture', category: 'chronicle', chapter: 2, title: 'Seeds of the First Grove', target: 'Verdant Memory Seed', maxCount: 4, count: 2, accepted: true },
            ...Array.from({ length: 8 }, (_, index) => ({ id: `daily_fixture_${index}`, title: `Selected contract ${index + 1}`, target: 'Skeleton', maxCount: 10, count: index, accepted: true }))];
        const ui = new QuestUI({ getLastPlayer: () => ({ level: 100, quests }) });
        ui.updateJournal(quests);
        ui.questJournal.style.display = 'flex';
        ui.questJournal.style.zIndex = '9999';
        ui.questJournal.style.top = '20px';
        ui.questJournal.style.left = 'auto';
        ui.questJournal.style.right = '20px';
        ui.questJournal.style.transform = 'none';
        ui.objectivesPanel.style.zIndex = '9999';
        document.getElementById('start-screen').style.display = 'none';
    });
    for (let index = 0; index < 8; index++) await page.locator(`[data-quest-track="daily_fixture_${index}"]`).check();
    await expect(page.locator('#objectives-list .objective-entry')).toHaveCount(9);
    const dimensions = await page.locator('#objectives-list').evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
    expect(dimensions.height).toBeGreaterThan(0);
    expect(dimensions.content).toBeGreaterThan(dimensions.height);
    await page.locator('#objectives-panel').screenshot({ path: testInfo.outputPath('selected-quest-tracker.png') });
    await page.locator('#objectives-list').hover();
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.locator('#objectives-list').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('#objectives-list .objective-entry').last()).toBeInViewport();
});
