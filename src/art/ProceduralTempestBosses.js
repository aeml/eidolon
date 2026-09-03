import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_TEMPEST_BOSS_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const PROCEDURAL_TEMPEST_BOSS_DEFINITIONS = Object.freeze({
    Windshear: Object.freeze({
        artStyle: 'Shattered Aerie wind-razor revenant',
        region: 'Tempest Spire — The Shattered Aerie',
        faction: 'gale sepulchre',
        bounds: Object.freeze({ radius: 3.25, height: 6.2, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ slate: 0x252b3a, storm: 0x3e5273, silver: 0x9eafc5, violet: 0x735ca8, sky: 0x55d9ff, white: 0xe9fbff })
    }),
    Stormcallers: Object.freeze({
        artStyle: 'Shattered Aerie divided storm-oracle',
        region: 'Tempest Spire — The Shattered Aerie',
        faction: 'voltara and zephyros',
        bounds: Object.freeze({ radius: 3.75, height: 7.15, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ slate: 0x29283b, storm: 0x4a4772, silver: 0xaaa8c8, violet: 0x8a62be, sky: 0x63ddff, white: 0xf1fbff })
    }),
    RocMatriarch: Object.freeze({
        artStyle: 'Shattered Aerie thunder-roc matriarch',
        region: 'Tempest Spire — The Shattered Aerie',
        faction: 'sky-brood sovereign',
        bounds: Object.freeze({ radius: 5.32, height: 5.4, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ slate: 0x222936, storm: 0x465e79, silver: 0x9bb4cb, violet: 0x5c578d, sky: 0x4ed8ff, white: 0xe7faff })
    }),
    ThunderlordKaelix: Object.freeze({
        artStyle: 'Shattered Aerie storm-bell thunderlord',
        region: 'Tempest Spire — The Shattered Aerie',
        faction: 'conductor throne',
        bounds: Object.freeze({ radius: 3.9, height: 7.8, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ slate: 0x202535, storm: 0x384967, silver: 0xb2bdce, violet: 0x6c53a2, sky: 0x41cfff, white: 0xf4fdff })
    }),
    Zephyrion: Object.freeze({
        artStyle: 'Shattered Aerie eternal-gale sovereign',
        region: 'Tempest Spire — The Shattered Aerie',
        faction: 'eye beyond the storm',
        bounds: Object.freeze({ radius: 4.65, height: 8.3, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ slate: 0x171d2c, storm: 0x354c70, silver: 0xb9c8d8, violet: 0x7a59b6, sky: 0x3ce1ff, white: 0xf5ffff })
    })
});

function geometry(key, create) {
    if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, create());
    return GEOMETRIES.get(key);
}

function material(key, color, options = {}) {
    if (!MATERIALS.has(key)) {
        MATERIALS.set(key, new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.72,
            metalness: options.metalness ?? 0,
            emissive: options.emissive ?? 0,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            depthWrite: options.depthWrite ?? true,
            side: options.side ?? THREE.FrontSide,
            flatShading: true
        }));
    }
    return MATERIALS.get(key);
}

function createMaterials(type, palette) {
    return {
        slate: material(`${type}-slate`, palette.slate, { roughness: 0.9 }),
        storm: material(`${type}-storm`, palette.storm, { roughness: 0.74 }),
        silver: material(`${type}-silver`, palette.silver, { roughness: 0.38, metalness: 0.78 }),
        violet: material(`${type}-violet`, palette.violet, { roughness: 0.68, metalness: 0.2 }),
        sky: material(`${type}-sky`, palette.sky, { roughness: 0.2, emissive: palette.sky, emissiveIntensity: 1.9 }),
        white: material(`${type}-white`, palette.white, { roughness: 0.16, emissive: palette.white, emissiveIntensity: 2.5 })
    };
}

function pivot(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const result = new THREE.Group();
    result.name = name;
    result.position.set(...position);
    result.rotation.set(...rotation);
    parent.add(result);
    return result;
}

function mesh(parent, name, geometryValue, materialValue, options = {}) {
    const result = new THREE.Mesh(geometryValue, materialValue);
    result.name = name;
    result.position.set(...(options.position || [0, 0, 0]));
    result.rotation.set(...(options.rotation || [0, 0, 0]));
    result.scale.set(...(options.scale || [1, 1, 1]));
    result.castShadow = options.castShadow ?? true;
    result.receiveShadow = options.receiveShadow ?? true;
    parent.add(result);
    return result;
}

