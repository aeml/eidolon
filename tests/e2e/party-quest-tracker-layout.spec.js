import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';

// This fixture renders HTML/CSS only. Do not compete with an active native
// dungeon session for the GPU or silently turn it into a second game client.
test.use({ launchOptions: {
    executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),
    args: ['--disable-gpu', '--disable-webgl', '--disable-software-rasterizer']
} });

for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    test(`party quest strip stays reachable above healing controls at ${viewport.width}px`, async ({ page }, testInfo) => {
        // UI-only fixture: actual styles/components, no game scene or earned quest claim.
        await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize(viewport);
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            if (window.game || document.createElement('canvas').getContext('webgl')) {
                throw new Error('Tracker layout fixture must not start a game or WebGL renderer');
            }
            const { QuestUI } = await import('/src/ui/QuestUI.js');
            const { SocialUI } = await import('/src/ui/SocialUI.js');
            document.getElementById('start-screen').style.display = 'none';
            document.getElementById('chat-box').style.display = 'flex';
            const ctx = { isMobile: false, getLastPlayer: () => ({ id: 'tracker-layout', quests: [] }) };
            const quest = new QuestUI(ctx), social = new SocialUI(ctx);
            const summary = Array.from({ length: 8 }, (_, index) => ({
                id: `daily_layout_${index}`, badge: 'Daily', title: `Recover the scattered crystal fragments ${index}`,
                progressLabel: `${index} / 10`, hint: 'Return to the town quest giver', progressPct: index * 10
            }));
            quest.loadTrackingPreferences();
            quest.trackedQuestKeys = new Set(summary.map(item => item.id));
            quest.renderObjectivesPanel(summary);
            social.updateParty({ partyId: 'layout-only', leaderId: 'tracker-layout', allReady: true,
                members: ['Fighter', 'Cleric', 'Wizard', 'Rogue'].map((name, index) => ({
                id: index ? `ally-${index}` : 'tracker-layout', name, class: name, level: 60,
                hp: 100, maxHp: 100, role: index === 0 ? 'tank' : index === 1 ? 'healer' : 'damage',
                ready: true, isLeader: index === 0
            })) });
            window.__partyTrackerLayout = { quest, social };
        });
        const list = page.getByRole('region', { name: 'Tracked quests', exact: true });
        await expect(list).toBeVisible();
        await expect(list.locator('.objective-entry')).toHaveCount(8);
        const tracker = await page.locator('#objectives-panel').boundingBox();
        const roster = await page.locator('#party-panel').boundingBox();
        expect(tracker.height).toBeLessThanOrEqual(66);
        expect(tracker.y + tracker.height).toBeLessThan(roster.y);
        expect(await list.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        await list.focus();
        await page.keyboard.press('End');
        await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        await list.locator('.objective-entry').last().hover();
        const stripBox = await list.boundingBox(), lastBox = await list.locator('.objective-entry').last().boundingBox();
        expect(Math.abs(lastBox.y - stripBox.y)).toBeLessThanOrEqual(1);
        expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(stripBox.y + stripBox.height + 1);
        await expect(list.locator('.objective-entry').last()).toHaveAttribute('title', /fragments 7 · 7 \/ 10/);
        await page.getByRole('button', { name: 'Select Cleric for healing', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Select Cleric for healing', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'Ready Check', exact: true }).click();
        // The earned Verdant screenshot showed the four-member header and tank
        // row scrolled out after support selection. Visible DOM alone is not
        // enough: all health bars must remain inside the actual panel bounds.
        for (const name of ['Rogue', 'Wizard', 'Fighter', 'Cleric']) {
            await page.getByRole('button', { name: `Select ${name} for healing`, exact: true }).click();
            const panel = await page.locator('#party-panel').boundingBox();
            const header = await page.locator('.party-panel__header').boundingBox();
            expect(header.y).toBeGreaterThanOrEqual(panel.y);
            for (const bar of await page.locator('#party-list .party-hp-bar').all()) {
                const box = await bar.boundingBox();
                expect(box.y).toBeGreaterThanOrEqual(panel.y);
                expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
            }
            const chat = await page.locator('#chat-box').boundingBox();
            expect(panel.y + panel.height).toBeLessThan(chat.y);
        }
        await page.screenshot({ path: testInfo.outputPath('party-quest-strip.png') });
        for (const count of [5, 10]) {
            await page.evaluate(count => {
                const social = window.__partyTrackerLayout.social;
                social.updateParty({ partyId: 'layout-only', leaderId: 'tracker-layout',
                    members: Array.from({ length: count }, (_, index) => ({
                        id: index ? `ally-${index}` : 'tracker-layout', name: `Raider ${index + 1}`,
                        class: index % 2 ? 'Cleric' : 'Fighter', level: 70,
                        hp: 80, maxHp: 100, role: index % 2 ? 'healer' : 'tank', ready: true,
                        isLeader: index === 0
                    })) });
            }, count);
            await expect(page.locator('.party-panel__title')).toHaveText(`RAID · ${count}`);
            const panel = await page.locator('#party-panel').boundingBox();
            const chat = await page.locator('#chat-box').boundingBox();
            expect(chat).not.toBeNull();
            expect(panel.y + panel.height).toBeLessThan(chat.y);
            for (const bar of await page.locator('#party-list .party-hp-bar').all()) {
                const box = await bar.boundingBox();
                expect(box.y).toBeGreaterThan(panel.y);
                expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height - 2);
            }
            const last = page.getByRole('button', { name: `Select Raider ${count} for healing`, exact: true });
            await last.click();
            await expect(last).toHaveAttribute('aria-pressed', 'true');
            await expect(page.locator('#party-panel')).toHaveJSProperty('scrollTop', 0);
            await page.locator('.party-support-mode').click();
            await expect(last).toHaveAttribute('aria-pressed', 'false');
            await page.screenshot({ path: testInfo.outputPath(`raid-roster-${count}.png`) });
            if (count === 5 && viewport.width === 1280) {
                const projection = await page.evaluate(async () => {
                    const THREE = await import('three');
                    const { projectGroundOffsetInPage, planVisibleGroundStepInPage } = await import('/tests/groundInputProjection.js');
                    const canvas = document.createElement('canvas');
                    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1';
                    document.body.appendChild(canvas);
                    const position = new THREE.Vector3(100016.02238666322, .5, 19782.617271018567);
                    const camera = new THREE.OrthographicCamera(-15 * 1280 / 720, 15 * 1280 / 720, 15, -15, .1, 2000);
                    camera.position.copy(position).add(new THREE.Vector3(100, 100, 100));
                    camera.lookAt(position); camera.updateMatrixWorld(true);
                    window.game = { player: { position }, renderSystem: { camera },
                        inputManager: { groundPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) } };
                    const original = { dx: -10.811994311824531, dz: 5.205840854374439 };
                    const blocked = projectGroundOffsetInPage({ deltaX: original.dx, deltaZ: original.dz, allowScaling: false });
                    const owner = document.elementFromPoint(blocked.x, blocked.y)?.closest('#party-panel')?.id;
                    const step = planVisibleGroundStepInPage(original);
                    const strict = step && projectGroundOffsetInPage({ deltaX: step.dx, deltaZ: step.dz, allowScaling: false });
                    delete window.game; canvas.remove();
                    return { owner, blocked: blocked.canvas, original, step, strict };
                });
                expect(projection.owner).toBe('party-panel');
                expect(projection.blocked).toBe(false);
                expect(projection.step.dx).toBeCloseTo(projection.original.dx * .75);
                expect(projection.step.dz).toBeCloseTo(projection.original.dz * .75);
                expect(projection.strict).toMatchObject({ canvas: true, scale: 1 });
            }
        }
        await page.evaluate(() => window.__partyTrackerLayout.social.setPartyPanelVisible(false));
        expect((await page.locator('#objectives-panel').boundingBox()).height).toBeGreaterThan(66);
        await page.evaluate(() => {
            window.__partyTrackerLayout.social.setPartyPanelVisible(true);
            window.__partyTrackerLayout.quest.renderObjectivesPanel([]);
        });
        await expect(page.locator('#objectives-panel')).toBeHidden();
    });
}
