import * as THREE from 'three';
import { getWhirlwindCastDuration, stopWhirlwindPresentation } from '../skills/whirlwindPresentation.js';

const geometryCache = new Map();
const materialCache = new Map();

const PALE_STEEL = Object.freeze({ dark: 0x15191d, base: 0x67717b, accent: 0xc7d0d8, pale: 0xffffff });
const OATH_STEEL = Object.freeze({ dark: 0x151c22, base: 0x495c68, accent: 0x9db8c8, pale: 0xe9f4ff });
const WAR_EMBER = Object.freeze({ dark: 0x2a100c, base: 0x7d2d1d, accent: 0xff5533, pale: 0xffc46b });
const BLOOD_STEEL = Object.freeze({ dark: 0x26090e, base: 0x721525, accent: 0xd9273f, pale: 0xff8998 });
const AZURE_CHAIN = Object.freeze({ dark: 0x0e1829, base: 0x264f83, accent: 0x5faaff, pale: 0xd7ebff });
const GRAVE_EARTH = Object.freeze({ dark: 0x21170f, base: 0x654329, accent: 0xb66b35, pale: 0xffc46b });
const SHADOW_GLASS = Object.freeze({ dark: 0x0d0912, base: 0x26172f, accent: 0x674278, pale: 0xb697c7 });
const VENOM_GLASS = Object.freeze({ dark: 0x102010, base: 0x285d2d, accent: 0x55d85d, pale: 0xd0ffb4 });
const PHANTOM_VIOLET = Object.freeze({ dark: 0x170b24, base: 0x4b1f70, accent: 0x9b4de0, pale: 0xe5c6ff });
const INFERNO = Object.freeze({ dark: 0x2b0c08, base: 0x8b2515, accent: 0xff5a1f, pale: 0xffc45c });
const ARCANE = Object.freeze({ dark: 0x190c2a, base: 0x542384, accent: 0xa44dff, pale: 0xefcaff });
const SAPPHIRE = Object.freeze({ dark: 0x0b1728, base: 0x1d5487, accent: 0x4da6ff, pale: 0xcaecff });
const RIMEGLASS = Object.freeze({ dark: 0x0c202a, base: 0x286d88, accent: 0x72cfff, pale: 0xe4f9ff });
const VOID = Object.freeze({ dark: 0x0e0916, base: 0x29143f, accent: 0x6736a0, pale: 0xc89eff });
const CHRONICLE_GOLD = Object.freeze({ dark: 0x2b220d, base: 0x897023, accent: 0xffd75a, pale: 0xfff1b0 });
const RELIQUARY_GOLD = Object.freeze({ dark: 0x2b220d, base: 0x8e6d20, accent: 0xffd447, pale: 0xfff1a1 });
const MERCY_GREEN = Object.freeze({ dark: 0x10231a, base: 0x29754a, accent: 0x55ff9b, pale: 0xc8ffe0 });
const PURITY_CYAN = Object.freeze({ dark: 0x0d2429, base: 0x277982, accent: 0x70f5ff, pale: 0xe1fdff });

const cast = (family, motif, artStyle, palette, relic, signature) => Object.freeze({
    family,
    motif,
    artStyle,
    palette,
    relic,
    signature
});