function track(objectName, property, times, values) {
    return new THREE.NumberKeyframeTrack(`${objectName}.${property}`, times, values);
}

function installRestPoseReset(root) {
    const restPose = [];
    root.traverse((object) => restPose.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), visible: object.visible }));
    root.userData.resetPose = () => {
        restPose.forEach(({ object, position, quaternion, scale, visible }) => {
            object.position.copy(position);
            object.quaternion.copy(quaternion);
            object.scale.copy(scale);
            object.visible = visible;
        });
        root.updateMatrixWorld(true);
    };
}

function finalize(root, type, clips) {
    const definition = PROCEDURAL_TEMPEST_BOSS_DEFINITIONS[type];
    root.updateMatrixWorld(true);
    const initialBounds = new THREE.Box3().setFromObject(root);
    const groundOffset = Math.max(0, -initialBounds.min.y);
    if (groundOffset > 0) {
        const body = root.getObjectByName(`Rig_${type}Body`);
        body.position.y += groundOffset;
        clips.flatMap((clip) => clip.tracks)
            .filter((animationTrack) => animationTrack.name === `Rig_${type}Body.position[y]`)
            .forEach((animationTrack) => {
                for (let index = 0; index < animationTrack.values.length; index += 1) animationTrack.values[index] += groundOffset;
            });
        root.updateMatrixWorld(true);
    }
    root.name = `Procedural${type}`;
    root.userData.proceduralEnemyFamily = true;
    root.userData.proceduralBossFamily = 'tempest-spire';
    root.userData.proceduralActorType = type;
    root.userData.artStyle = definition.artStyle;
    root.userData.region = definition.region;
    root.userData.faction = definition.faction;
    root.userData.combatRadius = definition.combatRadius;
    root.userData.interactionPadding = 0.75;
    root.userData.sharedGeometry = true;
    root.userData.bounds = definition.bounds;
    root.userData.animations = clips;
    installRestPoseReset(root);
    return root;
}

function addConductorSeal(root, type, radius, materials, nodes = 12) {
    mesh(root, `${type}_ConductorSeal`, geometry('tempest-seal-ring', () => new THREE.RingGeometry(0.8, 0.88, 18)), materials.sky, {
        position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius], castShadow: false, receiveShadow: false
    });
    const rod = geometry('tempest-seal-rod', () => new THREE.BoxGeometry(0.07, 0.12, 0.5));
    for (let index = 0; index < nodes; index += 1) {
        const angle = index / nodes * Math.PI * 2;
        mesh(root, `${type}_SealConductor${index + 1}`, rod, index % 3 === 0 ? materials.white : materials.silver, {
            position: [Math.sin(angle) * radius * 0.68, 0.08, Math.cos(angle) * radius * 0.68], rotation: [0, angle, 0], castShadow: false, receiveShadow: false
        });
    }
}

function addStormOrbit(parent, type, materials, count, radius, prefix = 'SkyShard') {
    const shard = geometry(`${prefix}-geometry`, () => new THREE.OctahedronGeometry(0.14, 0));
    for (let index = 0; index < count; index += 1) {
        const angle = index / count * Math.PI * 2;
        mesh(parent, `${type}_${prefix}${index + 1}`, shard, index % 3 === 0 ? materials.white : materials.sky, {
            position: [Math.sin(angle) * radius, Math.sin(angle * 2) * 0.28, Math.cos(angle) * radius], rotation: [angle, angle * 0.6, angle]
        });
    }
}

