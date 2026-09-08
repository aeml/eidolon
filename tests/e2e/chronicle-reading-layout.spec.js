import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

test('a later expanded field record keeps its reading position across journal rebuilds', async ({ page, context, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    // Explicit layout-only fixture. No claim of earned discoveries or rewards.
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { chronicleInvestigations } = await import('/src/data/chronicleInvestigations.generated.js');
        const quests = [chronicleInvestigations[0], chronicleInvestigations[2]].map((chapter, index) => ({
            id: chapter.id, type: 'INVESTIGATE', category: 'chronicle',
            title: chapter.title, target: chapter.title, chapter: 2 + index * 5, accepted: true, completed: false,
            objectiveText: chapter.directions,
            count: 1, maxCount: 1, investigationMask: 1
        }));
        document.body.classList.add('mobile-mode');
        document.getElementById('start-screen').style.display = 'none';
        const ui = new UIManager(true);
        ui.lastPlayerRef = { id: 'reading-layout', level: 60, quests };
        ui.showHUD(); ui.toggleChat(true); ui.quest.toggleJournal();
        window.__readingLayout = { ui, quests };
    });
    const journal = page.locator('#journal-list');
    const records = journal.locator('details[data-discovery-id]');
    await expect(records).toHaveCount(2);
    await records.last().locator('summary').scrollIntoViewIfNeeded();
    await records.last().locator('summary').tap();
    await expect(records.last()).toHaveAttribute('open', '');
    expect(await records.first().getAttribute('open')).toBeNull();
    // Set the reader at the bottom of a real multi-paragraph field record.
    // Unlike scrollIntoViewIfNeeded, this cannot pass merely because the first
    // edge of an oversized paragraph happens to intersect the scrollport.
    await records.last().locator(':scope > :last-child').evaluate(el => el.scrollIntoView({ block: 'end' }));
    const scroll = await journal.evaluate(el => el.scrollTop);
    expect(scroll).toBeGreaterThan(100);
    await records.last().evaluate(el => { window.__readingLayout.record = el; });
    for (let update = 0; update < 3; update++) {
        await page.evaluate(() => {
            const { ui, quests } = window.__readingLayout;
            ui.quest.updateJournal(quests);
        });
        await expect(records.last()).toHaveAttribute('open', '');
        expect(await records.last().evaluate(el => el === window.__readingLayout.record)).toBe(true);
        expect(await journal.evaluate(el => el.scrollTop)).toBeCloseTo(scroll, 0);
    }
    // A real finger remains down while an ordinary quest update arrives.
    // Retaining only `open` and scroll values is insufficient if the control
    // receiving this gesture is replaced before touch release.
    const summary = records.first().locator('summary');
    await summary.scrollIntoViewIfNeeded();
    expect(await records.first().getAttribute('open')).toBeNull();
    const box = await summary.boundingBox();
    const cdp = await context.newCDPSession(page);
    try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
            { id: 89, x: box.x + box.width / 2, y: box.y + box.height / 2 }
        ] });
        await page.evaluate(() => {
            const { ui, quests } = window.__readingLayout;
            ui.quest.updateJournal(quests);
        });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
        await cdp.detach();
    }
    await expect(records.first()).toHaveAttribute('open', '');
    await page.locator('#btn-close-journal').tap();
    await expect(page.locator('#quest-journal')).not.toBeVisible();
    await page.evaluate(() => window.__readingLayout.ui.characterPreview.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
