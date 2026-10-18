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
        const indexedArticle = book.locator('article');
        await activate(book.getByRole('button', { name: 'People', exact: true }));
        await search.fill('Mara');
        const person = book.locator('[data-memory-id="people:mara"]');
        if (mobile) await person.tap();
        else { await person.focus(); await page.keyboard.press('Enter'); }
        await expect(indexedArticle.getByRole('heading', { name: 'Mara', exact: true })).toBeFocused();
        const readingScroll = await page.evaluate(() => {
            const list = window.__loreBook.ui.quest.journalList;
            list.scrollTop = Math.min(240, list.scrollHeight - list.clientHeight);
            return list.scrollTop;
        });
        expect(readingScroll).toBeGreaterThan(0);
        await page.evaluate(() => {
            const { ui, quests } = window.__loreBook;
            ui.quest.updateJournal([...quests, { id: 'chronicle_saved_name', completed: true, title: 'A signed account', lore: 'Mara Fen signed the account.' }]);
        });
        await expect(indexedArticle.getByRole('heading', { name: 'Mara Fen', exact: true })).toBeFocused();
        await expect(search).toHaveValue('Mara');
        expect(await page.evaluate(() => window.__loreBook.ui.quest.journalList.scrollTop)).toBe(readingScroll);
        await indexedArticle.getByRole('heading', { name: 'Mara Fen', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('book-updated-reading-focus.jpg'), type: 'jpeg', quality: 90 });
        await page.evaluate(() => window.__loreBook.ui.quest.updateJournal(window.__loreBook.quests));
        await expect(indexedArticle.getByRole('heading', { name: 'Mara', exact: true })).toBeFocused();
        const readMemory = indexedArticle.getByRole('button', { name: "Read Mara's diary", exact: true });
        await readMemory.focus();
        await page.evaluate(() => {
            const { ui, quests } = window.__loreBook;
            ui.quest.updateJournal([...quests, { id: 'chronicle_saved_letter', completed: true, title: 'A saved letter', lore: 'Mara kept a written account.' }]);
        });
        await expect(readMemory).toBeFocused();
        await page.evaluate(() => window.__loreBook.ui.quest.updateJournal(window.__loreBook.quests));
        await activate(indexedArticle.getByRole('button', { name: "Read Mara's diary", exact: true }));
        await expect(indexedArticle.getByRole('heading', { name: "Mara's diary", exact: true })).toBeFocused();
        await expect(search).toHaveValue('');
        await indexedArticle.getByRole('button', { name: 'Return to Mara', exact: true }).focus();
        await page.evaluate(() => {
            const { ui, quests } = window.__loreBook;
            ui.quest.updateJournal([...quests, { id: 'chronicle_saved_name', completed: true, title: 'A signed account', lore: 'Mara Fen signed the account.' }]);
        });
        await expect(indexedArticle.getByRole('button', { name: 'Return to Mara Fen', exact: true })).toBeFocused();
        await page.evaluate(() => window.__loreBook.ui.quest.updateJournal(window.__loreBook.quests));
        await activate(indexedArticle.getByRole('button', { name: 'Return to Mara', exact: true }));
        await expect(search).toHaveValue('Mara');
        await expect(book.getByRole('button', { name: 'People', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await search.fill('');
        await activate(book.getByRole('button', { name: 'Places', exact: true }));
        await activate(book.locator('[data-memory-id="places:earth"]'));
        await expect(indexedArticle).toContainText("Mara's diary");
        await expect(indexedArticle).not.toContainText('UNSEEN ENDING');
        expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('book-people-places.png') });
        await activate(book.getByRole('button', { name: 'All memories', exact: true }));
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

for (const [width, mobile] of [[1280, false], [390, true]]) test.describe(`Returning lore context ${width}`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: mobile, isMobile: mobile });
    test('claimed finale and accepted contracts remain clear, linked and stable through progress updates', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        // Prepared personal receipts exercise returning UI, not earned campaign pacing.
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { getChronicleInvestigation } = await import('/src/core/ChronicleInvestigation.js');
            const optional = getChronicleInvestigation('chronicle_earth_returning_scar');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const quests = ['chronicle_10_rootheart_raid', 'chronicle_11_tidestar_raid', 'chronicle_12_ember_crown_raid', 'chronicle_13_skyglass_raid', 'chronicle_14_resonance_gate', 'chronicle_15_dark_king']
                .map(id => ({ id, category: 'chronicle', completed: true, accepted: true, title: id === 'chronicle_15_dark_king' ? 'A Letter Without a Throne' : 'A restored covenant' }));
            quests.push({ id: optional.id, title: optional.title, category: 'chronicle', legacyOptional: true, accepted: true,
                type: 'INVESTIGATE', count: 1, maxCount: optional.sites.length, investigationMask: 2 },
            { id: 'daily_patrol', title: 'Road patrol', accepted: true, count: 2, maxCount: 3, objectiveText: 'Defeat three road threats.' },
            { id: 'unaccepted_future', title: 'UNSEEN CONTRACT', accepted: false });
            const ui = new UIManager(mobile); ui.lastPlayerRef = { id: 'returning-reader', level: 1, quests: [] };
            const actions = []; ui.quest.onAcceptQuest = () => actions.push('accept'); ui.quest.onCompleteQuest = () => actions.push('claim');
            ui.showHUD(); ui.quest.toggleJournal(); ui.quest.setJournalView('lore');
            window.__returningLore = { ui, quests, actions };
        }, mobile);
        const book = page.getByRole('region', { name: 'Lore book', exact: true });
        await expect(book).toContainText('The first page awaits');
        await expect(book).not.toContainText('Your Chronicle is complete');
        await expect(book).not.toContainText('Malachar has fallen');
        await page.evaluate(() => {
            const { ui, quests } = window.__returningLore;
            ui.lastPlayerRef.level = 100; ui.lastPlayerRef.quests = quests;
            ui.quest.updateJournal(quests);
        });
        await expect(book).toContainText('Your Chronicle is complete');
        await expect(book).not.toContainText('At level 100, enter');
        await expect(book).not.toContainText('can prepare your private court raid');
        await expect(book).not.toContainText('UNSEEN CONTRACT');
        const patrol = book.getByRole('button', { name: /Road patrol/ });
        await patrol.scrollIntoViewIfNeeded(); await patrol.focus();
        await page.evaluate(() => {
            const { ui, quests } = window.__returningLore;
            quests.find(quest => quest.id === 'daily_patrol').count = 3;
            ui.quest.updateJournal(quests); window.__returningLore.saved = JSON.stringify(quests);
        });
        await expect(patrol).toBeFocused(); await expect(patrol).toContainText('Ready to turn in');
        await page.screenshot({ path: testInfo.outputPath('returning-story-and-tasks.png') });
        const navigation = book.getByRole('navigation', { name: 'Recorded memories' });
        const record = navigation.getByRole('button').last();
        await record.scrollIntoViewIfNeeded(); await record.focus();
        const memory = await record.getAttribute('data-memory-id');
        const indexScroll = await navigation.evaluate(node => node.scrollTop);
        expect(indexScroll).toBeGreaterThan(0);
        await page.evaluate(() => {
            const { ui, quests } = window.__returningLore;
            quests.push({ id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, completed: true,
                accepted: true, title: 'The Bell Below', lore: 'A personally recovered opening account.' });
            ui.quest.updateJournal(quests); window.__returningLore.saved = JSON.stringify(quests);
        });
        expect(await page.evaluate(() => document.activeElement.dataset.memoryId)).toBe(memory);
        expect(await navigation.evaluate(node => node.scrollTop)).toBeCloseTo(indexScroll, 0);
        await patrol.scrollIntoViewIfNeeded(); await patrol.focus();
        if (mobile) await patrol.tap(); else await page.keyboard.press('Enter');
        await expect(page.locator('[data-journal-view="contracts"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-quest-track="daily_patrol"]')).toBeFocused();
        expect(await page.evaluate(() => window.__returningLore.actions)).toEqual([]);
        expect(await page.evaluate(() => JSON.stringify(window.__returningLore.quests) === window.__returningLore.saved)).toBe(true);
        await page.evaluate(() => window.__returningLore.ui.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
});

