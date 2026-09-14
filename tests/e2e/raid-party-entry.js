import { expect } from '@playwright/test';
import { openDungeonGuide } from './dungeon-guide.js';
import { readPlayerState } from './helpers.js';

const party = page => page.evaluate(() => window.game.uiManager.social.partyData);

async function openParty(page) {
    if (!await page.locator('#social-window').isVisible()) await page.locator('body').press('o');
    await expect(page.locator('#social-window')).toBeVisible();
}

async function closeParty(page) {
    if (await page.locator('#social-window').isVisible()) await page.locator('body').press('Escape');
    await expect(page.locator('#social-window')).toBeHidden();
}

async function raidCard(page, raidType) {
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    const card = page.locator(`.elemental-raid-card[data-raid-type="${raidType}"]`);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-access', 'open');
    return card;
}

// Use only after preparing/logging in the five distinct owned QA actors. This
// helper performs normal UI consent and entry, never server messages or grants.
// Its caller must continue through the full raid and ritual, not count entry as
// acceptance of the raid or re-run entry as a separate GPU diagnostic.
export async function formAndEnterElementalRaid(actors, raidType, { enter = true } = {}) {
    if (!/^(earth|water|fire|air)_crystal_raid$/.test(raidType) || actors.length !== 5 ||
        new Set(actors.map(actor => actor.login.username)).size !== 5) {
        throw new Error('Elemental raid route requires five distinct actors and a known raid');
    }
    const leader = actors[0];
    for (const actor of actors) {
        expect((await readPlayerState(actor.page)).instanceType).toBe('overworld');
        expect((await party(actor.page))?.members?.length || 0).toBe(0);
    }
    await openParty(leader.page);
    for (const actor of actors.slice(1)) {
        await leader.page.locator('#party-invite-input').fill(actor.login.username);
        await leader.page.locator('#btn-invite-party').click();
        await expect(actor.page.locator('#party-request-modal')).toBeVisible();
        await actor.page.locator('#btn-accept-party').click();
    }
    await closeParty(leader.page);
    for (const actor of actors) await expect.poll(async () => (await party(actor.page))?.members?.length).toBe(5);

    const card = await raidCard(leader.page, raidType);
    await card.getByRole('button', { name: 'Form Elemental Raid', exact: true }).click();
    // Party updates do not expose MaxSize; use the real conversion receipt.
    await expect(leader.page.locator('#chat-messages')).toContainText('Raid group formed. Invite 5-10 qualified players, then complete a ready check.');
    await leader.page.locator('body').press('Escape');
    await expect(leader.page.locator('#dungeon-menu')).toBeHidden();

    for (const actor of actors) await openParty(actor.page);
    await leader.page.locator('#btn-party-ready-check').click();
    for (const actor of actors) {
        const ready = actor.page.locator('#btn-party-ready');
        await expect(ready).toBeVisible();
        if (await ready.getAttribute('data-ready') !== 'true') await ready.click();
        await expect(ready).toHaveAttribute('data-ready', 'true');
    }
    for (const actor of actors) {
        await expect.poll(async () => (await party(actor.page))?.allReady).toBe(true);
        await closeParty(actor.page);
    }
    if (!enter) return null;
    const instance = await enterElementalRaid(leader.page, raidType);
    for (const actor of actors) {
        await expect.poll(() => actor.page.evaluate(() => ({ type: window.game.currentInstanceType,
            id: window.game.currentInstanceId }))).toEqual({ type: raidType, id: instance });
        await expect.poll(() => actor.page.evaluate(() => window.game.currentDungeonLayout?.rooms?.length || 0)).toBeGreaterThan(0);
    }
    return instance;
}

export async function enterElementalRaid(page, raidType) {
    if (!/^(earth|water|fire|air)_crystal_raid$/.test(raidType)) throw new Error('Unknown elemental raid');
    const entry = (await raidCard(page, raidType)).getByRole('button', { name: /^(Enter|Continue) / });
    await expect(entry).toBeEnabled();
    await entry.click();
    await expect.poll(() => page.evaluate(() => window.game.currentInstanceType)).toBe(raidType);
    const instance = await page.evaluate(() => window.game.currentInstanceId);
    expect(instance).toBeTruthy();
    await expect.poll(() => page.evaluate(() => window.game.currentDungeonLayout?.rooms?.length || 0)).toBeGreaterThan(0);
    return instance;
}
