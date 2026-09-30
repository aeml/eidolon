import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`duel consent stays current and counts down each second at ${viewport.width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.clock.install({ time: new Date('2026-09-30T21:00:00Z') });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { PvPUI } = await import('/src/ui/PvPUI.js');
            document.querySelectorAll('#pvp-window').forEach(element => element.remove());
            document.getElementById('start-screen').style.display = 'none';
            const ui = new PvPUI({});
            const fixture = { ui, responses: [], refreshes: 0 };
            ui.onRefresh = () => fixture.refreshes++;
            ui.onDuelRespond = (...response) => fixture.responses.push(response);
            const challenge = { id: 'original', requesterId: 'player-Alice', expiresAt: new Date(Date.now() + 30000).toISOString() };
            ui.update({ challenge });
            fixture.oldButtons = [...ui.window.querySelectorAll('[data-duel-response]')];
            ui.update({ challenge: { ...challenge, id: 'current', expiresAt: new Date(Date.now() + 30000).toISOString() } });
            window.duelConsentFixture = fixture;
        });
        const panel = page.locator('#pvp-window');
        await expect(panel).toBeVisible();
        await expect(panel).toContainText('Alice challenges you');
        const layout = await panel.locator('.pvp-card--challenge').evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { cardWidth: rect.width, overflow: element.scrollWidth > element.clientWidth,
                labelWidth: element.querySelector('strong').getBoundingClientRect().width,
                targets: [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect().height) };
        });
        expect(layout.overflow).toBe(false);
        expect(layout.labelWidth).toBeGreaterThan(layout.cardWidth * .8);
        expect(layout.targets.every(height => height >= 44)).toBe(true);
        await expect(panel).toContainText('Respond within 30s');
        await page.clock.runFor(1000);
        await expect(panel).toContainText('Respond within 29s');
        await panel.getByRole('button', { name: 'Accept', exact: true }).click();
        expect(await page.evaluate(() => window.duelConsentFixture.responses)).toEqual([['player-Alice', 'current', true]]);
        await page.evaluate(() => window.duelConsentFixture.oldButtons.forEach(button => button.click()));
        expect(await page.evaluate(() => window.duelConsentFixture.responses)).toHaveLength(1);
        await panel.screenshot({ path: testInfo.outputPath('duel-consent.png') });
        await page.clock.runFor(29000);
        await expect(panel).toContainText('Challenge expired');
        await expect(panel.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
        await expect(panel.getByRole('button', { name: 'Decline', exact: true })).toBeDisabled();
        await page.evaluate(() => window.duelConsentFixture.ui.dispose());
    });
    test(`arena waiting and restriction clocks stay readable at ${viewport.width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.clock.install({ time: new Date('2026-09-30T21:00:00Z') });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Freeze observation time before creating the fixture: layout queries
        // and screenshots must not consume part of the exact-second deadline.
        await page.clock.pauseAt(new Date('2026-09-30T21:01:00Z'));
        await page.evaluate(async () => {
            const { PvPUI } = await import('/src/ui/PvPUI.js');
            document.querySelectorAll('#pvp-window').forEach(element => element.remove());
            document.getElementById('start-screen').style.display = 'none';
            const ui = new PvPUI({});
            const fixture = { ui, requests: [], refreshes: 0 };
            ui.onQueue = (...args) => fixture.requests.push(args);
            ui.onRefresh = () => fixture.refreshes++;
            ui.toggle(true);
            ui.update({ deserterUntil: new Date(Date.now() + 30000).toISOString() });
            window.arenaClockFixture = fixture;
        });
        const panel = page.locator('#pvp-window');
        await expect(panel).toBeVisible();
        await expect(panel).toContainText('restricted for 0:30');
        const controls = panel.locator('.pvp-arena-actions');
        expect(await controls.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        for (const button of await controls.locator('button').all()) {
            await expect(button).toBeDisabled();
            expect(await button.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        }
        await page.clock.runFor(1000);
        await expect(panel).toContainText('restricted for 0:29');
        await panel.screenshot({ path: testInfo.outputPath('arena-queue-controls.png') });
        await page.clock.runFor(29000);
        await expect(controls.getByRole('button', { name: 'Queue 1v1', exact: true })).toBeEnabled();
        await controls.getByRole('button', { name: 'Queue 1v1', exact: true }).click();
        expect(await page.evaluate(() => window.arenaClockFixture.requests)).toEqual([[1]]);
        await page.evaluate(() => {
            const fixture = window.arenaClockFixture;
            fixture.ui.update({ queued: 1, queuedSeconds: 20, ratingWindow: 100, teamRating: 1000 });
            fixture.refreshes = 0;
        });
        const leave = panel.getByRole('button', { name: 'Leave Queue', exact: true });
        expect(await leave.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        await leave.focus();
        await expect(panel).toContainText('waiting 20s');
        await page.clock.runFor(1000);
        await expect(panel).toContainText('waiting 21s');
        await expect(leave).toBeFocused();
        expect(await page.evaluate(() => window.arenaClockFixture.refreshes)).toBe(0);
        await page.clock.runFor(4000);
        await expect(panel).toContainText('waiting 25s');
        expect(await page.evaluate(() => window.arenaClockFixture.refreshes)).toBe(1);
        await page.evaluate(() => {
            const { ui } = window.arenaClockFixture;
            ui.window.querySelectorAll('details').forEach(element => { element.open = true; });
            ui.update({ queued: 1, queuedSeconds: 25, ratingWindow: 150, teamRating: 1000 });
            ui.updateLeaderboard({ profiles: [{ playerId: 'player-A', rating: 1100 }] });
        });
        await expect(leave).toBeFocused();
        expect(await panel.locator('details').evaluateAll(elements => elements.every(element => element.open))).toBe(true);
        await expect(panel).toContainText('current search ±150');
        const rulesSummary = panel.locator('summary[data-pvp-action="arena-rules"]');
        await rulesSummary.focus();
        await page.evaluate(() => window.arenaClockFixture.ui.update({ queued: 1, queuedSeconds: 25, ratingWindow: 150, teamRating: 1000 }));
        await expect(rulesSummary).toBeFocused();
        await panel.screenshot({ path: testInfo.outputPath('arena-queue-wait.png') });
        await page.evaluate(() => window.arenaClockFixture.ui.toggle(false));
        await page.clock.runFor(10000);
        expect(await page.evaluate(() => window.arenaClockFixture.refreshes)).toBe(1);
        await page.evaluate(() => window.arenaClockFixture.ui.dispose());
    });
}

test('arena elimination, waiting and completed states have clear actionable feedback', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { PvPUI } = await import('/src/ui/PvPUI.js');
        const { installUIManagerFeedback } = await import('/src/ui/UIManagerFeedback.js');
        document.querySelectorAll('#pvp-window').forEach(element => element.remove());
        document.getElementById('start-screen').style.display = 'none';
        const pvp = new PvPUI({});
        Object.assign(pvp.window.style, { display: 'block', top: '20px', left: '20px', transform: 'none' });
        const match = { mode: 'arena_2v2', status: 'active', round: 1, scoreA: 0, scoreB: 0,
            teamA: ['a', 'b'], teamB: ['c', 'd'], eliminated: ['c'] };
        pvp.update({ match });
        class FeedbackFixture {}
        installUIManagerFeedback(FeedbackFixture);
        const feedback = new FeedbackFixture();
        feedback.pvp = pvp;
        feedback.createDeathScreen();
        const fixture = { pvp, feedback, match, forfeits: 0, townRespawns: 0 };
        pvp.onLeave = () => { fixture.forfeits++; };
        feedback.onRespawn = () => { fixture.townRespawns++; };
        window.pvpFeedbackFixture = fixture;
    });
    const panel = page.locator('#pvp-window');
    await expect(panel).toContainText('Standing: 2 vs 1');
    await expect(panel).toContainText('whole opposing team');
    const scoreHeight = await panel.locator('.pvp-score').evaluate(element => element.getBoundingClientRect().height);
    expect(scoreHeight).toBeLessThan(40);
    await panel.screenshot({ path: testInfo.outputPath('arena-surviving-teammate.png') });
    await page.evaluate(() => window.pvpFeedbackFixture.feedback.showDeathScreen());
    await expect(page.locator('#death-screen')).toContainText('Your teammate can still win');
    await page.getByRole('button', { name: 'Forfeit and Leave Match', exact: true }).click();
    expect(await page.evaluate(() => ({ forfeits: window.pvpFeedbackFixture.forfeits, townRespawns: window.pvpFeedbackFixture.townRespawns })))
        .toEqual({ forfeits: 1, townRespawns: 0 });
    await page.locator('#death-screen').screenshot({ path: testInfo.outputPath('arena-eliminated-feedback.png') });
    await page.evaluate(() => {
        const { pvp, feedback, match } = window.pvpFeedbackFixture;
        pvp.update({ match: { ...match, roundPending: true } });
        feedback.showDeathScreen();
    });
    await expect(page.locator('#death-screen')).toContainText('recover automatically');
    await page.evaluate(() => {
        const { pvp, feedback, match } = window.pvpFeedbackFixture;
        pvp.update({ match: { ...match, status: 'complete' } });
        feedback.showDeathScreen();
    });
    await expect(page.getByRole('button', { name: 'Returning…', exact: true })).toBeDisabled();
    await page.evaluate(() => {
        const { pvp, feedback } = window.pvpFeedbackFixture;
        pvp.update({ queued: 0 });
        feedback.hideDeathScreen();
    });
    await expect(panel.locator('.pvp-card--match')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Queue 2v2 Party', exact: true })).toBeVisible();
    await expect(panel).toContainText('Practice duels');
});
