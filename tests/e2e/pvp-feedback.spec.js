import { expect, test } from '@playwright/test';

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