for (const [width, mobile] of [[1280, false], [390, true]]) test.describe(`Lore book input continuity ${width}`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: mobile, isMobile: mobile });
    test('held navigation presses survive progress and newly earned memories', async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        // Prepared personal UI receipts, not earned campaign or save proof.
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { getChronicleInvestigation } = await import('/src/core/ChronicleInvestigation.js');
            const chapter = getChronicleInvestigation('chronicle_earth_returning_scar');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = new UIManager(mobile);
            const quests = [
                { id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell Below',
                    accepted: true, completed: true, lore: 'Lanternhold remembers its missing note.' },
                { id: chapter.id, category: 'chronicle', chapter: 2, title: chapter.title, type: 'INVESTIGATE',
                    accepted: true, count: 1, maxCount: chapter.sites.length, investigationMask: 2,
                    objectiveText: 'Read the altered roots at the stone circle.' }
            ];
            ui.lastPlayerRef = { id: 'lore-continuity-reader', quests };
            ui.showHUD(); ui.quest.toggleJournal(); ui.quest.setJournalView('lore');
            const state = window.__loreContinuity = { ui, quests, actions: [], navigations: 0 };
            ui.quest.onAcceptQuest = id => state.actions.push(['accept', id]);
            ui.quest.onCompleteQuest = id => state.actions.push(['complete', id]);
            ui.quest.onClaimQuestItem = (...args) => state.actions.push(['reward', ...args]);
            const navigate = ui.quest.setJournalView.bind(ui.quest);
            ui.quest.setJournalView = (...args) => { state.navigations++; return navigate(...args); };
        }, mobile);
        const book = page.getByRole('region', { name: 'Lore book', exact: true });
        const activate = locator => mobile ? locator.tap() : locator.click();
        const update = async mode => page.evaluate(async mode => {
            const state = window.__loreContinuity;
            if (mode === 'memory') state.quests.push({ id: 'chronicle_02_second_note', category: 'chronicle', chapter: 3,
                title: 'Another Ilyra account', accepted: true, completed: true, lore: 'Ilyra remembers another promise.' });
            else state.quests = state.quests.map(q => q.id === 'chronicle_earth_returning_scar' ? { ...q, count: q.count + 1 } : q);
            state.ui.lastPlayerRef.quests = state.quests;
            state.ui.quest.updateJournal(state.quests);
            state.saved = JSON.stringify(state.quests);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, mode);
        const pressAcrossUpdate = async (target, mode) => {
            await target.scrollIntoViewIfNeeded();
            const box = await target.boundingBox(); expect(box).toBeTruthy();
            const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            const session = mobile ? await page.context().newCDPSession(page) : null;
            try {
                if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 0 }] });
                else { await page.mouse.move(point.x, point.y); await page.mouse.down(); }
                try { await update(mode); }
                finally {
                    if (mobile) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                    else await page.mouse.up();
                }
            } finally { await session?.detach(); }
        };
        try {
            await expect(book).toBeVisible();
            const current = book.getByRole('button', { name: 'Open current quest', exact: true });
            await pressAcrossUpdate(current, 'progress');
            await expect(page.locator('[data-journal-view="story"]')).toHaveAttribute('aria-pressed', 'true');
            expect(await page.evaluate(() => window.__loreContinuity.navigations)).toBe(1);

            await activate(page.getByRole('button', { name: 'Lore Book', exact: true }));
            const beforeKeyboard = await page.evaluate(() => window.__loreContinuity.navigations);
            await current.focus(); await page.keyboard.down('Space');
            try { await update('progress'); } finally { await page.keyboard.up('Space'); }
            await expect(page.locator('[data-journal-view="story"]')).toHaveAttribute('aria-pressed', 'true');
            expect(await page.evaluate(() => window.__loreContinuity.navigations)).toBe(beforeKeyboard + 1);

            await activate(page.getByRole('button', { name: 'Lore Book', exact: true }));
            const memory = book.locator('[data-memory-id="chapter:chronicle_01_bell_below"]');
            await pressAcrossUpdate(memory, 'memory');
            await expect(book.locator('article').getByRole('heading', { name: 'The Bell Below', exact: true })).toBeFocused();
            expect(await page.evaluate(() => window.__loreContinuity.ui.quest.loreBook.selected)).toBe('chapter:chronicle_01_bell_below');
            expect(await page.evaluate(() => window.__loreContinuity.actions)).toEqual([]);
            expect(await page.evaluate(() => JSON.stringify(window.__loreContinuity.quests) === window.__loreContinuity.saved)).toBe(true);
            expect(failures, failures.join('\n')).toEqual([]);
        } finally { await page.evaluate(() => window.__loreContinuity?.ui.dispose()); }
    });
});
