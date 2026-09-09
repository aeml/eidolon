import { isHostilePointerInterception } from './primaryClickEvidence.js';

const intercepted = () => {
    const enemy = { id: 'moving-enemy', hostile: true, active: true, state: 'MOVING' };
    return { result: true, dom: 'CANVAS', mobile: false, after: { ...enemy },
        pending: { ...enemy }, stack: [{ ...enemy }] };
};

test('recognizes only a fresh hostile selection that became the actual pending action', () => {
    expect(isHostilePointerInterception(intercepted())).toBe(true);
});

test.each([
    click => { click.result = false; },
    click => { click.dom = 'BUTTON'; },
    click => { click.mobile = true; },
    click => { click.after = null; },
    click => { click.after.id = ''; },
    click => { click.after.hostile = false; },
    click => { click.after.active = false; },
    click => { click.after.state = 'DEAD'; },
    click => { click.stack = []; },
    click => { click.stack[0].id = 'different-enemy'; },
    click => { click.stack[0].hostile = false; },
    click => { click.pending = null; },
    click => { click.pending.id = 'old-target'; },
    click => { click.pending.hostile = false; }
])('does not excuse missing, inconsistent, noncombat or ignored input evidence (%#)', mutate => {
    const click = intercepted();
    mutate(click);
    expect(isHostilePointerInterception(click)).toBe(false);
});

test('missing evidence cannot excuse an input failure', () => {
    expect(isHostilePointerInterception(null)).toBe(false);
    expect(isHostilePointerInterception({})).toBe(false);
});
