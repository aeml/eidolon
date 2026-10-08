import { sampleDungeonFlagstone } from '../src/art/DungeonFlagstone.js';

const families = ['verdant_bastion_catacombs', 'molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus'];
test.each(families)('%s uses varied periodic stones with bounded physical wear', type => {
    const sizes = new Set();
    let fractures = 0, faces = 0, joints = 0;
    for (let y = .25; y < 64; y += 1) for (let x = .25; x < 64; x += 1) {
        const sample = sampleDungeonFlagstone(x, y, type);
        const repeat = sampleDungeonFlagstone(x + 128, y - 64, type);
        for (const key of Object.keys(sample)) expect(repeat[key]).toBeCloseTo(sample[key], 10);
        sizes.add(`${sample.width}:${sample.height}`);
        expect(sample.bevel).toBeGreaterThanOrEqual(0); expect(sample.bevel).toBeLessThanOrEqual(1);
        expect(sample.fracture).toBeGreaterThanOrEqual(0); expect(sample.fracture).toBeLessThanOrEqual(1);
        if (sample.fracture > .2) fractures++;
        if (sample.bevel > .9) faces++;
        if (sample.bevel < .15) joints++;
    }
    expect(sizes.size).toBeGreaterThan(12);
    expect(fractures).toBeGreaterThan(3);
    expect(faces).toBeGreaterThan(2500); expect(joints).toBeGreaterThan(25);
});
test('family layouts are distinct and unsupported content fails explicitly', () => {
    const layouts = families.map(type => Array.from({ length: 64 }, (_, y) =>
        Array.from({ length: 64 }, (_, x) => sampleDungeonFlagstone(x, y, type).bevel)));
    expect(new Set(layouts.map(layout => JSON.stringify(layout))).size).toBe(families.length);
    expect(() => sampleDungeonFlagstone(0, 0, 'missing')).toThrow(TypeError);
});
