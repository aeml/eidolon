import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';

const pwExpect = value => ({ ...expect(value), toBeVisible: async () => expect(value).toBeTruthy() });
pwExpect.poll = callback => ({ toBe: async value => expect(await callback()).toBe(value) });
jest.unstable_mockModule('@playwright/test', () => ({ expect: pwExpect }));
const { upgradeEarnedEquipment } = await import('./e2e/earned-equipment-upgrades.js');
const item = (id, damage, slot = 'mainHand') => ({ id, name: id, slot, type: 'WEAPON', level: 1, stats: { damage } });

function browser({ reject = false, loseOld = false } = {}) {
    const state = { className: 'Wizard', level: 30, xp: 123, gold: 456,
        equipment: { ring1: item('strong', 9, 'ring'), ring2: item('old', 1, 'ring') },
        inventory: [item('better', 4, 'ring'), null] };
    const drags = [];
    const page = { evaluate: async () => JSON.parse(JSON.stringify(state)), keyboard: { press: jest.fn() },
        locator: selector => ({ selector, isVisible: async () => true, click: jest.fn(),
            nth: index => ({ dragTo: async (target, options) => {
                drags.push({ index, target: target.selector, options });
                if (reject) return;
                const slot = target.selector.slice('#slot-'.length);
                const old = state.equipment[slot];
                state.equipment[slot] = state.inventory[index];
                state.inventory[index] = loseOld ? null : old;
            } }) }) };
    return { page, state, drags };
}

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('normal drag targets the weaker paired slot, retains old gear and reaches stable state', async () => {
    const { page, state, drags } = browser();
    const receipts = await upgradeEarnedEquipment(page);
    expect(drags).toEqual([{ index: 0, target: '#slot-ring2', options: { steps: 40 } }]);
    expect(receipts).toEqual([expect.objectContaining({ id: 'better', previousId: 'old', slot: 'ring2' })]);
    expect(state.inventory[0].id).toBe('old');
    expect(state.equipment.ring1.id).toBe('strong');
    expect(state.gold).toBe(456);
});

test.each([{ reject: true }, { loseOld: true }])('rejected or lossy swaps fail rather than being called upgrades: %j', async flags => {
    const { page, drags } = browser(flags);
    await expect(upgradeEarnedEquipment(page)).rejects.toThrow();
    expect(drags).toHaveLength(1);
});

test('the selected upgrade is not sold first and recurring training persists the resulting equipment', () => {
    const bag = readFileSync('tests/e2e/earned-inventory-management.js', 'utf8');
    expect(bag.indexOf('await upgradeEarnedEquipment(page)')).toBeLessThan(bag.indexOf('const sales = planEarnedBagSales'));
    const train = readFileSync('tests/e2e/fresh-ready-route.js', 'utf8');
    expect(train).toContain('await upgradeEarnedEquipment(page)');
    expect(train).toContain('expect(await preparationState(page)).toEqual(prepared)');
});
