import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../src/data/worldPopulation.js';
import { earthGroundCoverPlacements, createEarthGroundCoverTuft } from '../src/art/EarthGroundCover.js';

test.each(['high', 'low'])('%s clustered ground cover stays out of travel and reading areas', quality => {
    for (const site of EARTH_LOCATIONS) {
        const plants = earthGroundCoverPlacements(site, quality);
        expect(plants.length).toBeGreaterThan(0);
        expect(plants.length).toBeLessThanOrEqual(63);
        expect(plants).toEqual(earthGroundCoverPlacements(site, quality));
        for (const plant of plants) {
            expect(Math.hypot(plant.x, plant.z) + plant.radius).toBeLessThanOrEqual(site.radius);
            for (const path of EARTH_PATHS) expect(distanceToPath(site.x + plant.x, site.z + plant.z, path.points))
                .toBeGreaterThanOrEqual(path.width / 2 + 2 + plant.radius);
            if (site.readingOffset) expect(Math.hypot(plant.x - site.readingOffset[0], plant.z - site.readingOffset[1]))
                .toBeGreaterThanOrEqual(4 + plant.radius);
            if (site.role === 'story') expect(Math.hypot(plant.x, plant.z)).toBeGreaterThanOrEqual(10 + plant.radius);
            if (site.id === 'verdant-approach') expect(plant.z - plant.radius).toBeGreaterThanOrEqual(42);
        }
    }
});

test('Bastion has composed edge beds on both sides, clear of its six grave markers', () => {
    const site = EARTH_LOCATIONS.find(site => site.recipe === 'grave-road');
    const high = earthGroundCoverPlacements(site, 'high');
    const low = earthGroundCoverPlacements(site, 'low');
    expect(high.length).toBeGreaterThan(30);
    expect(low.length).toBeGreaterThan(15);
    for (const plant of low) expect(high).toContainEqual(plant);
    for (const side of [-1, 1]) expect(high.filter(plant => plant.x * side > 0).length).toBeGreaterThan(10);
    for (const plant of high) for (const x of [-12, 12]) for (const z of [46, 52, 58]) {
        expect(Math.hypot(plant.x - x, plant.z - z)).toBeGreaterThanOrEqual(plant.radius + 1.2);
    }
});

test.each([3, 4, -173])('tuft %s has curved colored finite geometry within its declared envelope', seed => {
    const high = createEarthGroundCoverTuft(seed), low = createEarthGroundCoverTuft(seed, 'low');
    try {
        expect(low.attributes.position.count).toBeLessThan(high.attributes.position.count);
        expect(high.attributes.position.count / 3).toBeLessThan(360);
        for (const geometry of [high, low]) {
            const position = geometry.attributes.position;
            expect(geometry.attributes.color.count).toBe(position.count);
            expect(geometry.attributes.normal.count).toBe(position.count);
            expect([...geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
            expect(new Set(geometry.attributes.color.array).size).toBeGreaterThan(8);
            for (let i = 0; i < position.count; i++) {
                expect(Math.hypot(position.getX(i), position.getZ(i))).toBeLessThan(1.8);
                expect(position.getY(i)).toBeGreaterThanOrEqual(0);
                expect(position.getY(i)).toBeLessThan(1.4);
            }
        }
    } finally { high.dispose(); low.dispose(); }
});
