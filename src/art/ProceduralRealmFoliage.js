import * as THREE from 'three';
import { PROCEDURAL_FOLIAGE_RECIPES } from '../data/worldFoliage.js';
import { getRegionTheme } from './darkFantasyTheme.js';
import { createLeafCanopyGeometry } from './ProceduralLeafCanopy.js';
import { createConiferBoughGeometry } from './ProceduralConiferBoughs.js';
import { createWillowCurtainGeometry } from './WillowCurtainGeometry.js';
import { createElementalConiferGeometry } from './ElementalConiferGeometry.js';
import { createDrownedWillowGeometry } from './DrownedWillowGeometry.js';
import { createEmberSnagGeometry, EMBER_SNAG_SOCKETS } from './EmberSnagGeometry.js';
import { createFracturedCrystalGeometry } from './FracturedCrystalGeometry.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createWoodlandStemGeometry } from './WoodlandStemGeometry.js';
import { applyWoodlandLeafDetail } from './WoodlandLeafMaterial.js';
import { applyWoodlandBarkDetail } from './WoodlandBarkMaterial.js';

const GEOMETRIES = new Map();
const MATERIALS = new Map();
const ARCHETYPES = new Map();

const geometry = (key, create) => {
    if (!GEOMETRIES.has(key)) {
        const value = create();
        value.computeBoundingBox();
        value.computeBoundingSphere();
        GEOMETRIES.set(key, value);
    }
    return GEOMETRIES.get(key);
};

const material = (key, color, options = {}) => {
    if (!MATERIALS.has(key)) {
        MATERIALS.set(key, new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.92,
            metalness: options.metalness ?? 0,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            flatShading: options.flatShading ?? true,
            vertexColors: options.vertexColors ?? false,
            side: options.side ?? THREE.FrontSide
        }));
        if (options.surface) applyWorldSurfaceDetail(MATERIALS.get(key), options.surface);
        if (options.leafDetail) applyWoodlandLeafDetail(MATERIALS.get(key));
        if (options.barkDetail) applyWoodlandBarkDetail(MATERIALS.get(key), options.barkDetail);
    }
    return MATERIALS.get(key);
};

function part(name, geometryValue, materialValue, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true
} = {}) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...position),
        quaternion,
        new THREE.Vector3(...scale)
    );
    return Object.freeze({ name, geometry: geometryValue, material: materialValue, matrix, castShadow, receiveShadow });
}

const trunk = geometry('foliage-trunk', () => new THREE.CylinderGeometry(0.28, 0.48, 5.4, 7));
const narrowTrunk = geometry('foliage-narrow-trunk', () => new THREE.CylinderGeometry(0.16, 0.32, 6.2, 7));
const emberSnag = geometry('foliage-ember-snag', createEmberSnagGeometry);
const drownedCrown = geometry('foliage-drowned-willow', createDrownedWillowGeometry);
const leafCrown = geometry('foliage-leaf-crown', createLeafCanopyGeometry);
const needleCrown = geometry('foliage-needle-boughs', createConiferBoughGeometry);
const willowCurtain = geometry('foliage-willow-curtain', createWillowCurtainGeometry);
const pineCrown = geometry('foliage-elemental-boughs', createElementalConiferGeometry);
const shard = geometry('foliage-shard', createFracturedCrystalGeometry);
const crystal = geometry('foliage-crystal', () => new THREE.OctahedronGeometry(0.7, 0));
const root = geometry('foliage-root', () => new THREE.ConeGeometry(0.2, 1.9, 5));
const lantern = geometry('foliage-lantern', () => new THREE.OctahedronGeometry(0.2, 0));
const birchStem = geometry('woodland-birch-stem', () => createWoodlandStemGeometry({ height: 6.2, baseRadius: .32, tipRadius: .11, bend: .2, forks: 2, seed: 3 }));
const pineStem = geometry('woodland-pine-stem', () => createWoodlandStemGeometry({ height: 5.4, baseRadius: .48, tipRadius: .16, bend: .13, forks: 3, seed: 7 }));
const willowStem = geometry('woodland-willow-stem', () => createWoodlandStemGeometry({ height: 5.4, baseRadius: .48, tipRadius: .19, bend: .26, forks: 3, seed: 11 }));

function palette(region) {
    return getRegionTheme(region).palette;
}