function addStormFrame(root, type, materials, profile = {}) {
    const bodyY = profile.bodyY ?? 2.28;
    const width = profile.width ?? 1;
    const floating = profile.floating ?? false;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const leg = pivot(body, `Rig_${type}Leg${side}`, [sign * 0.44 * width, -1, 0]);
        mesh(leg, `${type}_${floating ? 'GaleTatter' : 'StormGreave'}${side}`, floating
            ? geometry(`${type}-tatter`, () => new THREE.ConeGeometry(0.38 * width, 1.65, 4))
            : geometry(`${type}-leg`, () => new THREE.CylinderGeometry(0.25 * width, 0.31 * width, 1.15, 6)), floating ? materials.violet : materials.slate, { position: [0, -0.56, 0], scale: [1, 1, 0.72] });
        mesh(leg, `${type}_${floating ? 'WindTip' : 'ConductorBoot'}${side}`, floating
            ? geometry(`${type}-wind-tip`, () => new THREE.ConeGeometry(0.22, 1.1, 5))
            : geometry(`${type}-boot`, () => new THREE.BoxGeometry(0.58 * width, 0.24, 0.88)), floating ? materials.sky : materials.silver, { position: [0, -1.4, floating ? -0.08 : 0.2], rotation: floating ? [0, 0, Math.PI] : [0, 0, 0] });
    }
    mesh(body, `${type}_StormPelvis`, geometry(`${type}-pelvis`, () => new THREE.CylinderGeometry(0.62 * width, 0.72 * width, 0.62, 7)), materials.slate, { position: [0, -0.24, 0] });
    mesh(body, `${type}_AerieTorso`, geometry(`${type}-torso`, () => new THREE.DodecahedronGeometry(0.86, 0)), materials.storm, { position: [0, 0.72, 0], scale: [width, 1.16, 0.72] });
    mesh(body, `${type}_CagedSky`, geometry(`${type}-heart`, () => new THREE.IcosahedronGeometry(0.26, 0)), materials.white, { position: [0, 0.78, 0.72] });
    const head = pivot(body, `Rig_${type}Head`, [0, 1.92, 0.02]);
    mesh(head, `${type}_StormMask`, geometry(`${type}-head`, () => new THREE.OctahedronGeometry(0.5, 0)), materials.slate, { scale: [width, 1.08, 0.85] });
    mesh(head, `${type}_SkyEye`, geometry(`${type}-eye`, () => new THREE.BoxGeometry(0.3, 0.075, 0.065)), materials.white, { position: [0, 0.04, 0.46] });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const arm = pivot(body, `Rig_${type}Arm${side}`, [sign * 0.94 * width, 1.1, 0], [0, 0, sign * -0.08]);
        mesh(arm, `${type}_UpperArm${side}`, geometry(`${type}-upper-arm`, () => new THREE.CylinderGeometry(0.26 * width, 0.2 * width, 0.98, 6)), materials.slate, { position: [0, -0.43, 0] });
        mesh(arm, `${type}_SilverBracer${side}`, geometry(`${type}-bracer`, () => new THREE.CylinderGeometry(0.22 * width, 0.17 * width, 0.82, 6)), materials.silver, { position: [0, -1.22, 0.02] });
        mesh(body, `${type}_AerieShoulder${side}`, geometry(`${type}-shoulder`, () => new THREE.ConeGeometry(0.4 * width, 0.8, 5)), materials.violet, { position: [sign * 0.98 * width, 1.18, 0], rotation: [0, 0, sign * -Math.PI / 2] });
    }
    const weapon = pivot(body.getObjectByName(`Rig_${type}ArmRight`), `Rig_${type}Weapon`, [0, -1.55, 0.03], [0, 0, -0.14]);
    const accent = pivot(body, `Rig_${type}Accent`, [0, 0.72, -0.42]);
    return { body, head, weapon, accent, leftArm: body.getObjectByName(`Rig_${type}ArmLeft`), rightArm: body.getObjectByName(`Rig_${type}ArmRight`), bodyY };
}

