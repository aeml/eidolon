import { nearestObservedHostile } from './observedHostileApproach.js';

test('an explicit walking-path filter excludes a closer enemy behind a building', () => {
    const enemies = [1, 2].map(x => ({ id: String(x), subtype: 'InfernoTitan', active: true, alive: true, x, z: 0 }));
    expect(nearestObservedHostile({ x: 0, z: 0 }, enemies, 'InfernoTitan', enemy => enemy.x > 1).id).toBe('2');
    expect(nearestObservedHostile({ x: 0, z: 0 }, enemies, 'InfernoTitan', () => false)).toBeNull();
});

test('approach follows the nearest real matching enemy, regardless of screen projection', () => {
    const far = Object.freeze({ id: 'far', subtype: 'InfernoTitan', active: true, alive: true, x: 20, z: 0 });
    const near = Object.freeze({ ...far, id: 'near', x: -5, z: 3 });
    const source = Object.freeze([far, near]);
    expect(nearestObservedHostile({ x: 0, z: 0 }, source, 'InfernoTitan'))
        .toEqual({ ...near, distance: Math.hypot(5, 3) });
    expect(source[0]).toBe(far);
});

test.each([{ alive: false }, { active: false }, { subtype: 'Skeleton' }, { x: NaN }])(
    'inactive, dead, other-family and malformed observations cannot become targets: %j', invalid => {
        const enemy = { id: 'invalid', subtype: 'InfernoTitan', active: true, alive: true, x: 1, z: 1, ...invalid };
        expect(nearestObservedHostile({ x: 0, z: 0 }, [enemy], 'InfernoTitan')).toBeNull();
    });
