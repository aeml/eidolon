import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height, mobile] of [[1280, 800, false], [390, 844, true]]) test.describe(`Lore book ${width}`, () => {
    test.use({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
    test('earned memories remain searchable, readable and stable through refresh and reopening', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        // Controlled saved-state presentation, not an earned campaign receipt.
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { getChronicleInvestigation } = await import('/src/core/ChronicleInvestigation.js');
            const investigation = getChronicleInvestigation('chronicle_earth_returning_scar');
            const house = getChronicleInvestigation('chronicle_earth_keepers_house');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(mobile);
            const quests = [
                { id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell Below', accepted: true, completed: true,
                    description: 'Ilyra heard a missing note beneath Lanternhold.', lore: 'The bell carries the memory of a covenant in danger.' },
                { id: house.id, category: 'chronicle', chapter: 2, title: house.title, type: 'INVESTIGATE', accepted: true, completed: true, investigationMask: 1, lore: house.summary },
                { id: investigation.id, category: 'chronicle', chapter: 3, title: investigation.title, type: 'INVESTIGATE', accepted: true,
                    count: 1, maxCount: investigation.sites.length, investigationMask: 2, objectiveText: 'Read the altered roots at the stone circle.' },
                { id: 'chronicle_15_dark_king', category: 'chronicle', chapter: 15, title: 'UNSEEN THRONE', lore: 'UNSEEN ENDING', count: 0, maxCount: 1 }
            ];
            ui.lastPlayerRef = { id: 'book-reader', quests }; ui.showHUD(); ui.quest.toggleJournal();
            window.__loreBook = { ui, quests, saved: JSON.stringify(quests) };
        }, mobile);
        const activate = async locator => mobile ? locator.tap() : locator.click();
        const book = page.getByRole('region', { name: 'Lore book', exact: true });
        await activate(page.getByRole('button', { name: 'Lore Book', exact: true }));
        await expect(book).toBeVisible();
        await expect(book).toContainText('What I’m doing now');
        await expect(book).toContainText('Story so far');
        await expect(book).not.toContainText('UNSEEN ENDING');
        await expect(book).not.toContainText('UNSEEN THRONE');
        await page.screenshot({ path: testInfo.outputPath('book-overview.png') });

        const search = book.getByRole('searchbox', { name: 'Search your memories' });
        await search.fill('Mara');
        const record = book.getByRole('navigation', { name: 'Recorded memories' }).getByRole('button').filter({ hasText: "Mara's diary" });
        await activate(record);
        const article = book.locator('article');
        await expect(article).toContainText('No living thing should have to kneel to be sheltered.');
        await article.locator('p').last().scrollIntoViewIfNeeded();
        await expect(article.locator('p').last()).toBeInViewport();
        expect(await article.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('book-memory.png') });

        await search.focus();
        await page.evaluate(() => {
            const { ui, quests } = window.__loreBook;
            window.__loreBook.selected = ui.quest.loreBook.selected;
            ui.quest.updateJournal(quests);
        });
        await expect(search).toBeFocused(); await expect(search).toHaveValue('Mara');
        await activate(page.locator('#btn-close-journal'));
        await page.evaluate(() => window.__loreBook.ui.quest.toggleJournal());
        await expect(book).toBeVisible(); await expect(search).toHaveValue('Mara');
        expect(await page.evaluate(() => window.__loreBook.ui.quest.loreBook.selected === window.__loreBook.selected)).toBe(true);

        await search.fill('a phrase never recorded');
        await expect(article).toContainText('No matching memories');
        await search.fill('');
        await activate(book.getByRole('button', { name: 'Open current quest', exact: true }));
        await expect(book).toBeHidden();
        await expect(page.locator('.chronicle-journal')).toContainText('Read the altered roots');
        await activate(page.locator('#btn-close-journal'));
        const tracked = page.locator('#objectives-list button.objective-entry').first();
        if (mobile) await tracked.tap();
        else { await tracked.focus(); await page.keyboard.press('Enter'); }
        await expect(page.locator('[data-journal-view="story"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-quest-track="chronicle_earth_returning_scar"]')).toBeFocused();
        expect(await page.evaluate(() => JSON.stringify(window.__loreBook.quests) === window.__loreBook.saved)).toBe(true);
        await page.evaluate(() => window.__loreBook.ui.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