function matureWoodland(parts) {
    // Taller overhead cover gives the woodland a canopy rather than a field
    // of saplings. Keep every trunk's XZ transform and all placement/collision
    // contracts unchanged; only leaf/needle crowns spread horizontally.
    const height = new THREE.Matrix4().makeScale(1, 1.65, 1);
    return parts.map(descriptor => {
        const matrix = height.clone().multiply(descriptor.matrix);
        const baseY = descriptor.geometry.boundingBox.clone().applyMatrix4(descriptor.matrix).min.y;
        // Growing a slightly buried trunk must not deepen its buried base.
        if (baseY < 0) matrix.elements[13] -= baseY * .65;
        if (descriptor.geometry === leafCrown || descriptor.geometry === needleCrown) {
            matrix.scale(new THREE.Vector3(1.4, 1, 1.4));
        }
        return Object.freeze({ ...descriptor, matrix });
    });
}

function createOssuaryBirch() {
    const p = palette('earth');
    const bark = material('foliage-birch-bark', 0x8d8977, { barkDetail: 'birch', flatShading: false });
    const scar = material('foliage-birch-scar', p.shadow);
    const leaf = material('foliage-gloam-leaf', 0x465738, { side: THREE.DoubleSide, vertexColors: true, leafDetail: true });
    const glow = material('foliage-grave-lantern', p.accent, { emissive: p.accent, emissiveIntensity: 0.72, roughness: 0.5 });
    return matureWoodland([
        part('pale scarred trunk', birchStem, bark, { position: [0, 3.1, 0], rotation: [0, 0, -0.06] }),
        part('black bark seam', narrowTrunk, scar, { position: [0.12, 3.35, 0.08], rotation: [0, 0, -0.09], scale: [0.18, 0.92, 0.16] }),
        part('layered birch leaves', leafCrown, leaf, { position: [-0.25, 6.55, 0], scale: [1.25, 0.82, 1.08] }),
        part('low gloam crown', leafCrown, leaf, { position: [0.78, 5.62, 0.08], scale: [0.8, 0.58, 0.74] }),
        part('grave lantern fruit', lantern, glow, { position: [-0.98, 4.75, 0.15], castShadow: false })
    ]);
}

function createGravePine() {
    const p = palette('earth');
    const bark = material('foliage-black-pine-bark', 0x262822, { barkDetail: 'pine', flatShading: false });
    const leaf = material('foliage-black-pine-needle', 0x35483a, { side: THREE.DoubleSide, vertexColors: true });
    const moss = material('foliage-pine-moss', p.midtone);
    return matureWoodland([
        part('black pine trunk', pineStem, bark, { position: [0, 2.7, 0], scale: [0.76, 1.12, 0.76] }),
        part('lower funeral tier', needleCrown, leaf, { position: [0, 3.6, 0], scale: [1.45, 0.8, 1.4] }),
        part('middle funeral tier', needleCrown, leaf, { position: [.14, 5.35, -.1], rotation: [0, .7, 0], scale: [1.05, 0.7, 1.02] }),
        part('high funeral tier', needleCrown, leaf, { position: [.06, 6.75, .03], rotation: [0, 1.4, .08], scale: [.64, .55, .62] }),
        part('mossbound root', root, moss, { position: [-0.48, 0.25, 0.05], rotation: [0, 0, Math.PI / 2], scale: [0.8, 0.65, 0.8] })
    ]);
}

function createMourningWillow() {
    const p = palette('earth');
    const bark = material('foliage-willow-bark', 0x403a31, { barkDetail: 'willow', flatShading: false });
    const leaf = material('foliage-willow-leaf', 0x4a593e, { side: THREE.DoubleSide, vertexColors: true, leafDetail: true });
    const glow = material('foliage-willow-votive', p.spirit, { emissive: p.spirit, emissiveIntensity: 0.5 });
    return matureWoodland([
        part('crooked mourning trunk', willowStem, bark, { position: [0.2, 2.5, 0], rotation: [0, 0, -0.16], scale: [0.92, 0.94, 0.92] }),
        part('mourning crown', leafCrown, leaf, { position: [-0.3, 5.25, 0], scale: [2.3, .8, 1.85] }),
        part('west leaf curtain', willowCurtain, leaf, { position: [-1.55, 3.95, .1], rotation: [.05, 0, -.12], scale: [.62, 1.2, .65] }),
        part('east leaf curtain', willowCurtain, leaf, { position: [1.28, 3.82, -.12], rotation: [-.04, 0, .15], scale: [.6, 1.3, .58] }),
        part('rear leaf curtain', willowCurtain, leaf, { position: [-.1, 3.95, -1.4], rotation: [.12, 0, 0], scale: [.75, 1.25, .6] }),
        part('willow votive', lantern, glow, { position: [0.82, 2.62, 0.22], castShadow: false })
    ]);
}

