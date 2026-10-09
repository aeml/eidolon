import { jest } from '@jest/globals';

const recall = jest.fn(), open = jest.fn();
const pwExpect = actual => expect(actual);
pwExpect.arrayContaining = expect.arrayContaining;
pwExpect.poll = observe => ({
    toBe: async expected => expect(await observe()).toBe(expected),
    toEqual: async expected => expect(await observe()).toEqual(expected)
});
jest.unstable_mockModule('@playwright/test', () => ({ expect: pwExpect }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ returnToTown: recall }));
jest.unstable_mockModule('./e2e/earned-stash-storage.js', () => ({ openEarnedStash: open }));
const { storePersistentQALootSpare } = await import('./e2e/persistent-qa-stash.js');

const gear = { id: 'retained-gear', type: 'ARMOR', slot: 'head', stack: 1, maxStack: 1,
    rarity: { name: 'Legendary' }, potency: 7, gems: [{ id: 'gem' }], extra: { retained: true } };
let previousGame;
beforeEach(() => { previousGame = window.game; jest.clearAllMocks(); });
afterEach(() => { window.game = previousGame; });

function harness(mode) {
    const original = JSON.parse(JSON.stringify(gear));
    if (mode === 'neck' || mode === 'gloves') {
        original.type = mode === 'neck' ? 'NECK' : 'GLOVES';
        original.slot = mode;
    }
    const quest = { id: 'chronicle-item-keep', type: 'RELIC', stack: 3 };
    const player = { inventory: [original, quest], stash: [null, { id: 'already-stored', extra: { keep: true } }],
        equipment: { mainHand: { id: 'worn-weapon' } }, gold: 345 };
    if (mode === 'no-space') player.stash = Array.from({ length: 100 }, (_, index) => ({ id: `stored-${index}` }));
    const clicks = [];
    window.game = { player };
    const page = {
        evaluate: async fn => JSON.parse(JSON.stringify(fn())),
        locator: selector => ({
            isVisible: async () => false,
            textContent: async () => `${player.stash.filter(item => item?.id).length} / 100`,
            click: async options => {
                clicks.push({ selector, options });
                if (!selector.startsWith('.stash-browser-item')) return;
                if (mode === 'rejected') return;
                const item = player.inventory[0];
                player.inventory[0] = null;
                player.stash = [...player.stash.filter(item => item?.id), item];
                if (mode === 'lost-metadata') delete item.extra;
                if (mode === 'lost-stash') player.stash.shift();
                if (mode === 'lost-quest') player.inventory[1] = null;
                if (mode === 'gold-changed') player.gold++;
                if (mode === 'pending-earned') player.inventory[0] = { id: 'earned-pending', type: 'MATERIAL' };
            }
        })
    };
    return { page, player, clicks, original, quest };
}

test.each(['normal', 'pending-earned', 'neck', 'gloves'])('ordinary right-click storage preserves invested gear and pre-existing contents: %s', async mode => {
    const { page, player, clicks, quest, original } = harness(mode);
    expect(await storePersistentQALootSpare(page)).toEqual(original);
    expect(recall).toHaveBeenCalledWith(page, { allowRespawn: false });
    expect(open).toHaveBeenCalledWith(page);
    expect(clicks[0]).toEqual({ selector: '.stash-browser-item[data-source="inventory"][data-slot-index="0"]', options: { button: 'right' } });
    expect(clicks.at(-1).selector).toBe('#btn-close-stash');
    expect(player.inventory).toContainEqual(quest);
    expect(player.stash).toContainEqual(original);
});

test.each(['no-space', 'rejected', 'lost-metadata', 'lost-stash', 'lost-quest', 'gold-changed'])(
    'unsafe or incomplete storage fails instead of accepting loot setup: %s', async mode => {
        const { page, clicks } = harness(mode);
        await expect(storePersistentQALootSpare(page)).rejects.toThrow();
        expect(clicks.filter(entry => entry.selector.startsWith('.stash-browser-item'))).toHaveLength(mode === 'no-space' ? 0 : 1);
    }
);