function createStandardClips(type, bodyY, options = {}) {
    const stride = options.stride ?? 0.4;
    const reach = options.reach ?? 1;
    const fall = options.fall ?? 0.86;
    const body = `Rig_${type}Body`;
    const head = `Rig_${type}Head`;
    const ll = `Rig_${type}LegLeft`;
    const rl = `Rig_${type}LegRight`;
    const la = `Rig_${type}ArmLeft`;
    const ra = `Rig_${type}ArmRight`;
    const weapon = `Rig_${type}Weapon`;
    const accent = `Rig_${type}Accent`;
    const idle = [0, 0.65, 1.3, 1.95, 2.6];
    const walk = [0, 0.4, 0.8, 1.2, 1.6];
    const run = [0, 0.25, 0.5, 0.75, 1];
    const attack = [0, 0.22, 0.48, 0.76, 1.14];
    const death = [0, 0.38, 0.82, 1.28, 1.86];
    return [
        new THREE.AnimationClip('Idle', 2.6, [
            track(body, 'position[y]', idle, [bodyY, bodyY + 0.09, bodyY, bodyY - 0.05, bodyY]),
            track(body, 'rotation[y]', idle, [0, 0.035, 0, -0.035, 0]), track(head, 'rotation[y]', idle, [0, 0.13, 0, -0.13, 0]),
            track(la, 'rotation[z]', idle, [-0.08, -0.17, -0.08, 0, -0.08]), track(ra, 'rotation[z]', idle, [0.08, 0.17, 0.08, 0, 0.08]),
            track(ll, 'rotation[z]', idle, [0, 0.03, 0, -0.03, 0]), track(weapon, 'rotation[z]', idle, [-0.14, -0.05, -0.14, -0.25, -0.14]),
            track(accent, 'rotation[y]', idle, [0, 0.55, 1.1, 1.65, 2.2]), track(accent, 'position[y]', idle, [0.72, 0.82, 0.72, 0.62, 0.72])
        ]),
        new THREE.AnimationClip('Walk', 1.6, [
            track(body, 'position[y]', walk, [bodyY, bodyY + 0.12, bodyY, bodyY + 0.12, bodyY]), track(body, 'rotation[z]', walk, [0, 0.05, 0, -0.05, 0]),
            track(ll, 'rotation[x]', walk, [stride, 0, -stride, 0, stride]), track(rl, 'rotation[x]', walk, [-stride, 0, stride, 0, -stride]),
            track(la, 'rotation[x]', walk, [-stride * 0.7, 0, stride * 0.7, 0, -stride * 0.7]), track(ra, 'rotation[x]', walk, [stride * 0.7, 0, -stride * 0.7, 0, stride * 0.7]),
            track(head, 'rotation[y]', walk, [0, -0.06, 0, 0.06, 0]), track(weapon, 'rotation[z]', walk, [-0.14, 0.05, -0.14, -0.35, -0.14]), track(accent, 'rotation[z]', walk, [0, 0.26, 0, -0.26, 0])
        ]),
        new THREE.AnimationClip('Run', 1, [
            track(body, 'position[y]', run, [bodyY, bodyY + 0.2, bodyY, bodyY + 0.2, bodyY]), track(body, 'rotation[x]', run, [0.1, 0.2, 0.1, 0.2, 0.1]),
            track(ll, 'rotation[x]', run, [stride * 1.6, 0, -stride * 1.6, 0, stride * 1.6]), track(rl, 'rotation[x]', run, [-stride * 1.6, 0, stride * 1.6, 0, -stride * 1.6]),
            track(la, 'rotation[x]', run, [-stride, 0, stride, 0, -stride]), track(ra, 'rotation[x]', run, [stride, 0, -stride, 0, stride]),
            track(head, 'rotation[x]', run, [-0.05, 0.06, -0.05, 0.06, -0.05]), track(weapon, 'rotation[z]', run, [-0.14, 0.2, -0.14, -0.52, -0.14]), track(accent, 'rotation[z]', run, [0, 0.4, 0, -0.4, 0])
        ]),
        new THREE.AnimationClip('Attack', 1.14, [
            track(body, 'position[y]', attack, [bodyY, bodyY + 0.07, bodyY + 0.2, bodyY - 0.07, bodyY]), track(body, 'rotation[y]', attack, [0, -0.25, -0.58, 0.44, 0]),
            track(head, 'rotation[y]', attack, [0, 0.15, 0.28, -0.2, 0]), track(ll, 'rotation[x]', attack, [0, 0.16, 0.3, -0.14, 0]), track(rl, 'rotation[x]', attack, [0, -0.2, -0.35, 0.18, 0]),
            track(la, 'rotation[x]', attack, [0, -0.35, -0.58, 0.32, 0]), track(ra, 'rotation[x]', attack, [0, -0.72 * reach, -1.28 * reach, 1.05 * reach, 0]),
            track(weapon, 'rotation[z]', attack, [-0.14, -0.95 * reach, -1.55 * reach, 1.1 * reach, -0.14]), track(accent, 'rotation[y]', attack, [0, -0.44, -0.96, 1.08, 0])
        ]),
        new THREE.AnimationClip('Death', 1.86, [
            track(body, 'position[y]', death, [bodyY, bodyY + 0.05, bodyY - 0.22, bodyY - fall * 0.72, bodyY - fall]), track(body, 'rotation[x]', death, [0, -0.12, 0.38, 1, 1.44]),
            track(body, 'rotation[z]', death, [0, 0.08, -0.26, -0.65, -0.9]), track(head, 'rotation[x]', death, [0, -0.16, 0.32, 0.7, 1]),
            track(ll, 'rotation[x]', death, [0, 0.12, -0.28, -0.72, -1]), track(rl, 'rotation[x]', death, [0, -0.14, 0.34, 0.82, 1.1]),
            track(la, 'rotation[z]', death, [-0.08, -0.38, -0.78, -1.1, -1.28]), track(ra, 'rotation[z]', death, [0.08, 0.42, 0.82, 1.18, 1.34]),
            track(weapon, 'rotation[z]', death, [-0.14, 0.14, 0.65, 1.22, 1.56]), track(accent, 'rotation[z]', death, [0, -0.28, 0.58, 1.12, 1.44])
        ])
    ];
}

