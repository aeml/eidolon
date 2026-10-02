import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { AUTHORED_ASSETS, AUTHORED_ASSET_VERSIONS } from '../src/assets/authoredEquipment.generated.js';
import { EQUIPMENT_VISUAL_DESCRIPTORS } from '../src/art/ProceduralEquipment.js';
import { COSMETIC_CATALOGUE, SEASON_COSMETIC_CATALOGUE } from '../src/data/cosmetics.generated.js';

test('runtime catalog covers every delivered base item and all four class qualities without source-model boot dependencies', () => {
    expect(Object.keys(AUTHORED_ASSETS.items).sort()).toEqual(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).sort());
    expect(Object.keys(AUTHORED_ASSETS.characters).sort()).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
    expect(Object.keys(AUTHORED_ASSET_VERSIONS)).toHaveLength(264);
    for (const [file, version] of Object.entries(AUTHORED_ASSET_VERSIONS)) {
        const bytes = fs.readFileSync(file);
        expect(createHash('sha256').update(bytes).digest('hex').slice(0, 16)).toBe(version);
        expect(file).not.toMatch(/\/(fighter|wizard|rogue|cleric)\.glb$/);
    }
});

test('each cosmetic reuses delivered class-fitted artwork with explicit finite palette colors', () => {
    expect(COSMETIC_CATALOGUE).toHaveLength(12);
    for (const look of [...COSMETIC_CATALOGUE, ...SEASON_COSMETIC_CATALOGUE]) {
        const base = AUTHORED_ASSETS.items[look.base];
        expect(base).toBeDefined();
        expect(look.name).toBeTruthy();
        if (COSMETIC_CATALOGUE.includes(look)) expect(look.description).toBeTruthy();
        for (const color of [look.primary, look.secondary]) {
            expect(Number.isInteger(color)).toBe(true);
            expect(color).toBeGreaterThanOrEqual(0); expect(color).toBeLessThanOrEqual(0xffffff);
        }
        for (const fits of Object.values(base.models)) for (const file of Object.values(fits)) {
            expect(AUTHORED_ASSET_VERSIONS[file]).toBeDefined();
            expect(fs.existsSync(file)).toBe(true);
        }
    }
});

test('wearables have both tiers fitted to every class and weapon grips are finite calibrated matrices', () => {
    for (const item of Object.values(AUTHORED_ASSETS.items)) {
        expect(Object.keys(item.models).sort()).toEqual(['legendary', 'standard']);
        for (const fits of Object.values(item.models)) expect(Object.keys(fits).sort()).toEqual(
            ['mainHand', 'offHand'].includes(item.slot) ? ['universal'] : ['Cleric', 'Fighter', 'Rogue', 'Wizard']);
    }
    for (const grips of Object.values(AUTHORED_ASSETS.grips)) for (const hand of ['mainHand', 'offHand']) {
        expect(grips[hand].socket).toBe(`socket_${hand}`);
        expect(grips[hand].localMatrix).toHaveLength(16);
        expect(grips[hand].localMatrix.every(Number.isFinite)).toBe(true);
    }
});