export const PROCEDURAL_ABILITY_CAST_DEFINITIONS = Object.freeze({
    Fighter: Object.freeze({
        Charge: cast('fighter', 'ember-ram-wake', 'ember-shod siege ram wake', WAR_EMBER, 'shield', 1),
        Whirlwind: cast('fighter', 'iron-tempest-wheel', 'pale iron tempest execution wheel', PALE_STEEL, 'blade', 2),
        'Shield Slam': cast('fighter', 'sun-brass-bulwark', 'sun-brass bulwark collision seal', RELIQUARY_GOLD, 'shield', 3),
        'Iron Fortress': cast('fighter', 'bastion-oath-ignition', 'riveted bastion oath ignition', OATH_STEEL, 'shield', 4),
        'Guardian Roar': cast('fighter', 'warhorn-covenant', 'crimson warhorn covenant circle', WAR_EMBER, 'fang', 5),
        'Sweeping Strike': cast('fighter', 'greatblade-half-moon', 'pale greatblade half-moon cut', PALE_STEEL, 'blade', 6),
        Earthshaker: cast('fighter', 'fault-anvil', 'grave-earth fault anvil rupture', GRAVE_EARTH, 'relic', 7),
        'Unbreakable Grip': cast('fighter', 'azure-chain-harpoon', 'azure chain-harpoon covenant', AZURE_CHAIN, 'bar', 8),
        'Juggernaut Charge': cast('fighter', 'crimson-siege-wake', 'crimson juggernaut siege wake', WAR_EMBER, 'shield', 9),
        'Berserker Edge': cast('fighter', 'bloodsteel-awakening', 'bloodsteel edge awakening rite', BLOOD_STEEL, 'blade', 10),
        'Shattering Charge': cast('fighter', 'white-fracture-ram', 'white fracture siege-ram impact', PALE_STEEL, 'crystal', 11),
        'Executioner Spin': cast('fighter', 'headsman-wheel', 'scarlet headsman wheel and tithe', BLOOD_STEEL, 'blade', 12),
        'Last Stand Rampage': cast('fighter', 'final-war-oath', 'final war-oath crown ignition', BLOOD_STEEL, 'shield', 13)
    }),
    Rogue: Object.freeze({
        'Piercing Throw': cast('rogue', 'misericorde-release', 'blacksteel misericorde release seal', PALE_STEEL, 'blade', 14),
        Backstab: cast('rogue', 'scarlet-kidney-seal', 'scarlet hidden-blade wound seal', BLOOD_STEEL, 'fang', 15),
        'Weak Point Mark': cast('rogue', 'execution-reticle', 'scarlet execution reticle inscription', BLOOD_STEEL, 'bar', 16),
        'Shadow Lunge': cast('rogue', 'eclipse-lunge', 'eclipse-glass lunge wake', SHADOW_GLASS, 'feather', 17),
        'Death Spiral': cast('rogue', 'blackglass-death-wheel', 'blackglass death spiral with crimson teeth', BLOOD_STEEL, 'blade', 18),
        'Fan of Knives': cast('rogue', 'nine-knife-fan', 'nine-knife silver fan release', PALE_STEEL, 'blade', 19),
        'Serrated Edges': cast('rogue', 'saw-vow-anointing', 'serrated saw-vow weapon anointing', BLOOD_STEEL, 'fang', 20),
        'Blade Storm': cast('rogue', 'razor-squall', 'blacksteel razor squall aperture', PALE_STEEL, 'blade', 21),
        'Phantom Volley': cast('rogue', 'void-feather-volley', 'void-feather execution volley', PHANTOM_VIOLET, 'feather', 22),
        'Smoke Bomb': cast('rogue', 'blackglass-concealment', 'blackglass concealment detonation', SHADOW_GLASS, 'relic', 23),
        'Poison Coating': cast('rogue', 'venom-sacrament', 'viridian fang-and-vial sacrament', VENOM_GLASS, 'fang', 24),
        Tripwire: cast('rogue', 'tension-latch', 'silver tension-latch placement seal', PALE_STEEL, 'bar', 25),
        'Cloak & Vanish': cast('rogue', 'silent-eclipse', 'silent eclipse shroud release', SHADOW_GLASS, 'feather', 26)
    }),
    Wizard: Object.freeze({
        Fireball: cast('wizard', 'cinder-star-release', 'caged cinder-star release sigil', INFERNO, 'crystal', 27),
        'Flame Whip': cast('wizard', 'dragon-tongue-arc', 'dragon-tongue infernal lash arc', INFERNO, 'fang', 28),
        'Flame Tornado': cast('wizard', 'cinder-helix-gate', 'cinder helix summoning gate', INFERNO, 'crystal', 29),
        'Meteor Drop': cast('wizard', 'extinction-clock', 'extinction-stone descent clock', INFERNO, 'relic', 30),
        'Inferno Cataclysm': cast('wizard', 'caldera-coronation', 'caldera cataclysm coronation seal', INFERNO, 'fang', 31),
        'Scorch Beam': cast('wizard', 'furnace-lens', 'focused furnace-lens channel', INFERNO, 'bar', 32),
        'Arcane Missiles': cast('wizard', 'violet-reliquary-volley', 'violet reliquary shard volley', ARCANE, 'crystal', 33),
        'Spell Focus': cast('wizard', 'astrolabe-convergence', 'violet astrolabe convergence rite', ARCANE, 'crystal', 34),
        'Dragonfire Lance': cast('wizard', 'wyrm-spear-gate', 'barbed wyrm-spear ignition gate', INFERNO, 'fang', 35),
        Teleport: cast('wizard', 'sapphire-rift', 'sapphire rift translation seal', SAPPHIRE, 'crystal', 36),
        'Arcane Shield': cast('wizard', 'sixfold-ward', 'sixfold sapphire ward closure', SAPPHIRE, 'shield', 37),
        'Gravity Well': cast('wizard', 'void-astrolabe', 'void astrolabe collapse prison', VOID, 'relic', 38),
        'Time Warp': cast('wizard', 'contrary-chronicle', 'contrary-handed chronicle dilation', CHRONICLE_GOLD, 'bar', 39)
    }),
    Cleric: Object.freeze({
        'Spirit Guardians': cast('cleric', 'ancestor-procession', 'gilded ancestor procession summons', RELIQUARY_GOLD, 'relic', 40),
        'Healing Light': cast('cleric', 'mercy-font', 'verdant mercy-font benediction', MERCY_GREEN, 'crystal', 41),
        'Guardian Embrace': cast('cleric', 'sunward-embrace', 'sunward reliquary embrace covenant', RELIQUARY_GOLD, 'shield', 42),
        'Purifying Wave': cast('cleric', 'ablution-tide', 'cyan ablution tide and broken curse', PURITY_CYAN, 'crystal', 43),
        'Divine Intervention': cast('cleric', 'rescue-wings', 'winged gold rescue reliquary', RELIQUARY_GOLD, 'feather', 44),
        'Radiant Strike': cast('cleric', 'judgement-half-sun', 'judgement blade half-sun impact', RELIQUARY_GOLD, 'blade', 45),
        'Consecrated Ground': cast('cleric', 'oath-chapel', 'portable oath-chapel consecration', RELIQUARY_GOLD, 'shield', 46),
        'Spirit Guardians Boost': cast('cleric', 'ancestor-coronation', 'white-gold ancestor coronation', RELIQUARY_GOLD, 'relic', 47),
        'Avenging Seraph': cast('cleric', 'seraph-gate', 'white-winged seraph descent gate', RELIQUARY_GOLD, 'feather', 48),
        'Blessing of Resolve': cast('cleric', 'pilgrim-bulwark', 'azure pilgrim bulwark blessing', AZURE_CHAIN, 'shield', 49),
        'Blessing of Zeal': cast('cleric', 'sunblade-unction', 'ember-gold sunblade unction', WAR_EMBER, 'blade', 50),
        'Mark of Weakness': cast('cleric', 'broken-vow-brand', 'violet broken-vow judgement brand', PHANTOM_VIOLET, 'fang', 51),
        "Heaven's Trumpet": cast('cleric', 'last-bell-decree', 'last-bell golden decree circle', CHRONICLE_GOLD, 'bar', 52)
    })
});

