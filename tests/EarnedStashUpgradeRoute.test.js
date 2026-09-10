import { jest } from '@jest/globals';
import { planEarnedEquipmentUpgrade } from './earnedEquipmentUpgrades.js';

const pwExpect = value => expect(value);
pwExpect.poll = callback => ({ toBe: async value => expect(await callback()).toBe(value) });
const readGear = jest.fn(), equip = jest.fn(), open = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: pwExpect }));
jest.unstable_mockModule('./e2e/earned-equipment-upgrades.js', () => ({ readEarnedGear: readGear, upgradeEarnedEquipment: equip }));
jest.unstable_mockModule('./e2e/earned-stash-storage.js', () => ({ openEarnedStash: open }));
const { upgradeEarnedStoredEquipment } = await import('./e2e/earned-stash-upgrades.js');
const ring = (id, intelligence) => ({ id, type: 'ACCESSORY', slot: 'ring', level: 1,
    stats: { intelligence }, gems: [], extra: { retained: true } });

function browser({ full = false, reject = false, loseMetadata = false, loseOld = false, changeGold = false } = {}) {
    const state = { className: 'Wizard', level: 30, gold: 456, xp: 123,
        inventory: [full ? { id: 'material', type: 'MATERIAL' } : null],
        equipment: { ring1: ring('strong', 8), ring2: ring('weak', 1) },
        stash: [ring('stored', 4), { ...ring('future', 50), level: 31 }] };
    const withdrawals = [];
    readGear.mockImplementation(async () => JSON.parse(JSON.stringify(state)));
    equip.mockImplementation(async () => {
        const action = planEarnedEquipmentUpgrade(state);
        if (!action) return [];
        const index = state.inventory.findIndex(item => item?.id === action.id);
        const old = state.equipment[action.slot];
        state.equipment[action.slot] = state.inventory[index];
        state.inventory[index] = loseOld ? null : old;
        return [action];
    });
    const page = { locator: selector => ({ click: jest.fn(), isVisible: async () => false,
        nth: index => ({ click: async options => {
            withdrawals.push({ selector, index, options });
            if (reject) return;
            const [item] = state.stash.splice(index, 1);
            if (loseMetadata) delete item.extra;
            state.inventory[state.inventory.findIndex(item => !item?.id)] = item;
            if (changeGold) state.gold++;
        } }) }) };
    return { page, state, withdrawals };
}

beforeEach(() => { jest.resetAllMocks(); jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test('normal withdrawal equips the stored improvement and preserves all displaced and future gear', async () => {
    const { page, state, withdrawals } = browser();
    const result = await upgradeEarnedStoredEquipment(page);
    expect(withdrawals).toEqual([{ selector: '#stash-grid .inv-slot', index: 0, options: { button: 'right' } }]);
    expect(result.upgrades).toEqual([expect.objectContaining({ id: 'stored', slot: 'ring2', previousId: 'weak' })]);
    expect(state.equipment.ring1.id).toBe('strong');
    expect(state.equipment.ring2.id).toBe('stored');
    expect(state.inventory[0].id).toBe('weak');
    expect(state.stash[0].id).toBe('future');
    expect(open).toHaveBeenCalledTimes(2);
});

test('full-bag failure precedes withdrawal and equipment mutation', async () => {
    const { page, withdrawals } = browser({ full: true });
    await expect(upgradeEarnedStoredEquipment(page)).rejects.toThrow('one free bag slot');
    expect(withdrawals).toEqual([]);
    expect(equip).not.toHaveBeenCalled();
});

test('multiple withdrawals re-resolve compacted stash indices and remain bounded', async () => {
    const { page, state, withdrawals } = browser();
    state.inventory.push(null);
    state.equipment.chest = { ...ring('old-chest', 1), type: 'ARMOR', slot: 'chest' };
    state.stash.push({ ...ring('stored-chest', 7), type: 'ARMOR', slot: 'chest' });
    const result = await upgradeEarnedStoredEquipment(page);
    expect(result.withdrawn.map(item => item.id)).toEqual(['stored-chest', 'stored']);
    expect(withdrawals.map(item => item.index)).toEqual([2, 0]);
    expect(state.stash.map(item => item.id)).toEqual(['future']);
    expect(state.inventory.map(item => item.id)).toEqual(['old-chest', 'weak']);
    expect(open).toHaveBeenCalledTimes(3);
});

test.each([{ reject: true }, { loseMetadata: true }, { loseOld: true }, { changeGold: true }])(
    'rejected or lossy operations cannot become successful preparation: %j', async flags => {
        const { page, withdrawals } = browser(flags);
        await expect(upgradeEarnedStoredEquipment(page)).rejects.toThrow();
        expect(withdrawals).toHaveLength(1);
    });