function createRimePine() {
    const p = palette('water');
    const bark = material('foliage-rime-bark', 0x334853);
    const ice = material('foliage-rime-needle', 0x7898a6, { metalness: 0.08, roughness: 0.7, vertexColors: true, side: THREE.DoubleSide });
    const snow = material('foliage-rime-snow', 0xb8ccd2, { roughness: 0.82, vertexColors: true, side: THREE.DoubleSide });
    const glow = material('foliage-rime-glow', p.accent, { emissive: p.accent, emissiveIntensity: 0.66 });
    return [
        part('drowned pine trunk', trunk, bark, { position: [0, 2.75, 0], scale: [0.76, 1.05, 0.76] }),
        part('lower rime tier', pineCrown, ice, { position: [0, 3.6, 0], scale: [1.18, 0.78, 1.18] }),
        part('middle snow tier', pineCrown, snow, { position: [0, 5.18, 0], scale: [0.84, 0.62, 0.84] }),
        part('moonfrost crown', pineCrown, ice, { position: [0, 6.48, 0], scale: [0.54, 0.48, 0.54] }),
        part('conduction crystal', shard, glow, { position: [0.58, 0.82, 0.1], rotation: [0, 0, -0.18], scale: [0.45, 0.62, 0.45], castShadow: false })
    ];
}

function createDrownedWillow() {
    const p = palette('water');
    const bark = material('foliage-drowned-bark', 0x263b43, { barkDetail: 'willow', flatShading: false });
    const leaf = material('foliage-drowned-reed', 0x536f79, { side: THREE.DoubleSide, vertexColors: true, leafDetail: true });
    const spirit = material('foliage-drowned-spirit', p.spirit, { emissive: p.spirit, emissiveIntensity: 0.82 });
    return [
        part('bent drowned trunk', willowStem, bark, { position: [0.28, 2.6, 0], rotation: [0, 0, -0.2], scale: [0.84, 1.02, 0.84] }),
        part('drowned canopy', drownedCrown, leaf),
        part('drowned soul fruit west', lantern, spirit, { position: [-0.9, 2.58, 0.25], castShadow: false }),
        part('drowned soul fruit east', lantern, spirit, { position: [0.65, 2.92, -0.08], scale: [0.75, 0.75, 0.75], castShadow: false })
    ];
}

function createEmberSnag() {
    const p = palette('fire');
    const char = material('foliage-charwood', 0x211b1a, { barkDetail: 'pine', flatShading: false });
    const ember = material('foliage-ember-heart', p.accent, { emissive: p.accent, emissiveIntensity: 1.05, roughness: 0.42 });
    return [
        part('charred trunk and connected forks', emberSnag, char),
        part('ember shard west', crystal, ember, { position: EMBER_SNAG_SOCKETS[0], rotation: [0, 0, -0.4], scale: [.22, .46, .22], castShadow: false }),
        part('ember shard east', crystal, ember, { position: EMBER_SNAG_SOCKETS[1], rotation: [0, 0, 0.5], scale: [.2, .4, .2], castShadow: false }),
        part('ember heart', lantern, ember, { position: [0.08, 2.9, 0.35], castShadow: false })
    ];
}

function rootedCrystalFork(name, materialValue, angle, scale, anchor) {
    const rotation = [0, 0, angle];
    const baseOffset = new THREE.Vector3(0, -1.1, 0).multiply(new THREE.Vector3(...scale))
        .applyEuler(new THREE.Euler(...rotation));
    const position = new THREE.Vector3(...anchor).sub(baseOffset).toArray();
    return part(name, shard, materialValue, { position, rotation, scale });
}

function createBasaltBriar() {
    const p = palette('fire');
    const basalt = material('foliage-basalt', p.shadow, { roughness: 0.78, surface: 'stratified-rock' });
    const rust = material('foliage-basalt-rust', p.midtone, { metalness: 0.28, surface: 'stratified-rock' });
    const magma = material('foliage-basalt-magma', p.spirit, { emissive: p.spirit, emissiveIntensity: 1.15, roughness: 0.35 });
    return [
        part('basalt briar spine', shard, basalt, { position: [0, 1.5, 0], scale: [1.2, 1.38, 1.2] }),
        rootedCrystalFork('western basalt thorn', rust, .62, [.72, .72, .72], [-.1, -.08, .15]),
        rootedCrystalFork('eastern basalt thorn', basalt, -.68, [.66, .66, .66], [.1, -.08, -.08]),
        part('magma briar heart', shard, magma, { position: [0, 1.2, 0.42], scale: [.86, .46, .74], castShadow: false })
    ];
}

