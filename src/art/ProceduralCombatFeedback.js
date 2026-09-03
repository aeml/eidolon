import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

const feedback = (family, motif, artStyle, palette, shape, motion, restorative = false) => Object.freeze({
    family,
    motif,
    artStyle,
    palette: Object.freeze(palette),
    shape,
    motion,
    restorative
});

export const PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS = Object.freeze({
    fighter_strike: feedback('fighter', 'iron-verdict-notch', 'riveted iron verdict with amber edge sparks',
        { dark: 0x211b18, base: 0x756552, accent: 0xd9953d, pale: 0xffdf91 }, 'axe', 'cleave'),
    rogue_strike: feedback('rogue', 'blackglass-misericorde-wound', 'crossed blackglass misericorde wound and silver splinters',
        { dark: 0x101218, base: 0x39404c, accent: 0xaab4c4, pale: 0xf4f7ff }, 'blade', 'cross'),
    wizard_strike: feedback('wizard', 'violet-astrolabe-fracture', 'violet astrolabe fracture with contrary arcane shards',
        { dark: 0x180d29, base: 0x4d267d, accent: 0xa650f4, pale: 0xeacbff }, 'crystal', 'orbit'),
    cleric_strike: feedback('cleric', 'sun-censure-brand', 'gilded sun censure brand and reliquary rays',
        { dark: 0x2b2417, base: 0x8c6b28, accent: 0xffc94f, pale: 0xfff2b0 }, 'ray', 'crown'),
    enemy_strike: feedback('enemy', 'grave-claw-rend', 'grave-iron claw rend with hostile crimson teeth',
        { dark: 0x200d11, base: 0x64242f, accent: 0xc94650, pale: 0xffa3a3 }, 'claw', 'rend'),
    reflect_strike: feedback('defense', 'oathglass-reversal', 'reversed oathglass splinter and mirrored ward snap',
        { dark: 0x101e26, base: 0x326474, accent: 0x62d4ea, pale: 0xd9fbff }, 'shield', 'reverse'),
    bleed_tick: feedback('affliction', 'blood-tithe-bead', 'blood-tithe bead fall and hooked arterial script',
        { dark: 0x24080d, base: 0x67131e, accent: 0xb4202e, pale: 0xff7580 }, 'drop', 'drip'),
    poison_tick: feedback('affliction', 'venom-censer-bloom', 'viridian venom censer bloom and fanged motes',
        { dark: 0x0d1e12, base: 0x245a31, accent: 0x4acb64, pale: 0xc8ffd0 }, 'fang', 'bloom'),
    lava_tick: feedback('hazard', 'cinder-blister-brand', 'molten cinder blister with furnace cracks',
        { dark: 0x2b1009, base: 0x7b2614, accent: 0xff4b1f, pale: 0xffc45c }, 'flame', 'erupt'),
    sandstorm_tick: feedback('hazard', 'gravewind-grit-cut', 'gravewind grit cut with ochre bone splinters',
        { dark: 0x272015, base: 0x75603a, accent: 0xc69b57, pale: 0xf2d59b }, 'shard', 'scour'),
    lightning_tick: feedback('hazard', 'storm-brand-fork', 'sapphire storm brand with forked conductor teeth',
        { dark: 0x101b2c, base: 0x285e86, accent: 0x52cfff, pale: 0xe0faff }, 'bolt', 'fork'),
    wind_tick: feedback('hazard', 'gale-shear-crescent', 'pale gale shear with opposing air crescents',
        { dark: 0x132027, base: 0x3d7080, accent: 0x80d9e8, pale: 0xe6fcff }, 'crescent', 'shear'),
    cleric_heal: feedback('restoration', 'mercy-reliquary-stitch', 'golden mercy reliquary stitching a living wound',
        { dark: 0x182217, base: 0x4c7b46, accent: 0x9ee876, pale: 0xf1ffd2 }, 'wing', 'rise', true),
    restoration_tick: feedback('restoration', 'verdant-rosary-return', 'verdant rosary beads rising through a quiet halo',
        { dark: 0x102016, base: 0x356945, accent: 0x67ca7d, pale: 0xd9ffe0 }, 'bead', 'spiral', true),
    lifesteal: feedback('restoration', 'sanguine-covenant-return', 'sanguine covenant thread returning stolen vitality',
        { dark: 0x240b14, base: 0x681d38, accent: 0xc83f68, pale: 0xffa7bd }, 'drop', 'inward', true),
    self_restore: feedback('restoration', 'pale-heart-rekindling', 'pale heart rekindling inside a restrained ward',
        { dark: 0x14201f, base: 0x3b7068, accent: 0x72d6bd, pale: 0xdcfff6 }, 'heart', 'rise', true)
});

function geometry(key, factory) {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, factory());
    return GEOMETRIES.get(key);
}

function material(key, color, opacity = 0.9, blending = THREE.AdditiveBlending) {
    if (!MATERIALS.has(key)) {
        MATERIALS.set(key, new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending
        }));
    }
    return MATERIALS.get(key);
}