function addLightningCage(parent, type, materials, radius = 0.7, height = 1.2) {
    const rod = geometry(`${type}-lightning-rod`, () => new THREE.CylinderGeometry(0.045, 0.065, height, 5));
    for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        mesh(parent, `${type}_LightningRod${index + 1}`, rod, materials.silver, { position: [Math.sin(angle) * radius, 0.72, Math.cos(angle) * radius], rotation: [0, 0, Math.sin(angle) * 0.18] });
    }
    mesh(parent, `${type}_CaptiveStorm`, geometry(`${type}-captive-storm`, () => new THREE.IcosahedronGeometry(0.34, 0)), materials.white, { position: [0, 0.72, 0] });
    mesh(parent, `${type}_StormHalo`, geometry(`${type}-storm-halo`, () => new THREE.TorusGeometry(radius, 0.065, 5, 14)), materials.sky, { position: [0, 0.72, 0], rotation: [Math.PI / 2, 0, 0] });
}

export function createProceduralWindshear() {
    const type = 'Windshear';
    const materials = createMaterials(type, PROCEDURAL_TEMPEST_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addConductorSeal(root, type, 1.65, materials, 14);
    const frame = addStormFrame(root, type, materials, { width: 0.94, bodyY: 2.55, floating: true });
    addLightningCage(frame.body, type, materials, 0.62, 1.18);
    const vane = geometry('windshear-vane', () => new THREE.ConeGeometry(0.22, 1.35, 4));
    for (let index = 0; index < 14; index += 1) {
        const angle = index / 14 * Math.PI * 2;
        mesh(frame.accent, `${type}_RazorVane${index + 1}`, vane, index % 4 === 0 ? materials.white : materials.silver, { position: [Math.sin(angle) * 1.22, 0.72 + Math.cos(angle) * 1.22, 0], rotation: [0, 0, -angle], scale: [1, 0.75 + (index % 3) * 0.2, 0.5] });
    }
    for (let index = 0; index < 6; index += 1) mesh(frame.body, `${type}_VacuumRing${index + 1}`, geometry(`windshear-ring-${index}`, () => new THREE.TorusGeometry(0.72 + index * 0.16, 0.045, 5, 16)), index % 2 ? materials.sky : materials.violet, { position: [0, -0.42 - index * 0.2, 0], rotation: [Math.PI / 2 + index * 0.08, 0, index * 0.24] });
    mesh(frame.weapon, `${type}_GaleScytheShaft`, geometry('windshear-shaft', () => new THREE.CylinderGeometry(0.065, 0.1, 2.7, 6)), materials.silver, { position: [0, -0.86, 0] });
    mesh(frame.weapon, `${type}_GaleScythe`, geometry('windshear-scythe', () => new THREE.TorusGeometry(0.62, 0.1, 5, 12, Math.PI * 1.3)), materials.white, { position: [0.18, -2.1, 0], rotation: [Math.PI / 2, 0, 0.3] });
    addStormOrbit(frame.accent, type, materials, 9, 1.45, 'PressureShard');
    return finalize(root, type, createStandardClips(type, frame.bodyY, { stride: 0.5, reach: 1.08, fall: 0.72 }));
}

export function createProceduralStormcallers() {
    const type = 'Stormcallers';
    const materials = createMaterials(type, PROCEDURAL_TEMPEST_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addConductorSeal(root, type, 1.82, materials, 16);
    const frame = addStormFrame(root, type, materials, { width: 1.05, bodyY: 2.38, floating: true });
    frame.head.visible = false;
    for (const [name, sign] of [['Voltara', 1], ['Zephyros', -1]]) {
        const oracle = pivot(frame.body, `${type}_${name}`, [sign * 0.88, 1.45, -0.04], [0, sign * 0.12, sign * -0.05]);
        mesh(oracle, `${type}_${name}Torso`, geometry('stormcaller-torso', () => new THREE.DodecahedronGeometry(0.62, 0)), name === 'Voltara' ? materials.violet : materials.storm, { scale: [0.9, 1.15, 0.7] });
        mesh(oracle, `${type}_${name}Mask`, geometry('stormcaller-mask', () => new THREE.OctahedronGeometry(0.42, 0)), materials.slate, { position: [0, 1, 0.08], scale: [0.9, 1.1, 0.75] });
        mesh(oracle, `${type}_${name}Eye`, geometry('stormcaller-eye', () => new THREE.BoxGeometry(0.3, 0.08, 0.07)), name === 'Voltara' ? materials.white : materials.sky, { position: [0, 1.03, 0.44] });
        for (let index = 0; index < 7; index += 1) {
            const angle = index / 7 * Math.PI * 2;
            mesh(oracle, `${type}_${name}Halo${index + 1}`, geometry('stormcaller-halo-node', () => new THREE.OctahedronGeometry(0.11, 0)), name === 'Voltara' ? materials.white : materials.sky, { position: [Math.sin(angle) * 0.62, 1.35 + Math.cos(angle) * 0.62, -0.06] });
        }
    }
    addLightningCage(frame.body, type, materials, 0.62, 1.28);
    mesh(frame.weapon, `${type}_ConvergenceStaff`, geometry('stormcaller-staff', () => new THREE.CylinderGeometry(0.07, 0.11, 3, 6)), materials.silver, { position: [0, -1, 0] });
    mesh(frame.weapon, `${type}_ConvergenceFork`, geometry('stormcaller-fork', () => new THREE.TorusGeometry(0.58, 0.085, 5, 12, Math.PI)), materials.sky, { position: [0, -2.42, 0], rotation: [0, 0, Math.PI] });
    addStormOrbit(frame.accent, type, materials, 10, 1.55, 'ConvergenceSpark');
    return finalize(root, type, createStandardClips(type, frame.bodyY, { stride: 0.46, reach: 1.1, fall: 0.78 }));
}

export function createProceduralRocMatriarch() {
    const type = 'RocMatriarch';
    const materials = createMaterials(type, PROCEDURAL_TEMPEST_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addConductorSeal(root, type, 2.15, materials, 18);
    const bodyY = 2.45;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    mesh(body, `${type}_ThunderKeel`, geometry('roc-body', () => new THREE.DodecahedronGeometry(0.9, 0)), materials.storm, { scale: [1.1, 1, 1.55] });
    mesh(body, `${type}_BreastStorm`, geometry('roc-breast', () => new THREE.IcosahedronGeometry(0.42, 0)), materials.white, { position: [0, -0.08, 0.83], scale: [0.9, 1.25, 0.5] });
    const head = pivot(body, `Rig_${type}Head`, [0, 0.48, 1.32], [-0.08, 0, 0]);
    mesh(head, `${type}_CrownedHead`, geometry('roc-head', () => new THREE.DodecahedronGeometry(0.48, 0)), materials.slate, { scale: [0.9, 1.05, 1.1] });
    const beak = pivot(head, `Rig_${type}Weapon`, [0, -0.08, 0.58]);
    mesh(beak, `${type}_SilverBeak`, geometry('roc-beak', () => new THREE.ConeGeometry(0.28, 0.95, 5)), materials.silver, { rotation: [Math.PI / 2, 0, 0], position: [0, 0, 0.36] });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        mesh(head, `${type}_Eye${side}`, geometry('roc-eye', () => new THREE.OctahedronGeometry(0.085, 0)), materials.sky, { position: [sign * 0.22, 0.12, 0.4] });
        const wing = pivot(body, `Rig_${type}Arm${side}`, [sign * 0.72, 0.32, 0], [0, 0, sign * -0.18]);
        for (let index = 0; index < 11; index += 1) mesh(wing, `${type}_${side}StormFeather${index + 1}`, geometry(`roc-feather-${index}`, () => new THREE.ConeGeometry(0.18 + index * 0.008, 1.45 + index * 0.18, 4)), index % 4 === 0 ? materials.sky : (index % 2 ? materials.silver : materials.storm), { position: [sign * (0.32 + index * 0.28), -0.12 - index * 0.055, -index * 0.04], rotation: [0, 0, sign * (Math.PI / 2 + 0.06 + index * 0.015)], scale: [1, 1, 0.55] });
        const talon = pivot(body, `Rig_${type}Leg${side}`, [sign * 0.45, -0.7, 0.3]);
        mesh(talon, `${type}_${side}Tarsus`, geometry('roc-tarsus', () => new THREE.CylinderGeometry(0.1, 0.14, 0.95, 5)), materials.silver, { position: [0, -0.35, 0] });
        for (let index = 0; index < 4; index += 1) mesh(talon, `${type}_${side}Talon${index + 1}`, geometry('roc-talon', () => new THREE.ConeGeometry(0.06, 0.5, 5)), materials.white, { position: [(index - 1.5) * 0.12, -0.88, 0.16 + Math.abs(index - 1.5) * 0.08], rotation: [Math.PI / 2, 0, 0] });
    }
    const accent = pivot(body, `Rig_${type}Accent`, [0, 0.1, -1.2]);
    for (let index = 0; index < 9; index += 1) mesh(accent, `${type}_TailFeather${index + 1}`, geometry(`roc-tail-${index}`, () => new THREE.ConeGeometry(0.14, 1.5 + index * 0.08, 4)), index % 3 === 0 ? materials.sky : materials.storm, { position: [(index - 4) * 0.18, -0.1, -index * 0.08], rotation: [Math.PI / 2 + 0.18, 0, (index - 4) * 0.08], scale: [1, 1, 0.5] });
    for (let index = 0; index < 7; index += 1) mesh(head, `${type}_CrownFeather${index + 1}`, geometry('roc-crown-feather', () => new THREE.ConeGeometry(0.09, 0.72, 4)), index === 3 ? materials.white : materials.sky, { position: [(index - 3) * 0.12, 0.45, -0.08], rotation: [0, 0, (index - 3) * -0.12] });
    return finalize(root, type, createStandardClips(type, bodyY, { stride: 0.68, reach: 1.15, fall: 0.9 }));
}

export function createProceduralThunderlordKaelix() {
    const type = 'ThunderlordKaelix';
    const materials = createMaterials(type, PROCEDURAL_TEMPEST_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addConductorSeal(root, type, 2.05, materials, 16);
    const frame = addStormFrame(root, type, materials, { width: 1.5, bodyY: 2.48 });
    addLightningCage(frame.body, type, materials, 0.78, 1.52);
    const rod = geometry('kaelix-conductor', () => new THREE.CylinderGeometry(0.09, 0.13, 1.65, 6));
    for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2;
        mesh(frame.body, `${type}_ThroneConductor${index + 1}`, rod, materials.silver, { position: [Math.sin(angle) * 1.25, 1.1 + (index % 3) * 0.4, Math.cos(angle) * 0.7], rotation: [Math.sin(angle) * 0.24, 0, -Math.cos(angle) * 0.24] });
        mesh(frame.body, `${type}_ConductorSpark${index + 1}`, geometry('kaelix-spark', () => new THREE.OctahedronGeometry(0.13, 0)), index % 3 === 0 ? materials.white : materials.sky, { position: [Math.sin(angle) * 1.25, 2 + (index % 3) * 0.4, Math.cos(angle) * 0.7] });
    }
    for (let index = 0; index < 9; index += 1) mesh(frame.head, `${type}_StormBellCrown${index + 1}`, geometry('kaelix-crown', () => new THREE.ConeGeometry(0.11, 1.08, 5)), index % 3 === 0 ? materials.white : materials.silver, { position: [Math.sin(index * 0.7) * 0.55, 0.42, Math.cos(index * 0.7) * 0.55], rotation: [0, 0, -Math.cos(index * 0.7) * 0.18] });
    mesh(frame.weapon, `${type}_ThunderMaulShaft`, geometry('kaelix-maul-shaft', () => new THREE.CylinderGeometry(0.12, 0.16, 3.2, 7)), materials.silver, { position: [0, -1.05, 0] });
    mesh(frame.weapon, `${type}_StormBellMaul`, geometry('kaelix-maul', () => new THREE.CylinderGeometry(0.68, 0.9, 1.25, 8)), materials.slate, { position: [0, -2.48, 0], rotation: [0, 0, Math.PI / 2] });
    mesh(frame.weapon, `${type}_MaulStorm`, geometry('kaelix-maul-storm', () => new THREE.IcosahedronGeometry(0.3, 0)), materials.white, { position: [0, -2.48, 0.72] });
    addStormOrbit(frame.accent, type, materials, 12, 1.65, 'ThunderBrand');
    return finalize(root, type, createStandardClips(type, frame.bodyY, { stride: 0.28, reach: 1.18, fall: 1.05 }));
}

export function createProceduralZephyrion() {
    const type = 'Zephyrion';
    const materials = createMaterials(type, PROCEDURAL_TEMPEST_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addConductorSeal(root, type, 2.4, materials, 20);
    const frame = addStormFrame(root, type, materials, { width: 1.45, bodyY: 2.7, floating: true });
    addLightningCage(frame.body, type, materials, 0.9, 1.7);
    for (let index = 0; index < 9; index += 1) mesh(frame.body, `${type}_EternalGaleRing${index + 1}`, geometry(`zephyrion-ring-${index}`, () => new THREE.TorusGeometry(0.8 + index * 0.17, 0.055, 5, 18)), index % 3 === 0 ? materials.white : (index % 2 ? materials.sky : materials.violet), { position: [0, -0.38 + index * 0.2, 0], rotation: [Math.PI / 2 + index * 0.13, index * 0.11, index * 0.27] });
    const crown = geometry('zephyrion-crown', () => new THREE.ConeGeometry(0.13, 1.55, 5));
    for (let index = 0; index < 13; index += 1) {
        const angle = index / 13 * Math.PI * 2;
        mesh(frame.head, `${type}_EyeCrown${index + 1}`, crown, index % 4 === 0 ? materials.white : materials.silver, { position: [Math.sin(angle) * 0.7, 0.45 + (index % 2) * 0.14, Math.cos(angle) * 0.7], rotation: [Math.sin(angle) * 0.22, 0, -Math.cos(angle) * 0.22] });
    }
    const blade = geometry('zephyrion-wind-blade', () => new THREE.ConeGeometry(0.2, 1.65, 4));
    for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        mesh(frame.accent, `${type}_HorizonBlade${index + 1}`, blade, index % 4 === 0 ? materials.white : materials.sky, { position: [Math.sin(angle) * 2.05, Math.sin(angle * 2) * 0.42, Math.cos(angle) * 2.05], rotation: [Math.PI / 2, angle, angle] });
    }
    mesh(frame.weapon, `${type}_SkyScepter`, geometry('zephyrion-scepter', () => new THREE.CylinderGeometry(0.1, 0.15, 3.5, 7)), materials.silver, { position: [0, -1.15, 0] });
    mesh(frame.weapon, `${type}_StormEye`, geometry('zephyrion-eye', () => new THREE.TorusKnotGeometry(0.48, 0.12, 32, 6, 2, 3)), materials.white, { position: [0, -2.82, 0], rotation: [Math.PI / 2, 0, 0] });
    addStormOrbit(frame.accent, type, materials, 14, 2.35, 'EyeShard');
    return finalize(root, type, createStandardClips(type, frame.bodyY, { stride: 0.5, reach: 1.22, fall: 0.92 }));
}

export function createProceduralTempestBoss(type) {
    switch (type) {
        case 'Windshear': return createProceduralWindshear();
        case 'Stormcallers': return createProceduralStormcallers();
        case 'RocMatriarch': return createProceduralRocMatriarch();
        case 'ThunderlordKaelix': return createProceduralThunderlordKaelix();
        case 'Zephyrion': return createProceduralZephyrion();
        default: throw new Error(`Unknown procedural Tempest Spire boss: ${type}`);
    }
}

export function getProceduralTempestBossCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
