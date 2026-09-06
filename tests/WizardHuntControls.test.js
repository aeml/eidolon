import { planWizardHuntStep } from './wizardHuntControls.js';

const state = { className: 'Wizard', dead: false, x: 0, z: 0, healthRatio: 0.7,
    shieldHP: 0, mana: 50, shieldCost: 40, hotbar: ['Teleport', 'Arcane Shield'],
    cooldowns: {}, sinceCastMs: 1000, threats: [{ x: 3, z: 0 }] };

test('uses the available shield through its actual hotbar key', () => {
    expect(planWizardHuntStep(state)).toEqual({ action: 'shield', key: '2' });
    expect(planWizardHuntStep({ ...state, hotbar: ['Arcane Shield'] })).toEqual({ action: 'shield', key: '1' });
});
test.each([{ mana: 39 }, { shieldHP: 10 }, { cooldowns: { 'Arcane Shield': 2 } },
    { sinceCastMs: 200 }, { hotbar: [] }, { healthRatio: 1 }])('retreats instead of an unavailable/redundant shield: %j', change => {
    const plan = planWizardHuntStep({ ...state, ...change });
    expect(plan.action).toBe('retreat');
    expect(plan.x).toBeLessThan(-8);
    expect(Math.hypot(plan.x, plan.z)).toBeCloseTo(9);
});
test('does not walk directly into a second nearby enemy', () => {
    const plan = planWizardHuntStep({ ...state, healthRatio: 1, threats: [{ x: 3, z: 0 }, { x: -8, z: 0 }] });
    expect(Math.abs(plan.z)).toBeGreaterThan(6);
});
test.each([{ dead: true }, { className: 'Fighter' }, { threats: [] }, { threats: [{ x: 12, z: 0 }] }])(
    'leaves ordinary combat alone when no defensive action is needed: %j', change => {
        expect(planWizardHuntStep({ ...state, ...change })).toBeNull();
    });
