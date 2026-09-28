import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

async function setupMenu(page, isMobile = false) {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async (isMobile) => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        document.getElementById('start-screen').style.display = 'none';
        // Touch emulation alone does not change Chromium's desktop user agent.
        // Match the real phone boot class even in a wide landscape viewport.
        if (isMobile) document.body.classList.add('mobile-mode');
        const ui = new UIManager(isMobile);
        const input = new InputManager({}, {});
        // Reproduce the live multiplayer binding; Enter on buttons must not
        // move focus into chat before the browser activates the button.
        input.subscribe('onChat', () => ui.chatInput.focus());
        input.subscribe('onEscape', () => ui.handleEscape());
        ui.toggleChat(true);
        const sent = [];
        window.__raidMenuFixture = { ui, input, sent };
        window.game = {
            network: { send: (type, payload) => sent.push({ type, payload }) },
            socket: { send: (message) => sent.push(JSON.parse(message)) }
        };
    }, isMobile);
}

for (const [width, height, isMobile] of [[1280, 720, false], [390, 844, true], [844, 390, true]]) {
    test.describe(`family level choices ${width}x${height}`, () => {
        test.use({ viewport: { width, height }, isMobile, hasTouch: isMobile });
        test('finale briefing explains roles and personal epilogue without entering the raid', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await setupMenu(page, isMobile);
            await page.evaluate(() => window.__raidMenuFixture.ui.showDungeonMenu({
                playerLevel: 100, isLeader: true, darkRealmOpen: true
            }));
            const menu = page.locator('#dungeon-menu');
            await menu.getByRole('tab', { name: 'Raids', exact: true }).click();
            const briefing = menu.locator('[data-finale-preparation]');
            await briefing.locator('summary').click();
            for (const paragraph of await briefing.locator('p').all()) {
                await paragraph.scrollIntoViewIfNeeded();
                await expect(paragraph).toBeInViewport();
                expect(await paragraph.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
            }
            await expect(briefing).toContainText('does not resurrect');
            await expect(briefing).toContainText('personally click Complete Quest');
            await expect(menu.getByRole('button', { name: 'Enter Dark Realm Raid', exact: true })).toBeEnabled();
            await expect(page.locator('#btn-close-dungeon-menu')).toBeInViewport();
            await menu.screenshot({ path: testInfo.outputPath('finale-briefing.png') });
            expect(await page.evaluate(() => window.__raidMenuFixture.sent)).toEqual([]);
            expect(failures, failures.join('\n')).toEqual([]);
        });
        test('Nexus selection explains its guardian route and personal court unlock', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await setupMenu(page, isMobile);
            await page.evaluate(() => window.__raidMenuFixture.ui.showDungeonMenu({
                playerLevel: 100, isLeader: true, canEnterUmbralNexus: true
            }));
            const menu = page.locator('#dungeon-menu');
            await menu.locator('#dungeon-type-select').selectOption('umbral_nexus');
            await menu.locator('#dungeon-preparation summary').click();
            const briefing = menu.locator('#nexus-preparation');
            await expect(briefing).toBeVisible();
            await expect(briefing).toContainText('Dissonant Herald → Null Architect → Eidolon Devourer');
            await expect(briefing).toContainText('MEMORY FRACTURE');
            await expect(briefing).toContainText('Each character claims personally');
            await briefing.locator('p').last().scrollIntoViewIfNeeded();
            const bounds = await briefing.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
            await page.screenshot({ path: testInfo.outputPath('nexus-personal-unlock.png') });
            await menu.locator('#dungeon-type-select').selectOption('verdant_bastion_catacombs');
            await expect(briefing).toBeHidden();
            expect(await page.evaluate(() => window.__raidMenuFixture.sent)).toEqual([]);
            expect(failures, failures.join('\n')).toEqual([]);
        });
        test('elemental briefings disclose guardian, ritual and personal claims without starting a raid', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await setupMenu(page, isMobile);
            await page.evaluate(() => window.__raidMenuFixture.ui.showDungeonMenu({
                playerLevel: 100, isLeader: true,
                elementalRaidAccess: Object.fromEntries(['earth', 'water', 'fire', 'air'].map(element => [`${element}_crystal_raid`, true]))
            }));
            const menu = page.locator('#dungeon-menu');
            await menu.getByRole('tab', { name: 'Raids', exact: true }).click();
            for (const [element, boss] of [['earth', 'Graven Colossus'], ['water', 'Tidebound Tyrant'],
                ['fire', 'Ashen Imperator'], ['air', 'Tempest Sovereign']]) {
                const card = menu.locator(`[data-raid-type="${element}_crystal_raid"]`);
                const details = card.locator('.adventure-preparation');
                await expect(details.locator('p').first()).toBeHidden();
                await details.locator('summary').click();
                await expect(details.locator('p').first()).toBeVisible();
                await expect(details).toContainText(boss);
                await expect(details).toContainText('Maelin channels automatically');
                await expect(details).toContainText('Each character claims personally');
                const bounds = await details.boundingBox();
                expect(bounds.x).toBeGreaterThanOrEqual(0);
                expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
                await details.locator('p').last().scrollIntoViewIfNeeded();
                if (element !== 'air') await details.locator('summary').click();
            }
            await page.screenshot({ path: testInfo.outputPath('elemental-briefing.png') });
            expect(await page.evaluate(() => window.__raidMenuFixture.sent)).toEqual([]);
            expect(failures, failures.join('\n')).toEqual([]);
        });
        test('Guide routes to real recruitment and party readiness without submitting actions', async ({page}) => {
            await setupMenu(page, isMobile);
            await page.evaluate(() => {
                const {ui, sent} = window.__raidMenuFixture;
                ui.social.onGroupFinder = payload => sent.push({type: 'group_finder', payload});
                ui.lastPlayerRef = {id: 'self', level: 100};
                ui.updateParty({partyId: 'party', leaderId: 'self', members: [{id: 'self', name: 'Hero', hp: 100, maxHp: 100}]});
                ui.showDungeonMenu({playerLevel: 100, isLeader: true});
            });
            await page.locator('#dungeon-type-select').selectOption('tempest_spire');
            await page.locator('#dungeon-preparation summary').click();
            await page.locator('#dungeon-preparation').getByRole('button', {name: 'Find companions'}).click();
            await expect(page.locator('#dungeon-menu')).toHaveCount(0);
            const groups = page.locator('#tab-panel-groups');
            await expect(groups).toBeVisible();
            await expect(groups).toContainText('Loading the recruitment catalogue');
            await page.evaluate(() => window.__raidMenuFixture.ui.social.groupFinder.update({activities: [
                {id: 'world', name: 'Exploration', minLevel: 1}, {id: 'tempest_spire', name: 'Tempest Spire', minLevel: 70}
            ], listings: []}));
            await expect(groups.getByLabel('Activity filter')).toHaveValue('tempest_spire');
            await groups.getByRole('button', {name: 'Prepare my listing'}).click();
            await expect(groups.getByLabel('Minimum level')).toHaveValue('70');
            await expect(groups.getByLabel('Listing type')).toBeFocused();
            expect(await page.evaluate(() => window.__raidMenuFixture.sent)).toEqual([{type: 'group_finder', payload: {action: 'list'}}]);
            await page.evaluate(() => {
                const {ui} = window.__raidMenuFixture;
                ui.social.close();
                ui.showDungeonMenu({playerLevel: 100, isLeader: true});
                // Phone wraps party details in another intentional disclosure.
                document.querySelectorAll('#dungeon-menu details').forEach(el => { el.open = true; });
                ui.updateParty({partyId: 'party', leaderId: 'self', readyCheckActive: true,
                    members: [{id: 'self', name: 'Hero', hp: 100, maxHp: 100, ready: true}]});
            });
            await expect(page.locator('#dungeon-party-readiness')).toContainText('1/1 ready');
            await page.getByRole('button', {name: 'Open party & readiness'}).click();
            await expect(page.locator('#dungeon-menu')).toHaveCount(0);
            await expect(page.locator(isMobile ? '#phone-party-panel' : '#party-panel')).toBeVisible();
            expect(await page.evaluate(() => window.__raidMenuFixture.ui.dungeonPreparationRefresh)).toBeNull();
        });
        test('Bastion preparation is operable without hiding the entry controls', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await setupMenu(page, isMobile);
            await page.evaluate(() => window.__raidMenuFixture.ui.showDungeonMenu({
                playerLevel: 30, isLeader: true, hasInstance: false
            }));
            const preparation = page.locator('#dungeon-preparation');
            const summary = preparation.locator('summary');
            await expect(summary).toHaveText('Prepare for Verdant Bastion Catacombs');
            await expect(preparation.locator(':scope > p')).toBeHidden();
            await summary.scrollIntoViewIfNeeded();
            if (isMobile) await summary.tap();
            else {
                await summary.focus();
                await page.keyboard.press('Enter');
            }
            await expect(preparation.locator(':scope > p')).toBeVisible();
            if (!isMobile) {
                await expect(summary).toBeFocused();
                await page.keyboard.press('Space');
                await expect(preparation.locator(':scope > p')).toBeHidden();
                await page.keyboard.press('Space');
                await expect(preparation.locator(':scope > p')).toBeVisible();
                await expect(summary).toBeFocused();
            }
            await expect(preparation).toContainText('solo entry is allowed but a balanced party is recommended');
            await expect(preparation).toContainText('Recruitment never posts or starts a run automatically');
            const sharedAdvice = page.locator('#dungeon-party-state-box > .adventure-preparation');
            for (const text of ['Strong Fighter (Strength)', 'Agile Rogue (Dexterity)', 'Brilliant Wizard (Intelligence)',
                'Wise Cleric (Wisdom)', 'Uncommon/Rare', 'Lanternhold']) await expect(sharedAdvice).toContainText(text);
            if (isMobile) {
                await expect(page.locator('body')).toHaveClass(/mobile-mode/);
                expect(await preparation.locator(':scope > p').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
            }
            expect(await page.locator('#dungeon-menu').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
            await preparation.screenshot({ path: testInfo.outputPath('bastion-preparation.png') });
            if (isMobile) {
                // A short landscape reading area may need scrolling. Verify
                // the final line can clear both the header and fixed footer.
                expect(await preparation.locator(':scope > p').evaluate(element => {
                    element.scrollIntoView({ block: 'end', behavior: 'instant' });
                    const text = element.firstChild;
                    const range = document.createRange();
                    range.setStart(text, text.length - 'automatically.'.length);
                    range.setEnd(text, text.length);
                    const line = range.getBoundingClientRect();
                    const viewport = element.closest('.adventure-scroll').getBoundingClientRect();
                    return line.top >= viewport.top && line.bottom <= viewport.bottom;
                })).toBe(true);
                await page.screenshot({ path: testInfo.outputPath('bastion-preparation-reading-end.png') });
            }
            const enter = page.locator('#btn-enter-dungeon');
            await enter.scrollIntoViewIfNeeded();
            await expect(enter).toBeInViewport();
            await expect(enter).toBeEnabled();
            if (isMobile) await enter.tap(); else await enter.click();
            expect(await page.evaluate(() => window.__raidMenuFixture.sent.at(-1))).toEqual({
                type: 'enter_dungeon', payload: { dungeonType: 'verdant_bastion_catacombs', difficulty: 'normal', runLevel: 30 }
            });
            await expect(page.locator('#chat-box')).toBeVisible();
            expect(failures, failures.join('\n')).toEqual([]);
        });
        test('new runs show their family floor and send the selected level', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await setupMenu(page, isMobile);
            await page.evaluate(() => window.__raidMenuFixture.ui.showDungeonMenu({
                playerLevel: 100, isLeader: true, hasInstance: false,
                dungeonEntryLevels: { molten_core: 70, tempest_spire: 70, abyssal_well: 60 }
            }));
            for (const [type, minimum] of [['molten_core', 70], ['tempest_spire', 70], ['abyssal_well', 60]]) {
                await page.locator('#dungeon-type-select').selectOption(type);
                expect(await page.locator('#dungeon-run-level-select option').evaluateAll(options => options.map(option => Number(option.value))))
                    .toEqual([30, 40, 50, 60, 70, 80, 90, 100].filter(level => level >= minimum));
                await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
                await expect(page.locator('#dungeon-unlock-note')).toContainText('your level selection is valid');
            }
            await page.locator('#dungeon-run-level-select').selectOption('60');
            const enter = page.locator('#btn-enter-dungeon');
            await enter.scrollIntoViewIfNeeded();
            await expect(enter).toBeInViewport();
            expect(await page.locator('#dungeon-menu').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
            await page.screenshot({ path: testInfo.outputPath('family-level-choices.png') });
            if (isMobile) await enter.tap(); else await enter.click();
            expect(await page.evaluate(() => window.__raidMenuFixture.sent.at(-1))).toEqual({
                type: 'enter_dungeon', payload: { dungeonType: 'abyssal_well', difficulty: 'normal', runLevel: 60 }
            });
            await expect(page.locator('#chat-box')).toBeVisible();
            expect(failures, failures.join('\n')).toEqual([]);
        });
    });
}

