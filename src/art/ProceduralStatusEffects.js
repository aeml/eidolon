import * as THREE from 'three';

const geometryCache = new Map();
const materialCache = new Map();

const definition = (family, polarity, motif, artStyle, radius, palette) => Object.freeze({
    family,
    polarity,
    motif,
    artStyle,
    radius,
    palette: Object.freeze(palette)
});

export const PROCEDURAL_STATUS_EFFECT_DEFINITIONS = Object.freeze({
    iron_fortress: definition('fighter', 'buff', 'bastion-cage', 'riveted oathsteel bastion cage', 1.75,
        { dark: 0x17212b, base: 0x617889, accent: 0xa8d8ff, pale: 0xf0f7ff }),
    guardian_roar: definition('fighter', 'buff', 'oath-shields', 'procession of sky-blue oath shields', 1.9,
        { dark: 0x17242e, base: 0x39768c, accent: 0x54d6ff, pale: 0xffffff }),
    berserker_edge: definition('fighter', 'buff', 'fury-edge', 'hooked bloodsteel fury halo', 1.55,
        { dark: 0x2a0d0d, base: 0x851d20, accent: 0xff3131, pale: 0xffb05c }),
    last_stand: definition('fighter', 'buff', 'last-crown', 'broken war-crown of the final oath', 2.05,
        { dark: 0x260909, base: 0x7d1115, accent: 0xff1414, pale: 0xffdf57 }),
    serrated_edges: definition('rogue', 'buff', 'serrated-oath', 'blackglass saw-vow blade circuit', 1.45,
        { dark: 0x180c13, base: 0x641526, accent: 0xcf2946, pale: 0xf4dbe0 }),
    poison_coating: definition('rogue', 'buff', 'venom-fangs', 'viridian fang-and-vial weapon sacrament', 1.45,
        { dark: 0x101b13, base: 0x226a35, accent: 0x42ff72, pale: 0xc7ffd3 }),
    stealth: definition('rogue', 'buff', 'eclipse-shroud', 'faceted eclipse shroud with silent vanes', 1.7,
        { dark: 0x0d0a12, base: 0x241a2c, accent: 0x684d78, pale: 0x9d78b5 }),
    spell_focus: definition('wizard', 'buff', 'arcane-lens', 'violet astrolabe lens and captive crystals', 1.65,
        { dark: 0x170d25, base: 0x51217a, accent: 0xa949ff, pale: 0xf0c7ff }),
    arcane_shield: definition('wizard', 'buff', 'hexward-shell', 'sixfold sapphire reliquary shell', 1.85,
        { dark: 0x0d1b2a, base: 0x1d5b91, accent: 0x3b9dff, pale: 0xc9edff }),
    time_warp: definition('wizard', 'buff', 'chronicle-clock', 'gilded chronicle clock with contrary hands', 1.9,
        { dark: 0x2c2511, base: 0x8b7626, accent: 0xffd858, pale: 0xfff5bc }),
    swift: definition('relic', 'buff', 'wind-spurs', 'cyan wind-spur wake from the Swift relic', 1.5,
        { dark: 0x102328, base: 0x2d7d86, accent: 0x64f3ff, pale: 0xe0fdff }),
    guardian_embrace: definition('cleric', 'buff', 'reliquary-embrace', 'paired sunward reliquary arms', 2.0,
        { dark: 0x2b2512, base: 0x8c7628, accent: 0xffe56d, pale: 0xffffff }),
    blessing_resolve: definition('cleric', 'buff', 'azure-resolve', 'azure pilgrim-shield covenant', 1.8,
        { dark: 0x111d2d, base: 0x315f98, accent: 0x68a9ff, pale: 0xd9eaff }),
    divine_intervention: definition('cleric', 'buff', 'intervention-wings', 'winged gold rescue reliquary', 1.75,
        { dark: 0x2c220d, base: 0xa7761d, accent: 0xffcf4a, pale: 0xffffff }),
    blessing_zeal: definition('cleric', 'buff', 'zeal-sunblade', 'ember-gold sunblade benediction', 1.6,
        { dark: 0x30140e, base: 0x9a3d28, accent: 0xff7257, pale: 0xffdb8c }),
    weak_point_mark: definition('rogue', 'debuff', 'execution-mark', 'scarlet execution reticle and descending knife', 1.25,
        { dark: 0x280b0d, base: 0x861b22, accent: 0xff3c3c, pale: 0xffffff }),
    mark_weakness: definition('cleric', 'debuff', 'broken-vow', 'violet broken-vow seal with inward thorns', 1.35,
        { dark: 0x1e0d29, base: 0x592375, accent: 0xa04cff, pale: 0xf1d9ff }),
    stunned: definition('control', 'debuff', 'stun-crown', 'shattered gold concussion crown', 1.3,
        { dark: 0x29230d, base: 0x927b20, accent: 0xffdf4d, pale: 0xffffff }),
    rooted: definition('control', 'debuff', 'grasping-roots', 'seven grave-root claws locking the feet', 1.35,
        { dark: 0x18200f, base: 0x3d6829, accent: 0x69a83f, pale: 0xbce77e }),
    slowed: definition('control', 'debuff', 'winter-chain', 'backward-turning winter chain', 1.35,
        { dark: 0x10232d, base: 0x316f8b, accent: 0x72cfff, pale: 0xd7f4ff }),
    frozen: definition('control', 'debuff', 'frost-prison', 'six-spired rimeglass prison', 1.5,
        { dark: 0x0c2630, base: 0x248ca3, accent: 0x55e8ff, pale: 0xe5fdff }),
    bleeding: definition('affliction', 'debuff', 'blood-tithe', 'falling crimson tithe and hooked wound seal', 1.15,
        { dark: 0x26070d, base: 0x71101f, accent: 0xc71935, pale: 0xff7586 }),
    poisoned: definition('affliction', 'debuff', 'venom-censer', 'sickly venom censer with orbiting fangs', 1.25,
        { dark: 0x14200d, base: 0x3d6d20, accent: 0x65cf36, pale: 0xd2ff8f })
});