function createGaleCypress() {
    const p = palette('air');
    const bark = material('foliage-gale-bark', 0x4e5966, { metalness: 0.12 });
    const leaf = material('foliage-gale-leaf', 0x526b78, { side: THREE.DoubleSide, vertexColors: true });
    const charge = material('foliage-gale-charge', p.accent, { emissive: p.accent, emissiveIntensity: 0.76 });
    return [
        part('wind-bent silver trunk', narrowTrunk, bark, { position: [0.35, 3, 0], rotation: [0, 0, -0.16], scale: [1.15, 0.98, 1.15] }),
        // Follow the existing tilted trunk's actual centreline. The old
        // opposite-side offsets left both crowns/conductor floating beside it.
        part('low leeward crown', pineCrown, leaf, { position: [.46, 3.7, 0], rotation: [0, 0, -0.16], scale: [0.72, 0.78, 0.72] }),
        part('high leeward crown', pineCrown, leaf, { position: [.74, 5.42, 0], rotation: [0, 0, -0.18], scale: [0.55, 0.68, 0.55] }),
        part('storm conductor', shard, charge, { position: [.95, 6.75, 0], rotation: [0, 0, -0.22], scale: [0.34, 0.48, 0.34], castShadow: false }),
        part('windward root', root, bark, { position: [0.74, 0.3, 0.1], rotation: [0, 0, -Math.PI / 2], scale: [0.72, 0.62, 0.72] })
    ];
}

function createStormCrystal() {
    const p = palette('air');
    const slate = material('foliage-storm-slate', p.shadow, { roughness: 0.76, surface: 'slate' });
    const silver = material('foliage-storm-silver', 0x74859a, { metalness: 0.52, roughness: 0.48 });
    const charge = material('foliage-storm-violet', p.spirit, { emissive: p.spirit, emissiveIntensity: 1.08, roughness: 0.3 });
    return [
        part('storm crystal plinth', shard, slate, { position: [0, 1.18, 0], scale: [1.05, 1.08, 1.05] }),
        rootedCrystalFork('silver conductor west', silver, .42, [.58, .78, .58], [-.1, -.08, .08]),
        rootedCrystalFork('silver conductor east', silver, -.5, [.52, .66, .52], [.1, -.08, -.1]),
        part('captive storm', shard, charge, { position: [0, 1.72, 0.36], scale: [1.06, .52, .9], castShadow: false })
    ];
}

const ARCHETYPE_BUILDERS = Object.freeze({
    ossuary_birch: createOssuaryBirch,
    grave_pine: createGravePine,
    mourning_willow: createMourningWillow,
    rime_pine: createRimePine,
    drowned_willow: createDrownedWillow,
    ember_snag: createEmberSnag,
    basalt_briar: createBasaltBriar,
    gale_cypress: createGaleCypress,
    storm_crystal: createStormCrystal
});

export { PROCEDURAL_FOLIAGE_RECIPES, FOLIAGE_HAZARD_CLEARINGS, isProceduralFoliagePlacementClear, createProceduralFoliagePlacements } from "../data/worldFoliage.js";

export function getProceduralFoliageArchetype(id) {
    const builder = ARCHETYPE_BUILDERS[id];
    if (!builder) throw new Error(`Unknown procedural foliage archetype: ${id}`);
    if (!ARCHETYPES.has(id)) ARCHETYPES.set(id, Object.freeze(builder()));
    return ARCHETYPES.get(id);
}

export function createProceduralFoliagePreview(id) {
    const recipe = PROCEDURAL_FOLIAGE_RECIPES.find((candidate) => candidate.id === id);
    if (!recipe) throw new Error(`Unknown procedural foliage archetype: ${id}`);
    const group = new THREE.Group();
    group.name = `ProceduralFoliage:${id}`;
    group.userData.proceduralFoliage = true;
    group.userData.foliageId = id;
    group.userData.region = recipe.region;
    group.userData.theme = recipe.theme;
    for (const descriptor of getProceduralFoliageArchetype(id)) {
        const mesh = new THREE.Mesh(descriptor.geometry, descriptor.material);
        mesh.name = descriptor.name;
        mesh.applyMatrix4(descriptor.matrix);
        mesh.castShadow = descriptor.castShadow;
        mesh.receiveShadow = descriptor.receiveShadow;
        group.add(mesh);
    }
    return group;
}

export function getProceduralFoliageCacheMetrics() {
    return Object.freeze({
        geometries: GEOMETRIES.size,
        materials: MATERIALS.size,
        archetypes: ARCHETYPES.size
    });
}