test('populated raid choices preserve story gates, party authority and responsive controls', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await setupMenu(page);
    for (const [width, height] of [[1440, 1000], [1280, 600], [390, 844], [320, 640]]) {
        await page.setViewportSize({ width, height });
        for (const state of ['sealed', 'ready', 'follower']) {
            await page.evaluate((state) => {
                const unlocked = state !== 'sealed';
                window.__raidMenuFixture.ui.showDungeonMenu({
                    playerLevel: 100, isLeader: state !== 'follower', hasInstance: false,
                    crystalsRestored: unlocked, darkRealmOpen: unlocked,
                    elementalRaidAccess: Object.fromEntries(['earth', 'water', 'fire', 'air'].map((element) => [`${element}_crystal_raid`, unlocked])),
                    quests: []
                });
            }, state);
            const menu = page.locator('#dungeon-menu');
            await expect(menu).toBeVisible();
            await expect(menu.locator('.elemental-raid-card')).toHaveCount(4);
            await menu.getByRole('tab', { name: 'Raids', exact: true }).click();
            await expect(page.locator('#adventure-dungeons')).toBeHidden();
            await expect(page.locator('#adventure-raids')).toBeVisible();
            const enter = menu.getByRole('button', { name: 'Enter Dark Realm Raid', exact: true });
            if (state === 'ready') await expect(enter).toBeEnabled();
            else await expect(enter).toBeDisabled();
            await menu.screenshot({ path: testInfo.outputPath(`raids-${state}-${width}.png`) });
            const bounds = await menu.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
            expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
            await enter.scrollIntoViewIfNeeded();
            await expect(page.locator('#btn-close-dungeon-menu')).toBeInViewport();
            await page.locator('#btn-close-dungeon-menu').click();
            await expect(menu).toHaveCount(0);
        }
    }
    await expect(page.locator('#chat-box')).toBeVisible();
    expect(failures, failures.join('\n')).toEqual([]);
});

