import { jest } from '@jest/globals';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';

const pwExpect = value => expect(value);
pwExpect.poll = callback => ({ toBe: async value => {
    for (let i = 0; i < 3; i++) if (await callback() === value) return;
    throw new Error('Bounded anchor observation did not match');
} });
jest.unstable_mockModule('@playwright/test', () => ({ expect: pwExpect }));
jest.unstable_mockModule('./e2e/helpers.js', () => ({ projectEntity: async () => ({ x: 10, y: 20, visible: true }) }));
const { defeatCommandAnchor } = await import('./e2e/chronicle-command-anchor.js');
const chapter = chronicleInvestigations.find(q => q.id === 'chronicle_fire_obedient_ember');
const site = chapter.sites.find(s => s.kind === 'combat');

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('every regional combat discovery is handled by the existing command-anchor encounter', () => {
    expect(chronicleInvestigations.flatMap(q => q.sites.filter(s => s.kind === 'combat').map(s => s.id)))
        .toEqual(['command_anchor']);
});

test.each([0, 2, 7])('rejects unordered or mismatched initial evidence %i', async mask => {
    const page = { evaluate: jest.fn().mockResolvedValue(mask) };
    await expect(defeatCommandAnchor(page, site, chapter, jest.fn())).rejects.toThrow();
    expect(page.evaluate).toHaveBeenCalledTimes(1);
});

test('retained combat evidence does not force another kill or fabricate a death observation', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue(3) }, defend = jest.fn();
    await defeatCommandAnchor(page, site, chapter, defend);
    expect(page.evaluate).toHaveBeenCalledTimes(1);
    expect(defend).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('no repeated kill claimed'));
});

test('new anchor credit still requires ordinary input, an observed death and ordered evidence', async () => {
    const page = { evaluate: jest.fn()
        .mockResolvedValueOnce(1).mockResolvedValueOnce(true)
        .mockResolvedValueOnce({ deadPlayer: false, exists: true, dead: false, cooldown: 0 })
        .mockResolvedValueOnce(site.entityId)
        .mockResolvedValueOnce({ deadPlayer: false, exists: true, dead: true })
        .mockResolvedValueOnce(3).mockResolvedValueOnce(3),
    mouse: { move: jest.fn(), click: jest.fn() }, waitForTimeout: jest.fn() };
    const defend = jest.fn().mockResolvedValue(false);
    await defeatCommandAnchor(page, site, chapter, defend);
    expect(defend).toHaveBeenCalledWith({ encounter: { x: site.x, z: site.z, radius: 32 } });
    expect(page.mouse.click.mock.calls).toEqual([[10, 20], [10, 20, { button: 'right' }]]);
});