function geometry(key, factory) {
    if (!geometryCache.has(key)) geometryCache.set(key, factory());
    return geometryCache.get(key);
}

function material(statusKey, role, color, options = {}) {
    const key = `${statusKey}:${role}:${options.wireframe ? 'wire' : 'solid'}`;
    if (!materialCache.has(key)) {
        materialCache.set(key, new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: options.opacity ?? 0.78,
            depthWrite: false,
            side: THREE.DoubleSide,
            wireframe: Boolean(options.wireframe),
            blending: options.blending ?? THREE.AdditiveBlending
        }));
    }
    return materialCache.get(key);
}

function createMaterials(statusKey, palette) {
    return {
        dark: material(statusKey, 'dark', palette.dark, { opacity: 0.7, blending: THREE.NormalBlending }),
        base: material(statusKey, 'base', palette.base, { opacity: 0.76 }),
        accent: material(statusKey, 'accent', palette.accent, { opacity: 0.86 }),
        pale: material(statusKey, 'pale', palette.pale, { opacity: 0.94 }),
        veil: material(statusKey, 'veil', palette.accent, { opacity: 0.17, wireframe: true })
    };
}

function addPart(parent, statusKey, name, geo, mat, options = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${statusKey}:${name}`;
    if (options.position) mesh.position.fromArray(options.position);
    if (options.rotation) mesh.rotation.fromArray(options.rotation);
    if (options.scale) mesh.scale.fromArray(options.scale);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    Object.assign(mesh.userData, {
        proceduralStatusPart: true,
        statusKey,
        motion: options.motion || null,
        highQualityOnly: Boolean(options.highQualityOnly),
        basePosition: mesh.position.toArray(),
        baseScale: mesh.scale.toArray(),
        phase: options.phase || 0,
        orbitRadius: options.orbitRadius,
        orbitHeight: options.orbitHeight,
        orbitSpeed: options.orbitSpeed
    });
    parent.add(mesh);
    return mesh;
}

function ring(parent, statusKey, name, radius, mat, options = {}) {
    return addPart(
        parent,
        statusKey,
        name,
        geometry(`status-ring:${options.segments || 24}:${options.thickness || 0.1}`, () =>
            new THREE.RingGeometry(1 - (options.thickness || 0.1), 1, options.segments || 24)),
        mat,
        {
            position: [0, options.y ?? 0.055, 0],
            rotation: [-Math.PI / 2, 0, options.rotation || 0],
            scale: [radius, radius, radius],
            motion: options.motion || 'seal',
            phase: options.phase || 0,
            highQualityOnly: options.highQualityOnly
        }
    );
}

function shapeGeometry(shape) {
    if (shape === 'shield') {
        return geometry('status-shield', () => new THREE.CylinderGeometry(0.32, 0.45, 0.11, 5));
    }
    if (shape === 'blade') {
        return geometry('status-blade', () => new THREE.ConeGeometry(0.13, 0.88, 4));
    }
    if (shape === 'fang') {
        return geometry('status-fang', () => new THREE.ConeGeometry(0.12, 0.62, 5));
    }
    if (shape === 'crystal') {
        return geometry('status-crystal', () => new THREE.OctahedronGeometry(0.27, 0));
    }
    if (shape === 'drop') {
        return geometry('status-drop', () => new THREE.ConeGeometry(0.17, 0.54, 7));
    }
    if (shape === 'bar') {
        return geometry('status-bar', () => new THREE.BoxGeometry(0.12, 0.7, 0.18));
    }
    if (shape === 'feather') {
        return geometry('status-feather', () => new THREE.ConeGeometry(0.13, 0.72, 4));
    }
    return geometry('status-relic', () => new THREE.DodecahedronGeometry(0.19, 0));
}

function orbit(parent, statusKey, name, shape, count, radius, height, materials, options = {}) {
    for (let index = 0; index < count; index += 1) {
        const phase = (index / count) * Math.PI * 2;
        const mat = index % 3 === 0 ? materials.pale : (index % 2 ? materials.base : materials.accent);
        addPart(parent, statusKey, `${name}${index + 1}`, shapeGeometry(shape), mat, {
            position: [Math.cos(phase) * radius, height, Math.sin(phase) * radius],
            rotation: [shape === 'shield' ? Math.PI / 2 : 0, -phase, options.tilt || 0],
            scale: options.scale || [1, 1, 1],
            motion: options.reverse ? 'counter-orbit' : 'orbit',
            phase,
            orbitRadius: radius,
            orbitHeight: height,
            orbitSpeed: options.speed || 1.35,
            highQualityOnly: Boolean(options.optionalEvery && index % options.optionalEvery === 0)
        });
    }
}

function radialMarks(parent, statusKey, count, radius, materials, options = {}) {
    const mark = shapeGeometry(options.shape || 'bar');
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        addPart(parent, statusKey, `SealMark${index + 1}`, mark, index % 3 ? materials.base : materials.pale, {
            position: [Math.cos(angle) * radius, options.y ?? 0.08, Math.sin(angle) * radius],
            rotation: [0, -angle, options.tilt ?? Math.PI / 2],
            scale: options.scale || [0.7, 0.42, 0.7],
            motion: options.motion || 'pulse',
            phase: angle,
            highQualityOnly: index % 2 === 1
        });
    }
}

function buildStatus(root, statusKey, def, materials) {
    const radius = def.radius;
    ring(root, statusKey, 'OuterSeal', radius, materials.accent, { segments: 28, thickness: 0.075 });
    ring(root, statusKey, 'InnerSeal', radius * 0.64, materials.base, {
        segments: 16,
        thickness: 0.12,
        motion: 'counter-seal',
        highQualityOnly: true
    });

    switch (def.motif) {
        case 'bastion-cage':
            addPart(root, statusKey, 'OathsteelShell', geometry('status-shell', () => new THREE.IcosahedronGeometry(1, 1)), materials.veil,
                { position: [0, 1.35, 0], scale: [radius, 1.85, radius], motion: 'shell' });
            orbit(root, statusKey, 'RivetShield', 'shield', 6, radius * 0.72, 1.25, materials, { speed: 0.55, optionalEvery: 2 });
            radialMarks(root, statusKey, 8, radius * 0.78, materials);
            break;
        case 'oath-shields':
            orbit(root, statusKey, 'RoaringShield', 'shield', 5, radius * 0.76, 1.22, materials, { speed: 0.85 });
            radialMarks(root, statusKey, 10, radius * 0.72, materials, { shape: 'fang', tilt: 0.3 });
            break;
        case 'fury-edge':
            orbit(root, statusKey, 'HookedEdge', 'blade', 7, radius * 0.76, 1.0, materials, { speed: 2.1, tilt: 0.45 });
            radialMarks(root, statusKey, 7, radius * 0.66, materials, { shape: 'fang', tilt: -0.42 });
            break;
        case 'last-crown':
            orbit(root, statusKey, 'BrokenCrown', 'blade', 8, radius * 0.78, 1.45, materials, { speed: 1.2, scale: [1.3, 1.55, 1.3] });
            ring(root, statusKey, 'FinalOath', radius * 0.42, materials.pale, { y: 2.65, motion: 'pulse' });
            break;
        case 'serrated-oath':
            orbit(root, statusKey, 'SawVow', 'blade', 9, radius * 0.78, 1.15, materials, { speed: 2.45, reverse: true, tilt: 0.8, optionalEvery: 2 });
            radialMarks(root, statusKey, 12, radius * 0.72, materials, { shape: 'fang', tilt: 0.62 });
            break;
        case 'venom-fangs':
            orbit(root, statusKey, 'VenomFang', 'fang', 6, radius * 0.7, 1.25, materials, { speed: 1.55 });
            orbit(root, statusKey, 'VenomVial', 'drop', 3, radius * 0.42, 2.0, materials, { speed: 0.85, reverse: true });
            break;
        case 'eclipse-shroud':
            addPart(root, statusKey, 'EclipseVeil', geometry('status-eclipse-shell', () => new THREE.IcosahedronGeometry(1, 1)), materials.veil,
                { position: [0, 1.25, 0], scale: [radius, 1.75, radius], motion: 'shadow-shell' });
            orbit(root, statusKey, 'SilentVane', 'feather', 8, radius * 0.75, 0.9, materials, { speed: 0.42, reverse: true, optionalEvery: 2 });
            ring(root, statusKey, 'BlackSun', radius * 0.48, materials.pale, { y: 2.55, motion: 'counter-seal' });
            break;
        case 'arcane-lens':
            orbit(root, statusKey, 'CaptiveCrystal', 'crystal', 5, radius * 0.68, 1.45, materials, { speed: 1.15 });
            ring(root, statusKey, 'LensEquator', radius * 0.7, materials.accent, { y: 1.35, motion: 'lens' });
            ring(root, statusKey, 'LensMeridian', radius * 0.58, materials.pale, { y: 1.35, rotation: Math.PI / 2, motion: 'lens-counter', highQualityOnly: true });
            break;
        case 'hexward-shell':
            addPart(root, statusKey, 'SapphireWard', geometry('status-hex-shell', () => new THREE.IcosahedronGeometry(1, 1)), materials.veil,
                { position: [0, 1.35, 0], scale: [radius, 1.9, radius], motion: 'shell' });
            orbit(root, statusKey, 'WardAnchor', 'crystal', 6, radius * 0.77, 1.2, materials, { speed: 0.72 });
            ring(root, statusKey, 'CrownWard', radius * 0.56, materials.pale, { y: 2.8, motion: 'counter-seal' });
            break;
        case 'chronicle-clock':
            radialMarks(root, statusKey, 12, radius * 0.76, materials, { shape: 'blade', tilt: Math.PI / 2 });
            addPart(root, statusKey, 'HourHand', shapeGeometry('bar'), materials.pale,
                { position: [0, 0.09, radius * 0.22], rotation: [Math.PI / 2, 0, 0], scale: [0.8, radius * 0.65, 0.8], motion: 'clock-hour' });
            addPart(root, statusKey, 'MinuteHand', shapeGeometry('bar'), materials.accent,
                { position: [radius * 0.28, 0.1, 0], rotation: [Math.PI / 2, 0, Math.PI / 2], scale: [0.65, radius * 0.9, 0.65], motion: 'clock-minute' });
            orbit(root, statusKey, 'ChronicleTooth', 'crystal', 4, radius * 0.48, 1.65, materials, { speed: 0.65, reverse: true });
            break;
        case 'wind-spurs':
            orbit(root, statusKey, 'WindSpur', 'feather', 3, radius * 0.68, 0.82, materials, { speed: 2.8, tilt: Math.PI / 2 });
            radialMarks(root, statusKey, 6, radius * 0.73, materials, { shape: 'feather', tilt: Math.PI / 2, motion: 'wind-pulse' });
            break;
        case 'reliquary-embrace':
            orbit(root, statusKey, 'EmbraceShield', 'shield', 4, radius * 0.68, 1.3, materials, { speed: 0.48 });
            ring(root, statusKey, 'SunHalo', radius * 0.5, materials.pale, { y: 2.82, motion: 'pulse' });
            radialMarks(root, statusKey, 8, radius * 0.7, materials, { shape: 'bar', tilt: 0 });
            break;
        case 'azure-resolve':
            orbit(root, statusKey, 'PilgrimShield', 'shield', 5, radius * 0.73, 1.05, materials, { speed: 0.72 });
            ring(root, statusKey, 'ResolveCrown', radius * 0.46, materials.pale, { y: 2.55, motion: 'pulse' });
            break;
        case 'intervention-wings':
            for (const side of [-1, 1]) {
                for (let index = 0; index < 5; index += 1) {
                    addPart(root, statusKey, `RescueFeather${side}:${index}`, shapeGeometry('feather'), index % 2 ? materials.accent : materials.pale, {
                        position: [side * (0.35 + index * 0.22), 1.45 + index * 0.13, 0],
                        rotation: [0, 0, side * (0.85 + index * 0.07)],
                        scale: [1, 1.2 + index * 0.12, 1],
                        motion: 'wing',
                        phase: index + (side > 0 ? 0.5 : 0),
                        highQualityOnly: index % 2 === 1
                    });
                }
            }
            ring(root, statusKey, 'RescueHalo', radius * 0.48, materials.pale, { y: 2.82, motion: 'pulse' });
            break;
        case 'zeal-sunblade':
            orbit(root, statusKey, 'Sunblade', 'blade', 6, radius * 0.73, 1.2, materials, { speed: 1.8, tilt: 0.35 });
            radialMarks(root, statusKey, 10, radius * 0.7, materials, { shape: 'fang', tilt: 0.15 });
            break;
        case 'execution-mark':
            ring(root, statusKey, 'ExecutionReticle', radius * 0.62, materials.pale, { y: 2.45, motion: 'reticle' });
            addPart(root, statusKey, 'DescendingKnife', shapeGeometry('blade'), materials.accent,
                { position: [0, 2.5, 0], rotation: [0, 0, Math.PI], scale: [1.25, 1.5, 1.25], motion: 'judgement' });
            radialMarks(root, statusKey, 4, radius * 0.75, materials, { shape: 'bar', tilt: 0 });
            break;
        case 'broken-vow':
            orbit(root, statusKey, 'InwardThorn', 'fang', 7, radius * 0.72, 1.2, materials, { speed: 0.68, reverse: true, tilt: Math.PI });
            ring(root, statusKey, 'BrokenVowCrown', radius * 0.58, materials.pale, { y: 2.5, motion: 'reticle' });
            radialMarks(root, statusKey, 7, radius * 0.68, materials, { shape: 'fang', tilt: -0.55 });
            break;
        case 'stun-crown':
            orbit(root, statusKey, 'ConcussionShard', 'crystal', 6, radius * 0.68, 2.55, materials, { speed: 2.2, reverse: true });
            ring(root, statusKey, 'ShatteredCrown', radius * 0.66, materials.accent, { y: 2.5, motion: 'wobble' });
            break;
        case 'grasping-roots':
            orbit(root, statusKey, 'GraveRootClaw', 'fang', 7, radius * 0.74, 0.38, materials, { speed: 0.16, reverse: true, tilt: -0.85 });
            radialMarks(root, statusKey, 7, radius * 0.56, materials, { shape: 'bar', tilt: -0.4 });
            break;
        case 'winter-chain':
            orbit(root, statusKey, 'WinterLink', 'bar', 8, radius * 0.73, 0.58, materials, { speed: 0.62, reverse: true, tilt: Math.PI / 2, optionalEvery: 2 });
            ring(root, statusKey, 'ColdMeasure', radius * 0.48, materials.pale, { y: 0.14, motion: 'counter-seal' });
            break;
        case 'frost-prison':
            orbit(root, statusKey, 'RimeglassSpire', 'crystal', 6, radius * 0.72, 1.0, materials, { speed: 0.18, reverse: true, scale: [1.15, 2.3, 1.15] });
            addPart(root, statusKey, 'PrisonHeart', geometry('status-prison-heart', () => new THREE.OctahedronGeometry(0.55, 0)), materials.veil,
                { position: [0, 1.45, 0], scale: [1, 1.8, 1], motion: 'pulse' });
            break;
        case 'blood-tithe':
            orbit(root, statusKey, 'WoundHook', 'fang', 5, radius * 0.74, 0.75, materials, { speed: 0.72, tilt: -0.6 });
            for (let index = 0; index < 5; index += 1) {
                addPart(root, statusKey, `FallingTithe${index + 1}`, shapeGeometry('drop'), index % 2 ? materials.accent : materials.pale, {
                    position: [(index - 2) * 0.3, 1.2 + index * 0.32, Math.sin(index) * 0.2],
                    motion: 'fall',
                    phase: index * 0.31,
                    highQualityOnly: index % 2 === 1
                });
            }
            break;
        case 'venom-censer':
            orbit(root, statusKey, 'CenserFang', 'fang', 5, radius * 0.72, 1.0, materials, { speed: 0.92, reverse: true });
            orbit(root, statusKey, 'VenomCoal', 'relic', 4, radius * 0.42, 1.75, materials, { speed: 1.45, optionalEvery: 2 });
            radialMarks(root, statusKey, 6, radius * 0.66, materials, { shape: 'drop', tilt: Math.PI });
            break;
        default:
            throw new Error(`Unknown procedural status motif: ${def.motif}`);
    }
}

function setQuality(root, quality) {
    root.traverse((child) => {
        if (child.userData?.highQualityOnly) child.visible = quality !== 'low';
    });
}

export function createProceduralStatusEffect(statusKey, options = {}) {
    const def = PROCEDURAL_STATUS_EFFECT_DEFINITIONS[statusKey];
    if (!def) throw new Error(`Cannot create procedural status effect: ${statusKey}`);
    const quality = options.quality === 'low' ? 'low' : 'high';
    const root = new THREE.Group();
    root.name = `ProceduralStatusEffect:${statusKey}`;
    Object.assign(root.userData, {
        proceduralStatusEffect: true,
        statusKey,
        statusFamily: def.family,
        statusPolarity: def.polarity,
        motif: def.motif,
        artStyle: def.artStyle,
        quality,
        sharedGeometry: true,
        sharedMaterials: true
    });
    buildStatus(root, statusKey, def, createMaterials(statusKey, def.palette));
    setQuality(root, quality);
    return root;
}

export function updateProceduralStatusEffect(root, elapsed, dt) {
    if (!root?.userData?.proceduralStatusEffect) return;
    root.traverse((child) => {
        const motion = child.userData?.motion;
        if (!motion) return;
        const phase = Number(child.userData.phase || 0);
        const baseScale = child.userData.baseScale || [1, 1, 1];
        const basePosition = child.userData.basePosition || [0, 0, 0];
        const pulse = 1 + Math.sin(elapsed * 3.8 + phase) * 0.055;
        if (motion === 'seal') child.rotation.z += dt * 0.42;
        else if (motion === 'counter-seal') child.rotation.z -= dt * 0.34;
        else if (motion === 'pulse' || motion === 'wind-pulse') {
            const strength = motion === 'wind-pulse' ? 0.11 : 0.055;
            const amount = 1 + Math.sin(elapsed * (motion === 'wind-pulse' ? 6.2 : 3.8) + phase) * strength;
            child.scale.set(baseScale[0] * amount, baseScale[1] * amount, baseScale[2] * amount);
        } else if (motion === 'orbit' || motion === 'counter-orbit') {
            const direction = motion === 'counter-orbit' ? -1 : 1;
            const angle = phase + elapsed * Number(child.userData.orbitSpeed || 1.35) * direction;
            child.position.set(
                Math.cos(angle) * Number(child.userData.orbitRadius || 1),
                Number(child.userData.orbitHeight || 1) + Math.sin(elapsed * 2.7 + phase) * 0.1,
                Math.sin(angle) * Number(child.userData.orbitRadius || 1)
            );
            child.rotation.y = -angle;
            child.rotation.z += dt * direction * 0.8;
        } else if (motion === 'shell' || motion === 'shadow-shell') {
            child.rotation.y += dt * (motion === 'shadow-shell' ? -0.24 : 0.32);
            child.scale.set(baseScale[0] * pulse, baseScale[1] * pulse, baseScale[2] * pulse);
        } else if (motion === 'lens' || motion === 'lens-counter') {
            child.rotation.y += dt * (motion === 'lens-counter' ? -1.1 : 0.85);
            child.rotation.z += dt * (motion === 'lens-counter' ? 0.45 : -0.3);
        } else if (motion === 'clock-hour') child.rotation.z -= dt * 0.42;
        else if (motion === 'clock-minute') child.rotation.z += dt * 2.3;
        else if (motion === 'wing') {
            child.rotation.y = Math.sin(elapsed * 2.8 + phase) * 0.16;
            child.scale.set(baseScale[0], baseScale[1] * pulse, baseScale[2]);
        } else if (motion === 'reticle') {
            child.rotation.z += dt * 0.7;
            child.scale.set(baseScale[0] * pulse, baseScale[1] * pulse, baseScale[2] * pulse);
        } else if (motion === 'judgement') {
            child.position.y = basePosition[1] + Math.sin(elapsed * 2.2) * 0.18;
        } else if (motion === 'wobble') {
            child.rotation.z = Math.sin(elapsed * 5.5) * 0.16;
        } else if (motion === 'fall') {
            const travel = ((elapsed * 0.65 + phase) % 1.0) * 1.25;
            child.position.y = basePosition[1] - travel;
        }
    });
}

export function releaseProceduralStatusEffect(root) {
    if (!root) return;
    root.parent?.remove(root);
    root.clear();
    root.userData.released = true;
}

export function getProceduralStatusEffectCacheMetrics() {
    return { geometries: geometryCache.size, materials: materialCache.size };
}
