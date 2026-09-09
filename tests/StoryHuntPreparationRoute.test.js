import { jest } from '@jest/globals';

const calls = [];
const recall = jest.fn(async () => calls.push('recall'));
const guide = jest.fn(async () => calls.push('guide'));
const train = jest.fn(async () => calls.push('train'));
const equip = jest.fn(async () => calls.push('equip'));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ returnToTown: recall }));
jest.unstable_mockModule('./e2e/dungeon-guide.js', () => ({ openDungeonGuide: guide }));
jest.unstable_mockModule('./e2e/fresh-ready-route.js', () => ({ prepareEarnedClass: train }));
jest.unstable_mockModule('./e2e/earned-equipment.js', () => ({ equipEarnedEmptySlots: equip }));
const { prepareStoryHuntBuild } = await import('./e2e/story-hunt-preparation.js');

beforeEach(() => { calls.length = 0; jest.clearAllMocks(); });

test('an earned level-ten field milestone recalls before approaching the town guide', async () => {
    const close = jest.fn(async () => calls.push('close'));
    const page = { locator: jest.fn(() => ({ click: close })) };
    const credentials = {};
    await prepareStoryHuntBuild(page, credentials, { level: 10, statPoints: 0 }, 'milestone');
    expect(calls).toEqual(['recall', 'guide', 'train', 'close']);
    expect(train).toHaveBeenCalledWith(page, credentials, { label: 'milestone', statBudget: 0 });
    expect(page.locator).toHaveBeenCalledWith('#btn-close-dungeon-menu');
});

test('a pre-branch character only equips already-earned empty slots', async () => {
    const page = {};
    await prepareStoryHuntBuild(page, {}, { level: 9, statPoints: 0 }, 'opening');
    expect(calls).toEqual(['equip']);
    expect(equip).toHaveBeenCalledWith(page);
});

test('failed authoritative town arrival does not continue training or hide the failure', async () => {
    recall.mockRejectedValueOnce(new Error('recall did not arrive'));
    await expect(prepareStoryHuntBuild({}, {}, { level: 20, statPoints: 0 }, 'milestone'))
        .rejects.toThrow('recall did not arrive');
    expect(guide).not.toHaveBeenCalled();
    expect(train).not.toHaveBeenCalled();
});