function getMaterials(kind, palette) {
    return {
        dark: material(`${kind}:feedback:dark`, palette.dark, 0.7, THREE.NormalBlending),
        base: material(`${kind}:feedback:base`, palette.base, 0.78),
        accent: material(`${kind}:feedback:accent`, palette.accent, 0.92),
        pale: material(`${kind}:feedback:pale`, palette.pale, 0.98)
    };
}

function addPart(root, kind, name, geo, mat, options = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${kind}:CombatFeedback:${name}`;
    mesh.position.fromArray(options.position || [0, 0, 0]);
    mesh.rotation.fromArray(options.rotation || [0, 0, 0]);
    mesh.scale.fromArray(options.scale || [1, 1, 1]);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    Object.assign(mesh.userData, {
        proceduralCombatFeedbackPart: true,
        motion: options.motion || 'burst',
        phase: options.phase || 0,
        basePosition: mesh.position.toArray(),
        baseScale: mesh.scale.toArray(),
        travel: options.travel || 1,
        highQualityOnly: Boolean(options.highQualityOnly)
    });
    root.add(mesh);
    return mesh;
}

function emblemGeometry(shape) {
    if (shape === 'axe') return geometry('feedback:emblem:axe', () => new THREE.ConeGeometry(0.24, 1.05, 3));
    if (shape === 'blade') return geometry('feedback:emblem:blade', () => new THREE.ConeGeometry(0.12, 1.2, 4));
    if (shape === 'crystal') return geometry('feedback:emblem:crystal', () => new THREE.OctahedronGeometry(0.34, 0));
    if (shape === 'ray') return geometry('feedback:emblem:ray', () => new THREE.ConeGeometry(0.16, 1.15, 5));
    if (shape === 'claw') return geometry('feedback:emblem:claw', () => new THREE.ConeGeometry(0.13, 0.95, 3));
    if (shape === 'shield') return geometry('feedback:emblem:shield', () => new THREE.CylinderGeometry(0.34, 0.42, 0.1, 6));
    if (shape === 'drop') return geometry('feedback:emblem:drop', () => new THREE.ConeGeometry(0.22, 0.72, 7));
    if (shape === 'fang') return geometry('feedback:emblem:fang', () => new THREE.ConeGeometry(0.14, 0.76, 5));
    if (shape === 'flame') return geometry('feedback:emblem:flame', () => new THREE.ConeGeometry(0.28, 1.0, 6));
    if (shape === 'bolt') return geometry('feedback:emblem:bolt', () => new THREE.BoxGeometry(0.13, 1.0, 0.13));
    if (shape === 'crescent') return geometry('feedback:emblem:crescent', () => new THREE.TorusGeometry(0.36, 0.08, 5, 12, Math.PI * 1.25));
    if (shape === 'wing') return geometry('feedback:emblem:wing', () => new THREE.ConeGeometry(0.2, 0.9, 4));
    if (shape === 'bead') return geometry('feedback:emblem:bead', () => new THREE.DodecahedronGeometry(0.2, 0));
    if (shape === 'heart') return geometry('feedback:emblem:heart', () => new THREE.OctahedronGeometry(0.3, 0));
    return geometry('feedback:emblem:shard', () => new THREE.TetrahedronGeometry(0.28, 0));
}

function buildFeedback(root, kind, definition, mats, quality, intensity) {
    const restorative = definition.restorative;
    const emblemCount = quality === 'low' ? 4 : 7;
    const emblem = emblemGeometry(definition.shape);

    addPart(root, kind, 'WoundSeal',
        geometry('feedback:seal', () => new THREE.RingGeometry(0.52, 0.68, 20)),
        restorative ? mats.accent : mats.dark, {
            position: [0, 0.06, 0], rotation: [-Math.PI / 2, 0, 0],
            scale: [intensity, intensity, intensity], motion: restorative ? 'gather' : 'seal'
        });
    addPart(root, kind, 'WitnessHalo',
        geometry('feedback:halo', () => new THREE.RingGeometry(0.3, 0.38, 16)), mats.pale, {
            position: [0, 0.12, 0], rotation: [-Math.PI / 2, 0, Math.PI / 8],
            scale: [intensity, intensity, intensity], motion: restorative ? 'rise' : 'snap'
        });

    for (let index = 0; index < emblemCount; index += 1) {
        const angle = (index / emblemCount) * Math.PI * 2 + definition.motif.length * 0.07;
        const outward = restorative ? -1 : 1;
        const travel = intensity * (0.75 + (index % 3) * 0.25);
        addPart(root, kind, `Relic${index + 1}`, emblem,
            index % 3 === 0 ? mats.pale : (index % 2 ? mats.base : mats.accent), {
                position: [Math.cos(angle) * 0.18, 0.45 + (index % 2) * 0.22, Math.sin(angle) * 0.18],
                rotation: [Math.PI / 2, -angle, restorative ? Math.PI : 0],
                scale: [intensity, intensity, intensity],
                motion: restorative ? definition.motion : 'shard', phase: angle,
                travel: travel * outward, highQualityOnly: index >= 4
            });
    }

    if (definition.motion === 'cross' || definition.motion === 'rend' || definition.motion === 'fork') {
        const strokes = definition.motion === 'fork' ? 3 : 2;
        for (let index = 0; index < strokes; index += 1) {
            addPart(root, kind, `Stroke${index + 1}`,
                geometry('feedback:stroke', () => new THREE.BoxGeometry(0.08, 1.7, 0.08)), mats.pale, {
                    position: [(index - (strokes - 1) / 2) * 0.35, 0.9, 0],
                    rotation: [0, 0, (index - (strokes - 1) / 2) * 0.72],
                    scale: [intensity, intensity, intensity], motion: 'stroke', phase: index
                });
        }
    }

    return restorative ? 0.72 : 0.52;
}

function updateFeedback(root, elapsed, duration, dt) {
    const t = Math.min(1, elapsed / duration);
    const close = t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1;
    root.traverse((part) => {
        if (!part.isMesh) return;
        const data = part.userData;
        const base = data.baseScale || [1, 1, 1];
        const origin = data.basePosition || [0, 0, 0];
        if (data.motion === 'seal' || data.motion === 'snap') {
            const spread = 0.6 + Math.sin(t * Math.PI / 2) * 1.5;
            part.scale.set(base[0] * spread * close, base[1] * spread * close, base[2] * close);
            part.rotation.z += dt * (data.motion === 'snap' ? -5 : 3.5);
        } else if (data.motion === 'shard' || data.motion === 'cleave' || data.motion === 'crown'
            || data.motion === 'rend' || data.motion === 'erupt' || data.motion === 'scour'
            || data.motion === 'fork' || data.motion === 'shear' || data.motion === 'reverse') {
            const distance = Math.sin(t * Math.PI / 2) * Number(data.travel || 1);
            part.position.set(
                origin[0] + Math.cos(data.phase) * distance,
                origin[1] + Math.sin(t * Math.PI) * Math.abs(data.travel) * 0.45,
                origin[2] + Math.sin(data.phase) * distance
            );
            part.scale.set(base[0] * close, base[1] * close, base[2] * close);
            part.rotation.y += dt * 5;
        } else if (data.motion === 'gather' || data.motion === 'rise' || data.motion === 'spiral' || data.motion === 'inward') {
            const inward = 1 - Math.sin(t * Math.PI / 2);
            const orbit = data.phase + t * Math.PI * 1.5;
            const radius = Math.abs(data.travel) * inward;
            part.position.set(Math.cos(orbit) * radius, origin[1] + t * 1.65, Math.sin(orbit) * radius);
            part.scale.set(base[0] * close, base[1] * close, base[2] * close);
            part.rotation.y -= dt * 3.5;
        } else if (data.motion === 'stroke') {
            part.scale.set(base[0], base[1] * Math.sin(t * Math.PI), base[2]);
        }
    });
}

class ProceduralCombatFeedbackEffect {
    constructor(root, duration) {
        this.root = root;
        this.meshes = [root];
        this.duration = duration;
        this.elapsed = 0;
        this.isActive = true;
        this.disposed = false;
    }

    update(dt) {
        if (!this.isActive) return;
        const step = Math.max(0, Number(dt) || 0);
        this.elapsed += step;
        updateFeedback(this.root, this.elapsed, this.duration, step);
        if (this.elapsed >= this.duration) this.dispose();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.isActive = false;
        this.root.parent?.remove(this.root);
        this.root.clear();
        this.meshes.length = 0;
    }
}

export function createProceduralCombatFeedbackEffect(scene, position, options = {}) {
    if (!scene || !position) return null;
    const kind = options.feedbackKind;
    const definition = PROCEDURAL_COMBAT_FEEDBACK_DEFINITIONS[kind];
    if (!definition) throw new Error(`Unknown procedural combat feedback: ${kind}`);
    const quality = options.quality === 'low' ? 'low' : 'high';
    const amount = Math.max(1, Number(options.amount) || 1);
    const intensity = Math.max(0.72, Math.min(1.4, 0.72 + Math.log10(amount + 1) * 0.24));
    const root = new THREE.Group();
    root.name = `ProceduralCombatFeedback:${kind}`;
    root.position.copy(position);
    root.position.y = Math.max(0.08, Number(position.y) || 0.08);
    Object.assign(root.userData, {
        proceduralCombatFeedback: true,
        feedbackKind: kind,
        feedbackFamily: definition.family,
        motif: definition.motif,
        artStyle: definition.artStyle,
        restorative: definition.restorative,
        quality,
        amount,
        intensity,
        sourceId: options.sourceId || '',
        targetId: options.targetId || '',
        instanceId: options.instanceId || '',
        sharedGeometry: true,
        sharedMaterials: true
    });
    const duration = buildFeedback(root, kind, definition, getMaterials(kind, definition.palette), quality, intensity);
    root.traverse((part) => {
        if (part.userData?.highQualityOnly) part.visible = quality !== 'low';
    });
    scene.add(root);
    return new ProceduralCombatFeedbackEffect(root, duration);
}

export function getProceduralCombatFeedbackCacheMetrics() {
    return { geometries: GEOMETRIES.size, materials: MATERIALS.size };
}
