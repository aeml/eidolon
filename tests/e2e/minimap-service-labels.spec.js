import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('town radar retains quest markers with readable unclipped service names', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { Minimap } = await import('/src/ui/Minimap.js');
        const { ATLAS_CATEGORIES } = await import('/src/ui/AtlasNavigation.js');
        document.getElementById('start-screen').style.display = 'none';
        const minimap = new Minimap(200);
        const player = { id: 'radar-review', position: { x: 0, z: 200 },
            quests: [{ id: 'daily-ready', accepted: true, completed: false, count: 1, maxCount: 1 }] };
        const engine = { player, uiManager: {}, worldMap: { navigation: { filters: new Set(Object.keys(ATLAS_CATEGORIES)) } } };
        minimap.setGameEngine(engine);
        const text = minimap.ctx.fillText.bind(minimap.ctx);
        const drawn = [];
        minimap.ctx.fillText = (...args) => { drawn.push(args[0]); return text(...args); };
        window.__radarReview = { minimap, player, engine, drawn };
    });
    for (const [name, x, z] of [['arrival', 0, 200], ['market', -22, 185], ['guide', 0, 240]]) {
        const result = await page.evaluate(({ x, z }) => {
            const q = window.__radarReview; q.player.position = { x, z }; q.drawn.length = 0;
            q.minimap.update(q.player, []);
            return { labels: q.minimap.serviceLabelLayout, drawn: q.drawn };
        }, { x, z });
        expect(result.labels.length).toBeGreaterThan(1);
        expect(result.drawn).toContain('?');
        for (const a of result.labels) {
            for (const px of [a.x, a.x + a.width]) for (const py of [a.y, a.y + a.height]) expect(Math.hypot(px - 100, py - 100)).toBeLessThanOrEqual(91);
            for (const b of result.labels) if (a.id !== b.id) expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y).toBe(false);
        }
        await page.locator('#minimap-canvas').screenshot({ path: testInfo.outputPath(`${name}.png`) });
        await testInfo.attach(name, { body: JSON.stringify(result), contentType: 'application/json' });
    }
    const filtered = await page.evaluate(() => {
        const q = window.__radarReview; q.engine.worldMap.navigation.filters.delete('services');
        q.minimap.update(q.player, []);
        const ids = q.minimap.serviceLabelLayout.map(label => label.id);
        q.engine.isMobile = true; q.drawn.length = 0; q.minimap.update(q.player, []);
        return { ids, phoneLabels: q.minimap.serviceLabelLayout, phoneDrawn: q.drawn };
    });
    expect(filtered.ids.every(id => ['story-wizard', 'quest-giver', 'resonance-portal'].includes(id))).toBe(true);
    expect(filtered.phoneLabels).toEqual([]); expect(filtered.phoneDrawn).toContain('?');
    expect(failures, failures.join('\n')).toEqual([]);
});
