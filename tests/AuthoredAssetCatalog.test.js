import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { AUTHORED_ASSETS, AUTHORED_ASSET_VERSIONS } from '../src/assets/authoredEquipment.generated.js';
import { EQUIPMENT_VISUAL_DESCRIPTORS } from '../src/art/ProceduralEquipment.js';
import { COSMETIC_CATALOGUE, SEASON_COSMETIC_CATALOGUE } from '../src/data/cosmetics.generated.js';
import { resolveFittedEquipmentModel } from '../src/art/FittedEquipment.js';
import { GARMENT_MODELS, GARMENT_ASSET_VERSIONS } from '../src/assets/garments.generated.js';
import { fighterRuntimePath } from '../src/art/AuthoredFighter.js';

test('runtime catalog covers every delivered base item and all four class qualities without source-model boot dependencies', () => {
    expect(Object.keys(AUTHORED_ASSETS.items).sort()).toEqual(Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).sort());
    expect(Object.keys(AUTHORED_ASSETS.characters).sort()).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
    expect(Object.keys(AUTHORED_ASSET_VERSIONS)).toHaveLength(744);
    for (const [file, version] of Object.entries(AUTHORED_ASSET_VERSIONS)) {
        const bytes = fs.readFileSync(file);
        expect(createHash('sha256').update(bytes).digest('hex').slice(0, 16)).toBe(version);
        expect(file).not.toMatch(/\/(fighter|wizard|rogue|cleric)\.glb$/);
    }
});

test('morph-basis High selections retain exact Low, original baselines and protected High assets', () => {
    const selection = JSON.parse(fs.readFileSync('assets/archetypes/runtime-selection.json'));
    let before = 0, after = 0;
    for (const [name, row] of Object.entries(selection.characters)) {
        const baseline = JSON.parse(fs.readFileSync(row.source.file.replace('.glb', '-runtime.manifest.json')));
        for (const quality of ['high', 'low']) {
            const variant = row.variants[quality];
            expect(AUTHORED_ASSETS.characters[name][quality]).toBe(`./${variant.file}`);
            expect(AUTHORED_ASSETS.previousCharacters[name][quality]).toBe(`./${variant.baselineFile}`);
            expect(AUTHORED_ASSET_VERSIONS[`./${variant.baselineFile}`]).toBe(baseline.variants[quality].sha256.slice(0, 16));
            const bytes = fs.readFileSync(variant.file);
            const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
            const body = json.meshes[json.nodes.find(node => node.name === `${name}_Body`).mesh];
            const triangles = body.primitives.reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0);
            expect(triangles).toBe(variant.bodyTriangles);
            expect(json.skins.map(skin => skin.joints.length)).toEqual([53]);
            expect(json.buffers.every(buffer => !buffer.uri)).toBe(true);
            expect(json.images.every(image => !image.uri)).toBe(true);
        }
        expect(row.variants.high.file).toMatch(/-runtime-body-v3-high\.glb$/);
        expect(row.variants.high.sha256).not.toBe(row.variants.high.baselineSHA256);
        expect(row.variants.low.file).toBe(row.variants.low.baselineFile);
        expect(row.variants.low.sha256).toBe(row.variants.low.baselineSHA256);
        expect(row.previousVariants.high).toHaveLength(1);
        expect(row.previousVariants.low).toEqual([]);
        expect(AUTHORED_ASSETS.retainedCharacters[name].high).toEqual(row.previousVariants.high.map(v => `./${v.file}`));
        expect(AUTHORED_ASSETS.retainedCharacters[name].low).toEqual([]);
        const previous = row.previousVariants.high[0];
        expect(previous.file).toMatch(/-runtime-body-v2-high\.glb$/);
        expect(AUTHORED_ASSET_VERSIONS[`./${previous.file}`]).toBe(previous.sha256.slice(0, 16));
        const old = fs.readFileSync(previous.file);
        const json = JSON.parse(old.subarray(20, 20 + old.readUInt32LE(12)));
        before += json.meshes[json.nodes.find(node => node.name === `${name}_Body`).mesh].primitives.reduce((sum, p) => sum + json.accessors[p.indices].count / 3, 0);
        after += row.variants.high.bodyTriangles;
    }
    expect({ before, after }).toEqual({ before: 123204, after: 81216 });
    expect(fighterRuntimePath('high')).toBe(AUTHORED_ASSETS.characters.Fighter.high);
    expect(fighterRuntimePath('low')).toBe(AUTHORED_ASSETS.characters.Fighter.low);
});

test('each quality selects its pinned derivative and original diagnostics remain reversible', () => {
    const manifest = JSON.parse(fs.readFileSync('assets/equipment/runtime/manifest.json'));
    expect(manifest.sources).toHaveLength(252);
    let unchanged = 0;
    for (const row of manifest.sources) for (const quality of ['high', 'low']) {
        const catalog = AUTHORED_ASSETS.items[row.item], variant = row.variants[quality];
        const resolved = resolveFittedEquipmentModel(catalog, row.tier,
            row.actorClass === 'universal' ? 'Rogue' : row.actorClass, quality);
        expect(resolved).toEqual({ file: `./${variant.file}`, source: `./${row.source}` });
        expect(AUTHORED_ASSET_VERSIONS[resolved.file]).toBe(variant.sha256.slice(0, 16));
        expect(resolveFittedEquipmentModel(catalog, row.tier, row.actorClass, quality, true).file).toBe(resolved.source);
        expect(variant.triangles).toBeLessThanOrEqual(row.originalTriangles);
        if (!variant.reduced) { unchanged++; expect(resolved.file).toBe(resolved.source); }
    }
    expect(unchanged).toBe(32);
    const catalog = AUTHORED_ASSETS.items['Plate Mail'];
    expect(resolveFittedEquipmentModel(catalog, 'standard', 'Fighter', undefined).file).toBe(catalog.runtimeModels.standard.Fighter.high);
    expect(resolveFittedEquipmentModel({ models: catalog.models }, 'standard', 'Fighter', 'low').file).toBe(catalog.models.standard.Fighter);
});

test('each cosmetic has audited artwork and explicit finite palette colors', () => {
    expect(COSMETIC_CATALOGUE).toHaveLength(16);
    for (const look of [...COSMETIC_CATALOGUE, ...SEASON_COSMETIC_CATALOGUE]) {
        const base = AUTHORED_ASSETS.items[look.base];
        expect(base).toBeDefined();
        expect(look.name).toBeTruthy();
        if (COSMETIC_CATALOGUE.includes(look)) expect(look.description).toBeTruthy();
        for (const color of [look.primary, look.secondary]) {
            expect(Number.isInteger(color)).toBe(true);
            expect(color).toBeGreaterThanOrEqual(0); expect(color).toBeLessThanOrEqual(0xffffff);
        }
        if (look.kind === 'outfit') {
            const outfit = GARMENT_MODELS.outfits[look.name];
            expect(outfit.id).toBe(look.id); expect(Object.keys(outfit.models).sort()).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
            for (const models of Object.values(outfit.models)) for (const model of Object.values(models)) {
                expect(GARMENT_ASSET_VERSIONS[model.file]).toBe(model.sha256.slice(0, 16));
                expect(fs.existsSync(model.file)).toBe(true);
            }
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