export const PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS = Object.freeze({
    Wizard: Object.freeze({
        'Frost Nova': cast('wizard', 'rimeglass-nova', 'rimeglass nova and winter-chain release', RIMEGLASS, 'crystal', 53)
    })
});

function geometry(key, factory) {
    if (!geometryCache.has(key)) geometryCache.set(key, factory());
    return geometryCache.get(key);
}

function material(cacheKey, role, color, options = {}) {
    const key = `${cacheKey}:${role}`;
    if (!materialCache.has(key)) {
        materialCache.set(key, new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: options.opacity ?? 0.82,
            depthWrite: false,
            side: THREE.DoubleSide,
            wireframe: Boolean(options.wireframe),
            blending: options.blending ?? THREE.AdditiveBlending
        }));
    }
    return materialCache.get(key);
}

function createMaterials(className, abilityName, palette) {
    const key = `${className}:${abilityName}`;
    return {
        dark: material(key, 'dark', palette.dark, { opacity: 0.74, blending: THREE.NormalBlending }),
        base: material(key, 'base', palette.base, { opacity: 0.8 }),
        accent: material(key, 'accent', palette.accent, { opacity: 0.9 }),
        pale: material(key, 'pale', palette.pale, { opacity: 0.96 }),
        veil: material(key, 'veil', palette.accent, { opacity: 0.16, wireframe: true })
    };
}