test('adventure tabs keep keyboard focus and send the selected dungeon or raid action', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await setupMenu(page);
    const open = async (playerLevel = 100) => page.evaluate((playerLevel) => {
        const opener = document.getElementById('chat-input');
        opener.focus();
        window.__raidMenuFixture.ui.showDungeonMenu({
            playerLevel, isLeader: true, hasInstance: false,
            elementalRaidAccess: playerLevel >= 100 ? { earth_crystal_raid: true } : {}, quests: []
        });
    }, playerLevel);
    await open();
    const close = page.locator('#btn-close-dungeon-menu');
    const dungeons = page.getByRole('tab', { name: 'Dungeons', exact: true });
    const raids = page.getByRole('tab', { name: 'Raids', exact: true });
    await expect(close).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dungeons).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(raids).toBeFocused();
    await expect(raids).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(dungeons).toBeFocused();
    await page.keyboard.press('End');
    await expect(raids).toBeFocused();
    const earth = page.locator('[data-raid-type="earth_crystal_raid"]');
    await page.keyboard.press('Tab');
    const preparation = page.locator('#dungeon-party-state-box > .adventure-preparation');
    await expect(preparation.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(preparation).toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    await expect(preparation.getByRole('button', { name: 'Open party & readiness' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(earth.getByRole('button', { name: 'Form Elemental Raid' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(earth.getByRole('button', { name: 'Enter Rootheart Sanctum' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(earth.getByRole('button', { name: 'Find companions' })).toBeFocused();
    const briefing = earth.locator('.adventure-preparation');
    await page.keyboard.press('Tab');
    await expect(briefing.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(briefing).toHaveAttribute('open', '');
    // Recruitment stays available even when this character cannot enter yet.
    const recruitment = page.locator('#adventure-raids').getByRole('button', { name: 'Find companions' });
    for (let i = 1; i < await recruitment.count(); i++) {
        await page.keyboard.press('Tab');
        await expect(recruitment.nth(i)).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    for (let i = await recruitment.count() - 1; i >= 0; i--) {
        await page.keyboard.press('Shift+Tab');
        if (i === 0) {
            await expect(briefing.locator('summary')).toBeFocused();
            await page.keyboard.press('Shift+Tab');
        }
        await expect(recruitment.nth(i)).toBeFocused();
    }
    await page.keyboard.press('Shift+Tab');
    await expect(earth.getByRole('button', { name: 'Enter Rootheart Sanctum' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dungeon-menu')).toHaveCount(0);
    await expect(page.locator('#chat-input')).toBeFocused();
    expect(await page.evaluate(() => window.__raidMenuFixture.sent)).toEqual([
        { type: 'raid_convert', payload: { raidType: 'earth_crystal_raid' } },
        { type: 'raid_enter', payload: { raidType: 'earth_crystal_raid' } }
    ]);

    await open();
    await page.locator('#dungeon-type-select').selectOption('abyssal_well');
    await page.locator('#dungeon-run-level-select').selectOption('60');
    await page.locator('#diff-btn-heroic').click();
    await expect(page.locator('#diff-btn-heroic')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#dungeon-menu').screenshot({ path: testInfo.outputPath('dungeon-heroic.png') });
    await page.locator('#btn-enter-dungeon').click();
    expect(await page.evaluate(() => window.__raidMenuFixture.sent.at(-1))).toEqual({
        type: 'enter_dungeon', payload: { dungeonType: 'abyssal_well', difficulty: 'heroic', runLevel: 60 }
    });
    await open(1);
    await raids.click();
    await expect(page.getByText('Your first crystal raid awaits at level 30.', { exact: false })).toBeVisible();
    await expect(page.locator('.elemental-raid-card')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#dungeon-menu')).toHaveCount(0);
    await expect(page.locator('#chat-box')).toBeVisible();
    await expect(page.locator('#chat-input')).toBeFocused();
    expect(await page.evaluate(() => window.__raidMenuFixture.ui.isEscMenuOpen)).toBe(false);
    expect(failures, failures.join('\n')).toEqual([]);
});
