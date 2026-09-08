import { jest } from '@jest/globals';

const readPlayerState = jest.fn(), projectEntity = jest.fn();
const createDefense = jest.fn(), defend = jest.fn();
jest.unstable_mockModule('@playwright/test', () => ({ expect: value => expect(value) }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ readPlayerState, projectEntity }));
jest.unstable_mockModule('./e2e/earned-wizard-defense.js', () => ({ createEarnedWizardDefense: createDefense }));
const { clearFreshInvestigationApproach } = await import('./e2e/fresh-investigation-combat.js');

beforeEach(() => {
    jest.resetAllMocks();
    readPlayerState.mockResolvedValue({ state: 'IDLE' });
    projectEntity.mockResolvedValue({ x: 100, y: 120, visible: true });
    createDefense.mockResolvedValue(defend);
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function makePage(className = 'Wizard', targets = ['skeleton', null]) {
    return { evaluate: jest.fn().mockResolvedValueOnce(className)
        .mockImplementation((_fn, site) => site ? targets.shift() : true),
    mouse: { click: jest.fn() }, waitForTimeout: jest.fn() };
}

test('Wizard defends before ordinary basic and class attacks', async () => {
    const page = makePage();
    defend.mockResolvedValue(false);
    await clearFreshInvestigationApproach(page, { id: 'diary', x: 150, z: 215 });
    expect(createDefense).toHaveBeenCalledWith(page);
    expect(defend).toHaveBeenCalledTimes(1);
    expect(defend.mock.invocationCallOrder[0]).toBeLessThan(projectEntity.mock.invocationCallOrder[0]);
    expect(page.mouse.click.mock.calls).toEqual([[100, 120], [100, 120, { button: 'right' }]]);
});

test('a defensive cast consumes this input cycle instead of double-casting', async () => {
    const page = makePage();
    defend.mockResolvedValue(true);
    await clearFreshInvestigationApproach(page, { id: 'diary' });
    expect(projectEntity).not.toHaveBeenCalled();
    expect(page.mouse.click).not.toHaveBeenCalled();
});

test('death during a retreat remains a failure and cannot be followed by attacks', async () => {
    const page = makePage();
    defend.mockResolvedValue(false);
    readPlayerState.mockResolvedValueOnce({ state: 'IDLE' }).mockResolvedValue({ state: 'DEAD' });
    await expect(clearFreshInvestigationApproach(page, { id: 'diary' })).rejects.toThrow();
    expect(defend).toHaveBeenCalledTimes(1);
    expect(page.mouse.click).not.toHaveBeenCalled();
});

test.each(['Fighter', 'Rogue', 'Cleric'])('%s retains its existing ordinary attacks', async className => {
    const page = makePage(className);
    await clearFreshInvestigationApproach(page, { id: 'diary' });
    expect(createDefense).not.toHaveBeenCalled();
    expect(page.mouse.click).toHaveBeenCalledTimes(2);
});

test('an uncontested investigation does not attack or spend resources', async () => {
    const page = makePage('Wizard', [null]);
    await clearFreshInvestigationApproach(page, { id: 'diary' });
    expect(defend).not.toHaveBeenCalled();
    expect(page.mouse.click).not.toHaveBeenCalled();
});