function addPart(parent, identity, name, geo, mat, options = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${identity}:${name}`;
    if (options.position) mesh.position.fromArray(options.position);
    if (options.rotation) mesh.rotation.fromArray(options.rotation);
    if (options.scale) mesh.scale.fromArray(options.scale);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    Object.assign(mesh.userData, {
        proceduralAbilityCastPart: true,
        motion: options.motion || null,
        phase: options.phase || 0,
        highQualityOnly: Boolean(options.highQualityOnly),
        gameplayBoundary: Boolean(options.gameplayBoundary),
        gameplayRadius: options.gameplayRadius,
        gameplayArc: options.gameplayArc,
        basePosition: mesh.position.toArray(),
        baseScale: mesh.scale.toArray(),
        orbitRadius: options.orbitRadius,
        orbitHeight: options.orbitHeight,
        orbitSpeed: options.orbitSpeed
    });
    parent.add(mesh);
    return mesh;
}

function relicGeometry(shape) {
    if (shape === 'shield') return geometry('cast-relic-shield', () => new THREE.CylinderGeometry(0.3, 0.45, 0.11, 5));
    if (shape === 'blade') return geometry('cast-relic-blade', () => new THREE.ConeGeometry(0.12, 0.9, 4));
    if (shape === 'fang') return geometry('cast-relic-fang', () => new THREE.ConeGeometry(0.14, 0.7, 5));
    if (shape === 'crystal') return geometry('cast-relic-crystal', () => new THREE.OctahedronGeometry(0.28, 0));
    if (shape === 'feather') return geometry('cast-relic-feather', () => new THREE.ConeGeometry(0.12, 0.75, 4));
    if (shape === 'bar') return geometry('cast-relic-bar', () => new THREE.BoxGeometry(0.12, 0.76, 0.16));
    return geometry('cast-relic-stone', () => new THREE.DodecahedronGeometry(0.22, 0));
}

function addRing(parent, identity, name, radius, mat, options = {}) {
    return addPart(parent, identity, name,
        geometry(`cast-ring:${options.segments || 32}:${options.thickness || 0.08}:${options.arc || Math.PI * 2}`, () =>
            new THREE.RingGeometry(1 - (options.thickness || 0.08), 1, options.segments || 32, 1,
                options.thetaStart || 0, options.arc || Math.PI * 2)),
        mat,
        {
            position: options.position || [0, options.y ?? 0.07, 0],
            rotation: options.rotation || [-Math.PI / 2, 0, 0],
            scale: [radius, radius, radius],
            motion: options.motion,
            phase: options.phase,
            gameplayBoundary: options.gameplayBoundary,
            gameplayRadius: options.gameplayRadius,
            gameplayArc: options.gameplayArc,
            highQualityOnly: options.highQualityOnly
        });
}

function addOrbit(parent, identity, def, materials, radius, height, options = {}) {
    const count = options.count || (4 + (def.signature % 4));
    for (let index = 0; index < count; index += 1) {
        const phase = (index / count) * Math.PI * 2;
        addPart(parent, identity, `OrbitRelic${index + 1}`, relicGeometry(def.relic),
            index % 3 === 0 ? materials.pale : (index % 2 ? materials.base : materials.accent), {
                position: [Math.cos(phase) * radius, height, Math.sin(phase) * radius],
                rotation: [def.relic === 'shield' ? Math.PI / 2 : 0, -phase, options.tilt || 0],
                scale: options.scale || [1, 1, 1],
                motion: options.reverse ? 'counter-orbit' : 'orbit',
                phase,
                orbitRadius: radius,
                orbitHeight: height,
                orbitSpeed: options.speed || (1.15 + (def.signature % 5) * 0.14),
                highQualityOnly: index % 2 === 1
            });
    }
}

function addRitualMarks(parent, identity, def, materials, radius) {
    const count = 5 + (def.signature % 5);
    const size = Math.max(0.45, Math.min(1.8, radius * 0.08));
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + (def.signature % 3) * 0.12;
        addPart(parent, identity, `RitualMark${index + 1}`, relicGeometry(def.relic),
            index % 3 === 0 ? materials.pale : materials.base, {
                position: [Math.cos(angle) * radius * 0.68, 0.1, Math.sin(angle) * radius * 0.68],
                rotation: [Math.PI / 2, -angle, (def.signature % 2 ? 0.45 : -0.45)],
                scale: [size, size * 0.72, size],
                motion: index % 2 ? 'pulse' : 'counter-spin',
                phase: angle,
                highQualityOnly: index % 2 === 1
            });
    }
}

function addCircularBoundary(parent, identity, radius, arc, materials) {
    const boundary = addRing(parent, identity, 'ExactGameplayBoundary', radius, materials.pale, {
        segments: 48,
        thickness: Math.max(0.018, Math.min(0.1, 0.28 / radius)),
        gameplayBoundary: true,
        gameplayRadius: radius,
        gameplayArc: arc
    });
    boundary.userData.normalizedGameplayRadius = 1;
    return boundary;
}

function addConeBoundary(parent, identity, radius, arc, direction, materials) {
    const heading = Math.atan2(direction.x, direction.z);
    const boundary = addRing(parent, identity, 'ExactGameplayArc', radius, materials.pale, {
        segments: 36,
        thickness: Math.max(0.018, Math.min(0.1, 0.28 / radius)),
        thetaStart: -arc / 2,
        arc,
        rotation: [-Math.PI / 2, 0, -heading + Math.PI / 2],
        gameplayBoundary: true,
        gameplayRadius: radius,
        gameplayArc: arc
    });
    boundary.userData.normalizedGameplayRadius = 1;
    for (const side of [-1, 1]) {
        const ray = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), side * arc / 2).normalize();
        const edge = addPart(parent, identity, `ExactArcEdge${side}`, geometry('cast-boundary-edge', () => new THREE.BoxGeometry(0.08, 0.04, 1)), materials.pale, {
            position: [ray.x * radius / 2, 0.08, ray.z * radius / 2],
            scale: [1, 1, radius],
            gameplayBoundary: true,
            gameplayRadius: radius,
            gameplayArc: arc
        });
        edge.lookAt(ray.x * radius, 0.08, ray.z * radius);
    }
}

function getForward(options) {
    if (options.direction?.isVector3 && options.direction.lengthSq() > 0) return options.direction.clone().normalize();
    if (options.source?.mesh?.quaternion) {
        return new THREE.Vector3(0, 0, 1).applyQuaternion(options.source.mesh.quaternion).normalize();
    }
    return new THREE.Vector3(0, 0, 1);
}

function buildBeam(root, identity, def, materials, position, options) {
    const start = options.source?.position?.clone?.() || position.clone();
    start.y += 1.25;
    const end = position.clone();
    if (end.y < start.y - 0.5) end.y = start.y;
    const localEnd = end.clone().sub(start);
    const range = Math.max(0.001, localEnd.length());
    const midpoint = localEnd.clone().multiplyScalar(0.5);
    root.position.copy(start);
    for (let layer = 0; layer < 2; layer += 1) {
        const beam = addPart(root, identity, layer ? 'BeamHeart' : 'BeamCage',
            geometry(`cast-beam:${layer}`, () => {
                const geo = new THREE.CylinderGeometry(layer ? 0.055 : 0.12, layer ? 0.055 : 0.12, 1, layer ? 5 : 8);
                geo.rotateX(Math.PI / 2);
                return geo;
            }),
            layer ? materials.pale : materials.accent, {
                position: midpoint.toArray(),
                scale: [1, 1, range],
                motion: 'beam-pulse',
                phase: layer * Math.PI
            });
        beam.lookAt(localEnd);
    }
    addRing(root, identity, 'SourceLens', 0.8, materials.base, { position: [0, 0, 0], rotation: [0, 0, 0], motion: 'spin' });
    addRing(root, identity, 'TargetBrand', 0.65, materials.pale, { position: localEnd.toArray(), rotation: [0, 0, 0], motion: 'counter-spin' });
    addOrbit(root, identity, def, materials, 0.65, 0, { count: 4, speed: 2.1 });
}

function buildCast(root, identity, def, materials, type, position, options) {
    const radius = Number.isFinite(options.radius) && options.radius > 0 ? options.radius : null;
    const arc = Number.isFinite(options.arc) && options.arc > 0 ? options.arc : null;
    const direction = getForward(options);
    root.position.copy(position);

    if (type === 'beam') {
        buildBeam(root, identity, def, materials, position, options);
        return 0.42;
    }

    if (radius && (type === 'cone' || type === 'cone_large')) {
        addConeBoundary(root, identity, radius, arc || Math.PI / 2, direction, materials);
    } else if (radius) {
        addCircularBoundary(root, identity, radius, arc, materials);
    }

    const ritualRadius = radius || (type === 'pillar' || type === 'sphere' ? 1.6 : 1.25);
    addRing(root, identity, 'InnerRitual', Math.max(0.65, ritualRadius * 0.42), materials.accent, {
        segments: 18 + (def.signature % 4) * 2,
        thickness: 0.12,
        motion: 'spin'
    });
    addRitualMarks(root, identity, def, materials, ritualRadius);

    if (type === 'pillar' || type === 'buff') {
        const height = type === 'pillar' ? 4.8 : 2.8;
        for (let index = 0; index < 4; index += 1) {
            const angle = (index / 4) * Math.PI * 2;
            addPart(root, identity, `ReliquaryRay${index + 1}`,
                geometry('cast-reliquary-ray', () => new THREE.CylinderGeometry(0.055, 0.11, 1, 5)),
                index % 2 ? materials.pale : materials.accent, {
                    position: [Math.cos(angle) * 0.52, height / 2, Math.sin(angle) * 0.52],
                    scale: [1, height, 1],
                    motion: 'rise',
                    phase: index * 0.2,
                    highQualityOnly: index % 2 === 1
                });
        }
        addOrbit(root, identity, def, materials, 0.9, 1.45, { speed: 1.1 });
        return type === 'pillar' ? 0.95 : 0.82;
    }

    if (type === 'sphere') {
        addPart(root, identity, 'ReliquaryShell', geometry('cast-shell', () => new THREE.IcosahedronGeometry(1, 1)), materials.veil,
            { position: [0, 1.25, 0], scale: [1.55, 1.8, 1.55], motion: 'shell' });
        addOrbit(root, identity, def, materials, 1.15, 1.25, { reverse: def.signature % 2 === 0 });
        return 0.82;
    }

    if (type === 'smoke' || type === 'smoke_cloud' || type === 'blood') {
        const count = type === 'smoke_cloud' ? 12 : (type === 'blood' ? 7 : 8);
        for (let index = 0; index < count; index += 1) {
            const angle = ((index * 2.399963) + def.signature * 0.17) % (Math.PI * 2);
            const spread = (radius || 1.8) * (0.22 + ((index * 37) % 60) / 100);
            addPart(root, identity, `ShroudFragment${index + 1}`, relicGeometry(type === 'blood' ? 'fang' : def.relic),
                index % 3 === 0 ? materials.pale : (index % 2 ? materials.dark : materials.accent), {
                    position: [Math.cos(angle) * spread, 0.35 + (index % 4) * 0.35, Math.sin(angle) * spread],
                    scale: type === 'smoke_cloud' ? [1.5, 1.9, 1.5] : [1, 1, 1],
                    motion: type === 'blood' ? 'fall' : 'rise',
                    phase: (index % 5) * 0.16,
                    highQualityOnly: index % 2 === 1
                });
        }
        return type === 'smoke_cloud' ? 1.05 : 0.62;
    }

    if (type === 'spin' || type === 'wave' || type === 'ring' || type === 'ground_circle' ||
        type === 'cone' || type === 'cone_large' || type === 'telegraph') {
        const orbitRadius = Math.max(0.8, Math.min(radius ? radius * 0.72 : 1.4, 9));
        addOrbit(root, identity, def, materials, orbitRadius, type.startsWith('cone') ? 0.45 : 0.7, {
            count: Math.max(5, 5 + (def.signature % 5)),
            speed: type === 'spin' ? 3.2 : 1.25,
            reverse: def.signature % 2 === 0,
            scale: radius ? [Math.max(0.7, Math.min(2.2, radius * 0.09)), Math.max(0.7, Math.min(2.2, radius * 0.09)), Math.max(0.7, Math.min(2.2, radius * 0.09))] : [1, 1, 1]
        });
        return type === 'telegraph' ? (options.telegraphDuration || 1.5) : (type === 'ground_circle' ? 1.1 : 0.78);
    }

    const core = addPart(root, identity, 'ImpactHeart', geometry('cast-impact-heart', () => new THREE.DodecahedronGeometry(0.42, 0)), materials.pale,
        { position: [0, 0.9, 0], motion: 'expand' });
    core.userData.phase = def.signature * 0.11;
    addOrbit(root, identity, def, materials, 0.85, 0.95, { speed: 2.4, count: 5 + (def.signature % 3) });
    return type === 'impact' ? 0.34 : 0.4;
}

function resolveIdentity(options) {
    const source = options.source;
    const className = options.abilityClass || source?.meshType || source?.subType || source?.constructor?.name;
    const abilityName = options.abilityName;
    const requestedAbilityName = options.requestedAbilityName || abilityName;
    const definition = PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS[className]?.[requestedAbilityName]
        || PROCEDURAL_ABILITY_CAST_DEFINITIONS[className]?.[abilityName];
    if (!className || !abilityName || !definition) {
        throw new Error(`Cannot create procedural ability cast: ${className || 'Unknown'}/${abilityName || 'Unknown'}`);
    }
    return { className, abilityName, requestedAbilityName, definition };
}

function updateRoot(root, elapsed, duration, dt) {
    const t = Math.min(1, elapsed / duration);
    root.traverse((child) => {
        const motion = child.userData?.motion;
        if (!motion || child.userData.gameplayBoundary) return;
        const phase = Number(child.userData.phase || 0);
        const baseScale = child.userData.baseScale || [1, 1, 1];
        const basePosition = child.userData.basePosition || [0, 0, 0];
        const pulse = 1 + Math.sin(elapsed * 8 + phase) * 0.09;
        if (motion === 'spin') child.rotation.z += dt * 2.4;
        else if (motion === 'counter-spin') child.rotation.z -= dt * 1.7;
        else if (motion === 'pulse') child.scale.set(baseScale[0] * pulse, baseScale[1] * pulse, baseScale[2] * pulse);
        else if (motion === 'orbit' || motion === 'counter-orbit') {
            const direction = motion === 'counter-orbit' ? -1 : 1;
            const angle = phase + elapsed * Number(child.userData.orbitSpeed || 1.3) * direction;
            child.position.set(
                Math.cos(angle) * Number(child.userData.orbitRadius || 1),
                Number(child.userData.orbitHeight || 0) + Math.sin(elapsed * 4 + phase) * 0.1,
                Math.sin(angle) * Number(child.userData.orbitRadius || 1)
            );
            child.rotation.y = -angle;
            child.rotation.z += dt * direction * 1.2;
        } else if (motion === 'shell') {
            child.rotation.y += dt * 0.75;
            child.scale.set(baseScale[0] * pulse, baseScale[1] * pulse, baseScale[2] * pulse);
        } else if (motion === 'rise') {
            child.position.y = basePosition[1] + t * 1.8 + Math.sin(elapsed * 7 + phase) * 0.08;
        } else if (motion === 'fall') {
            child.position.y = basePosition[1] - t * 1.2;
        } else if (motion === 'expand') {
            const amount = 0.45 + t * 2.5;
            child.scale.set(baseScale[0] * amount, baseScale[1] * amount, baseScale[2] * amount);
        } else if (motion === 'beam-pulse') {
            child.scale.x = baseScale[0] * pulse;
            child.scale.y = baseScale[1] * pulse;
        }

        if (t > 0.78 && !['beam-pulse', 'rise'].includes(motion)) {
            const close = Math.max(0, (1 - t) / 0.22);
            child.scale.multiplyScalar(close);
        }
    });
}

class ProceduralAbilityCastEffect {
    constructor(scene, root, duration, whirlwindSource = null) {
        this.scene = scene;
        this.root = root;
        this.meshes = [root];
        this.duration = Math.max(whirlwindSource ? 0.001 : 0.1, duration);
        this.elapsed = 0;
        this.isActive = true;
        this.disposed = false;
        this.whirlwindSource = whirlwindSource;
        this.authoritativeSeen = false;
        if (whirlwindSource) whirlwindSource.whirlwindCastEffect = this;
    }

    setRemaining(seconds) {
        const remaining = Math.max(0, Math.min(2, Number(seconds) || 0));
        if (!remaining) { this.dispose(); return; }
        this.duration = this.elapsed + remaining;
    }

    update(dt) {
        if (!this.isActive) return;
        const step = Math.max(0, Number(dt) || 0);
        const source = this.whirlwindSource;
        if (source) {
            if (source.state === 'DEAD' || source.isActive === false) { this.dispose(); return; }
            this.root.position.copy(source.position);
            // Snapshots can extend the predicted endpoint slightly. Start each
            // frame from authored scales so an earlier fade does not accumulate.
            this.root.traverse(child => {
                if (child.userData?.baseScale && !child.userData.gameplayBoundary) {
                    child.scale.fromArray(child.userData.baseScale);
                }
            });
        }
        this.elapsed += step;
        if (source) source.whirlwindRemaining = Math.max(0, this.duration - this.elapsed);
        updateRoot(this.root, this.elapsed, this.duration, step);
        if (this.elapsed >= this.duration) {
            this.isActive = false;
            this.dispose();
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.isActive = false;
        this.root.parent?.remove(this.root);
        this.root.clear();
        this.meshes.length = 0;
        if (this.whirlwindSource?.whirlwindCastEffect === this) {
            const source = this.whirlwindSource;
            source.whirlwindCastEffect = null;
            stopWhirlwindPresentation(source);
        }
    }
}

export function createProceduralAbilityCastEffect(scene, type, position, _color, options = {}) {
    if (!scene || !position) return null;
    const { className, abilityName, requestedAbilityName, definition } = resolveIdentity(options);
    const quality = options.quality === 'low' ? 'low' : 'high';
    const identity = `${className}:${requestedAbilityName}:${options.abilityLayer ?? 0}:${type}`;
    const root = new THREE.Group();
    root.name = `ProceduralAbilityCast:${identity}`;
    Object.assign(root.userData, {
        proceduralAbilityCast: true,
        abilityClass: className,
        abilityName,
        requestedAbilityName,
        abilityLayer: options.abilityLayer ?? 0,
        layerType: type,
        castFamily: definition.family,
        motif: definition.motif,
        artStyle: definition.artStyle,
        quality,
        gameplayRadius: Number.isFinite(options.radius) ? options.radius : null,
        gameplayArc: Number.isFinite(options.arc) ? options.arc : null,
        sharedGeometry: true,
        sharedMaterials: true
    });
    const materials = createMaterials(className, requestedAbilityName, definition.palette);
    let duration = buildCast(root, identity, definition, materials, type, position, options);
    const isWhirlwind = className === 'Fighter' && abilityName === 'Whirlwind' && type === 'spin';
    if (isWhirlwind) {
        duration = Number.isFinite(options.whirlwindDuration)
            ? Math.max(0.001, Math.min(2, options.whirlwindDuration)) : getWhirlwindCastDuration(options.source);
    }
    root.traverse((child) => {
        if (child.userData?.highQualityOnly) child.visible = quality !== 'low';
    });
    scene.add(root);
    return new ProceduralAbilityCastEffect(scene, root, duration, isWhirlwind ? options.source : null);
}

export function getProceduralAbilityCastCacheMetrics() {
    return { geometries: geometryCache.size, materials: materialCache.size };
}
