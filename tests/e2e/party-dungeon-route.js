import { expect } from '@playwright/test';
import { openDungeonGuide } from './dungeon-guide.js';
import { moveByGroundClick, readPlayerState, returnToTown, useCombatQAWaypoint } from './helpers.js';

const identity = page => page.evaluate(() => ({
    id: window.game.currentInstanceId,
    seed: window.game.currentDungeonLayout?.generationSeed
}));

export async function exercisePartyDungeonResume(leader, member) {
    await returnToTown(leader);
    await returnToTown(member);
    await openDungeonGuide(leader);
    if (!(await leader.locator('#dungeon-party-state-box').innerText()).includes('No active party instance')) {
        await leader.locator('#btn-reset-dungeon').click();
        await expect(leader.locator('#dungeon-menu')).toBeHidden();
        await openDungeonGuide(leader);
    }
    await leader.locator('#dungeon-type-select').selectOption('abyssal_well');
    await leader.locator('#diff-btn-heroic').click();
    await leader.locator('#dungeon-run-level-select').selectOption('80');
    await leader.locator('#btn-enter-dungeon').click();
    for (const page of [leader, member]) {
        await expect.poll(async () => (await readPlayerState(page)).instanceType).toBe('abyssal_well');
        await expect.poll(() => page.evaluate(() => window.game.currentDungeonLayout?.generationSeed || '')).not.toBe('');
        await page.evaluate(() => {
            const game = window.game;
            const previous = game.handleServerMessage.bind(game);
            window.__partyDungeonTransitions = 0;
            game.handleServerMessage = message => {
                if (message.type === 'enter_instance') window.__partyDungeonTransitions++;
                return previous(message);
            };
        });
    }
    const run = await identity(leader);
    expect(await identity(member)).toEqual(run);
    await moveByGroundClick(leader, 15, 0, { allowJumpFallback: false });
    await expect.poll(async () => (await readPlayerState(leader)).x).toBeGreaterThan(50005);
    await leader.waitForTimeout(1_000);
    const leaderBefore = await readPlayerState(leader);
    await returnToTown(member);
    await openDungeonGuide(member);
    await expect(member.locator('#dungeon-active-run-summary')).toContainText('Abyssal Well · Heroic · Level 80');
    await expect(member.locator('#dungeon-type-select')).toBeDisabled();
    await expect(member.locator('#dungeon-run-level-select')).toHaveValue('80');
    await expect(member.locator('#diff-btn-normal')).toBeDisabled();
    await expect(member.locator('#btn-reset-dungeon')).toHaveCount(0);
    await member.locator('#btn-enter-dungeon').click();
    await expect.poll(() => identity(member)).toEqual(run);
    expect(await leader.evaluate(() => window.__partyDungeonTransitions)).toBe(0);
    expect((await readPlayerState(leader)).x).toBeCloseTo(leaderBefore.x, 1);
    expect(await identity(leader)).toEqual(run);

    // Reverse roles: the leader returning must not reset the member either.
    await moveByGroundClick(member, 0, 15, { allowJumpFallback: false });
    await member.waitForTimeout(1_000);
    const memberBefore = await readPlayerState(member);
    const transitionsBefore = await member.evaluate(() => window.__partyDungeonTransitions);
    await returnToTown(leader);
    await openDungeonGuide(leader);
    await expect(leader.locator('#dungeon-active-run-summary')).toContainText('Abyssal Well · Heroic · Level 80');
    await leader.locator('#btn-enter-dungeon').click();
    await expect.poll(() => identity(leader)).toEqual(run);
    expect((await readPlayerState(member)).z).toBeCloseTo(memberBefore.z, 1);
    expect(await member.evaluate(() => window.__partyDungeonTransitions)).toBe(transitionsBefore);
    expect(await identity(member)).toEqual(run);
    await returnToTown(leader);
    await returnToTown(member);
    await useCombatQAWaypoint(leader);
    await useCombatQAWaypoint(member);
}
