import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_THORNCRYPT_BOSS_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const PROCEDURAL_THORNCRYPT_BOSS_DEFINITIONS = Object.freeze({
    RootboundWarden: Object.freeze({
        artStyle: 'Thorncrypt root-gate warden',
        region: 'Verdant Bastion — The Thorncrypt',
        faction: 'rootbound ossuary',
        bounds: Object.freeze({ radius: 2, height: 5.35, origin: 'feet' }),
        combatRadius: 2,
        palette: Object.freeze({ bark: 0x34402d, stone: 0x596153, bronze: 0x706044, ivy: 0x587044, bone: 0xc0b99d, witchlight: 0x9ee087 })
    }),
    BriarMatron: Object.freeze({
        artStyle: 'Thorncrypt briar-crown matron',
        region: 'Verdant Bastion — The Thorncrypt',
        faction: 'briar sepulchre',
        bounds: Object.freeze({ radius: 1.84, height: 5.56, origin: 'feet' }),
        combatRadius: 1.5,
        palette: Object.freeze({ bark: 0x352e2d, stone: 0x49433e, petal: 0x673f4b, bronze: 0x75634a, ivy: 0x51663d, bone: 0xc7bca5, witchlight: 0xb2ef8c })
    }),
    RustboundColossus: Object.freeze({
        artStyle: 'Thorncrypt rust-reliquary colossus',
        region: 'Verdant Bastion — The Thorncrypt',
        faction: 'tarnished procession',
        bounds: Object.freeze({ radius: 3, height: 5.86, origin: 'feet' }),
        combatRadius: 3,
        palette: Object.freeze({ bark: 0x39382f, stone: 0x4c5147, bronze: 0x79543c, rust: 0x8b4e33, bone: 0xb9b092, witchlight: 0x96d878 })
    }),
    HollowSentinel: Object.freeze({
        artStyle: 'Thorncrypt hollow-vigil sentinel',
        region: 'Verdant Bastion — The Thorncrypt',
        faction: 'empty vigil',
        bounds: Object.freeze({ radius: 2.5, height: 6.75, origin: 'feet' }),
        combatRadius: 2.5,
        palette: Object.freeze({ bark: 0x242d27, stone: 0x465047, bronze: 0x6e6048, void: 0x111813, bone: 0xc4bca2, witchlight: 0xb7ff91 })
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
            roughness: options.roughness ?? 0.84,
            metalness: options.metalness ?? 0,
            emissive: options.emissive ?? 0x000000,
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

function createMaterials(type, palette) {
    return {
        bark: material(`${type}-bark`, palette.bark, { roughness: 0.96 }),
        stone: material(`${type}-stone`, palette.stone ?? palette.void, { roughness: 0.9 }),
        bronze: material(`${type}-bronze`, palette.bronze, { roughness: 0.52, metalness: 0.68 }),
        accent: material(`${type}-accent`, palette.petal ?? palette.ivy ?? palette.rust ?? palette.void, { roughness: 0.82, metalness: palette.rust ? 0.42 : 0 }),
        bone: material(`${type}-bone`, palette.bone, { roughness: 0.76 }),
        glow: material(`${type}-witchlight`, palette.witchlight, {
            roughness: 0.28,
            emissive: palette.witchlight,
            emissiveIntensity: 1.75
        })
    };
}

function installRestPoseReset(root) {
    const restPose = [];
    root.traverse((object) => restPose.push({
        object,
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
        visible: object.visible
    }));
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
    const definition = PROCEDURAL_THORNCRYPT_BOSS_DEFINITIONS[type];
    root.updateMatrixWorld(true);
    const initialBounds = new THREE.Box3().setFromObject(root);
    const groundOffset = Math.max(0, -initialBounds.min.y);
    if (groundOffset > 0) {
        const body = root.getObjectByName(`Rig_${type}Body`);
        body.position.y += groundOffset;
        const bodyPositionTrack = clips
            .flatMap((clip) => clip.tracks)
            .filter((animationTrack) => animationTrack.name === `Rig_${type}Body.position[y]`);
        bodyPositionTrack.forEach((animationTrack) => {
            for (let index = 0; index < animationTrack.values.length; index += 1) {
                animationTrack.values[index] += groundOffset;
            }
        });
        root.updateMatrixWorld(true);
    }
    root.name = `Procedural${type}`;
    root.userData.proceduralEnemyFamily = true;
    root.userData.proceduralBossFamily = 'thorncrypt';
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

function addSigil(root, type, radius, materials) {
    mesh(root, `${type}_CryptSigil`, geometry('thorncrypt-sigil-ring', () => new THREE.RingGeometry(0.78, 0.86, 12)), materials.glow, {
        position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius], castShadow: false, receiveShadow: false
    });
    const thorn = geometry('thorncrypt-sigil-thorn', () => new THREE.ConeGeometry(0.075, 0.42, 4));
    for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        mesh(root, `${type}_SigilThorn${index + 1}`, thorn, materials.glow, {
            position: [Math.sin(angle) * radius * 0.72, 0.12, Math.cos(angle) * radius * 0.72],
            rotation: [Math.PI / 2, angle, 0],
            scale: [1, 1.25, 1],
            castShadow: false,
            receiveShadow: false
        });
    }
}

function addFrame(root, type, materials, profile = {}) {
    const bodyY = profile.bodyY ?? 2.08;
    const width = profile.width ?? 1;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    const legGeometry = geometry(`${type}-leg`, () => new THREE.CylinderGeometry(0.24 * width, 0.3 * width, 0.92, 6));
    const footGeometry = geometry(`${type}-foot`, () => new THREE.BoxGeometry(0.52 * width, 0.2, 0.78));
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const leg = pivot(body, `Rig_${type}Leg${side}`, [sign * 0.42 * width, -1.04, 0], [0, 0, sign * 0.02]);
        mesh(leg, `${type}_UpperLeg${side}`, legGeometry, materials.bark, { position: [0, 0.46, 0], scale: [1.12, 1, 1.12] });
        mesh(leg, `${type}_LowerLeg${side}`, legGeometry, materials.stone, { position: [0, -0.45, 0.03], scale: [0.92, 0.95, 0.92] });
        mesh(leg, `${type}_RootFoot${side}`, footGeometry, materials.bark, { position: [0, -0.94, 0.18] });
    }
    mesh(body, `${type}_Pelvis`, geometry(`${type}-pelvis`, () => new THREE.CylinderGeometry(0.58 * width, 0.68 * width, 0.58, 7)), materials.bark, { position: [0, -0.28, 0] });
    mesh(body, `${type}_Torso`, geometry(`${type}-torso`, () => new THREE.DodecahedronGeometry(0.82, 0)), materials.stone, {
        position: [0, 0.72, 0], scale: [width, 1.08, 0.72]
    });
    mesh(body, `${type}_BreastReliquary`, geometry(`${type}-chest`, () => new THREE.BoxGeometry(1.1 * width, 0.94, 0.32)), materials.bronze, { position: [0, 0.73, 0.58] });
    const head = pivot(body, `Rig_${type}Head`, [0, 1.78, 0.02]);
    mesh(head, `${type}_Head`, geometry(`${type}-head`, () => new THREE.DodecahedronGeometry(0.48, 0)), materials.bark, { scale: [width, 1, 0.88] });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        mesh(head, `${type}_Eye${side}`, geometry('thorncrypt-eye', () => new THREE.OctahedronGeometry(0.065, 0)), materials.glow, { position: [sign * 0.18 * width, 0.07, 0.42] });
        const arm = pivot(body, `Rig_${type}Arm${side}`, [sign * 0.9 * width, 1.05, 0], [0, 0, sign * -0.1]);
        mesh(arm, `${type}_UpperArm${side}`, geometry(`${type}-upper-arm`, () => new THREE.CylinderGeometry(0.28 * width, 0.22 * width, 0.92, 6)), materials.bark, { position: [0, -0.44, 0] });
        mesh(arm, `${type}_Forearm${side}`, geometry(`${type}-forearm`, () => new THREE.CylinderGeometry(0.22 * width, 0.17 * width, 0.78, 6)), materials.stone, { position: [0, -1.24, 0.02] });
        mesh(body, `${type}_Shoulder${side}`, geometry(`${type}-shoulder`, () => new THREE.ConeGeometry(0.42 * width, 0.72, 5)), materials.bronze, {
            position: [sign * 0.92 * width, 1.12, 0], rotation: [0, 0, sign * -Math.PI / 2]
        });
    }
    return {
        body,
        head,
        leftArm: body.getObjectByName(`Rig_${type}ArmLeft`),
        rightArm: body.getObjectByName(`Rig_${type}ArmRight`),
        weapon: pivot(body.getObjectByName(`Rig_${type}ArmRight`), `Rig_${type}Weapon`, [0, -1.52, 0.05], [0, 0, -0.18]),
        accent: pivot(body, `Rig_${type}Accent`, [0, 0.7, -0.38])
    };
}

function createClips(type, bodyY, options = {}) {
    const stride = options.stride ?? 0.42;
    const reach = options.reach ?? 1;
    const fall = options.fall ?? 0.72;
    const body = `Rig_${type}Body`;
    const head = `Rig_${type}Head`;
    const leftLeg = `Rig_${type}LegLeft`;
    const rightLeg = `Rig_${type}LegRight`;
    const leftArm = `Rig_${type}ArmLeft`;
    const rightArm = `Rig_${type}ArmRight`;
    const weapon = `Rig_${type}Weapon`;
    const accent = `Rig_${type}Accent`;
    const idle = [0, 0.65, 1.3, 1.95, 2.6];
    const walk = [0, 0.38, 0.76, 1.14, 1.52];
    const run = [0, 0.24, 0.48, 0.72, 0.96];
    const attack = [0, 0.22, 0.48, 0.78, 1.15];
    const death = [0, 0.36, 0.78, 1.25, 1.8];
    return [
        new THREE.AnimationClip('Idle', 2.6, [
            track(body, 'position[y]', idle, [bodyY, bodyY + 0.045, bodyY, bodyY - 0.025, bodyY]),
            track(body, 'rotation[y]', idle, [0, 0.018, 0, -0.018, 0]),
            track(head, 'rotation[y]', idle, [0, 0.09, 0, -0.09, 0]),
            track(head, 'rotation[z]', idle, [0, 0.025, 0, -0.025, 0]),
            track(leftArm, 'rotation[z]', idle, [-0.1, -0.16, -0.1, -0.04, -0.1]),
            track(rightArm, 'rotation[z]', idle, [0.1, 0.16, 0.1, 0.04, 0.1]),
            track(leftLeg, 'rotation[z]', idle, [0.02, 0.03, 0.02, 0.01, 0.02]),
            track(weapon, 'rotation[z]', idle, [-0.18, -0.12, -0.18, -0.24, -0.18]),
            track(accent, 'rotation[y]', idle, [0, 0.28, 0.56, 0.84, 1.12]),
            track(accent, 'position[y]', idle, [0.7, 0.76, 0.7, 0.65, 0.7])
        ]),
        new THREE.AnimationClip('Walk', 1.52, [
            track(body, 'position[y]', walk, [bodyY, bodyY + 0.09, bodyY, bodyY + 0.09, bodyY]),
            track(body, 'rotation[z]', walk, [0, 0.04, 0, -0.04, 0]),
            track(leftLeg, 'rotation[x]', walk, [stride, 0, -stride, 0, stride]),
            track(rightLeg, 'rotation[x]', walk, [-stride, 0, stride, 0, -stride]),
            track(leftArm, 'rotation[x]', walk, [-stride * 0.72, 0, stride * 0.72, 0, -stride * 0.72]),
            track(rightArm, 'rotation[x]', walk, [stride * 0.72, 0, -stride * 0.72, 0, stride * 0.72]),
            track(head, 'rotation[y]', walk, [0, -0.045, 0, 0.045, 0]),
            track(weapon, 'rotation[z]', walk, [-0.18, -0.02, -0.18, -0.34, -0.18]),
            track(accent, 'rotation[z]', walk, [0, 0.2, 0, -0.2, 0])
        ]),
        new THREE.AnimationClip('Run', 0.96, [
            track(body, 'position[y]', run, [bodyY, bodyY + 0.15, bodyY, bodyY + 0.15, bodyY]),
            track(body, 'rotation[x]', run, [0.12, 0.2, 0.12, 0.2, 0.12]),
            track(leftLeg, 'rotation[x]', run, [stride * 1.55, 0, -stride * 1.55, 0, stride * 1.55]),
            track(rightLeg, 'rotation[x]', run, [-stride * 1.55, 0, stride * 1.55, 0, -stride * 1.55]),
            track(leftArm, 'rotation[x]', run, [-stride, 0, stride, 0, -stride]),
            track(rightArm, 'rotation[x]', run, [stride, 0, -stride, 0, stride]),
            track(head, 'rotation[x]', run, [-0.03, 0.04, -0.03, 0.04, -0.03]),
            track(weapon, 'rotation[z]', run, [-0.18, 0.12, -0.18, -0.48, -0.18]),
            track(accent, 'rotation[z]', run, [0, 0.34, 0, -0.34, 0])
        ]),
        new THREE.AnimationClip('Attack', 1.15, [
            track(body, 'position[y]', attack, [bodyY, bodyY + 0.05, bodyY + 0.14, bodyY - 0.05, bodyY]),
            track(body, 'rotation[y]', attack, [0, -0.24, -0.52, 0.38, 0]),
            track(head, 'rotation[y]', attack, [0, 0.13, 0.24, -0.16, 0]),
            track(leftLeg, 'rotation[x]', attack, [0, 0.14, 0.25, -0.12, 0]),
            track(rightLeg, 'rotation[x]', attack, [0, -0.18, -0.3, 0.14, 0]),
            track(leftArm, 'rotation[x]', attack, [0, -0.3, -0.5, 0.28, 0]),
            track(rightArm, 'rotation[x]', attack, [0, -0.7 * reach, -1.22 * reach, 0.98 * reach, 0]),
            track(weapon, 'rotation[z]', attack, [-0.18, -0.92 * reach, -1.5 * reach, 1.02 * reach, -0.18]),
            track(accent, 'rotation[y]', attack, [0, -0.38, -0.82, 0.92, 0])
        ]),
        new THREE.AnimationClip('Death', 1.8, [
            track(body, 'position[y]', death, [bodyY, bodyY + 0.04, bodyY - 0.18, bodyY - fall * 0.72, bodyY - fall]),
            track(body, 'rotation[x]', death, [0, -0.12, 0.32, 0.94, 1.4]),
            track(body, 'rotation[z]', death, [0, 0.06, -0.22, -0.6, -0.84]),
            track(head, 'rotation[x]', death, [0, -0.15, 0.28, 0.65, 0.94]),
            track(leftLeg, 'rotation[x]', death, [0, 0.1, -0.24, -0.66, -0.94]),
            track(rightLeg, 'rotation[x]', death, [0, -0.12, 0.3, 0.76, 1.04]),
            track(leftArm, 'rotation[z]', death, [-0.1, -0.34, -0.7, -1.04, -1.22]),
            track(rightArm, 'rotation[z]', death, [0.1, 0.38, 0.76, 1.1, 1.28]),
            track(weapon, 'rotation[z]', death, [-0.18, 0.1, 0.58, 1.14, 1.48]),
            track(accent, 'rotation[z]', death, [0, -0.24, 0.5, 1.02, 1.34])
        ])
    ];
}

function addCrown(parent, type, count, radius, height, materials, startY = 0.28) {
    const crownSpike = geometry(`${type}-crown-spike`, () => new THREE.ConeGeometry(0.095, height, 5));
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        mesh(parent, `${type}_CrownSpike${index + 1}`, crownSpike, index % 2 ? materials.bone : materials.bronze, {
            position: [Math.sin(angle) * radius, startY + (index % 2) * 0.08, Math.cos(angle) * radius],
            rotation: [Math.sin(angle) * 0.16, 0, -Math.cos(angle) * 0.16]
        });
    }
}

function addOrbit(parent, type, count, radius, materials, yScale = 1) {
    const shard = geometry(`${type}-orbit-shard`, () => new THREE.OctahedronGeometry(0.13, 0));
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        mesh(parent, `${type}_WitchShard${index + 1}`, shard, index % 3 === 0 ? materials.glow : materials.bronze, {
            position: [Math.sin(angle) * radius, Math.sin(angle * 2) * 0.24 * yScale, Math.cos(angle) * radius],
            rotation: [angle, angle * 0.5, angle]
        });
    }
}

export function createProceduralRootboundWarden() {
    const type = 'RootboundWarden';
    const definition = PROCEDURAL_THORNCRYPT_BOSS_DEFINITIONS[type];
    const materials = createMaterials(type, definition.palette);
    const root = new THREE.Group();
    addSigil(root, type, 1.45, materials);
    const frame = addFrame(root, type, materials, { width: 1.18 });
    addCrown(frame.head, type, 7, 0.42, 0.9, materials, 0.38);
    const rootSpike = geometry('rootbound-back-root', () => new THREE.ConeGeometry(0.14, 1.55, 5));
    for (let index = 0; index < 8; index += 1) {
        const sign = index % 2 ? 1 : -1;
        mesh(frame.body, `${type}_BackRoot${index + 1}`, rootSpike, materials.bark, {
            position: [sign * (0.42 + (index % 4) * 0.18), 0.6 + Math.floor(index / 2) * 0.32, -0.58],
            rotation: [-0.42, 0, sign * (0.35 + index * 0.06)]
        });
    }
    const plate = geometry('rootbound-gate-plate', () => new THREE.BoxGeometry(0.42, 0.62, 0.16));
    for (let index = 0; index < 6; index += 1) {
        mesh(frame.body, `${type}_GatePlate${index + 1}`, plate, index % 2 ? materials.stone : materials.bronze, {
            position: [((index % 3) - 1) * 0.43, 0.48 + Math.floor(index / 3) * 0.62, 0.68],
            rotation: [0, 0, ((index % 3) - 1) * 0.05]
        });
    }
    const leaf = geometry('thorncrypt-ivy-leaf', () => new THREE.OctahedronGeometry(0.11, 0));
    for (let index = 0; index < 10; index += 1) {
        mesh(frame.accent, `${type}_FuneraryIvy${index + 1}`, leaf, materials.accent, {
            position: [Math.sin(index * 1.9) * 0.78, 0.82 - index * 0.17, Math.cos(index * 1.9) * 0.18],
            scale: [1.4, 0.75, 0.45]
        });
    }
    mesh(frame.weapon, `${type}_GraveMaulShaft`, geometry('rootbound-maul-shaft', () => new THREE.CylinderGeometry(0.09, 0.12, 2.4, 6)), materials.bronze, { position: [0, -0.72, 0] });
    mesh(frame.weapon, `${type}_GateMaul`, geometry('rootbound-maul-head', () => new THREE.BoxGeometry(1.18, 0.72, 0.68)), materials.stone, { position: [0, -1.78, 0] });
    mesh(frame.weapon, `${type}_MaulWitchlight`, geometry('rootbound-maul-light', () => new THREE.OctahedronGeometry(0.22, 0)), materials.glow, { position: [0, -1.78, 0.4] });
    addOrbit(frame.accent, type, 6, 1.15, materials, 0.5);
    return finalize(root, type, createClips(type, 2.08, { stride: 0.34, reach: 1.08, fall: 0.82 }));
}

export function createProceduralBriarMatron() {
    const type = 'BriarMatron';
    const definition = PROCEDURAL_THORNCRYPT_BOSS_DEFINITIONS[type];
    const materials = createMaterials(type, definition.palette);
    const root = new THREE.Group();
    addSigil(root, type, 1.22, materials);
    const frame = addFrame(root, type, materials, { width: 0.82 });
    addCrown(frame.head, type, 11, 0.5, 1.15, materials, 0.42);
    const petal = geometry('briar-matron-petal', () => new THREE.ConeGeometry(0.32, 1.45, 5));
    for (let index = 0; index < 12; index += 1) {
        const angle = index * Math.PI / 6;
        mesh(frame.body, `${type}_SepulchrePetal${index + 1}`, petal, index % 3 === 0 ? materials.bronze : materials.accent, {
            position: [Math.sin(angle) * 0.7, -0.35, Math.cos(angle) * 0.7],
            rotation: [Math.sin(angle) * 0.45, 0, -Math.cos(angle) * 0.45],
            scale: [1, 1 + (index % 2) * 0.18, 0.7]
        });
    }
    const thorn = geometry('briar-matron-thorn', () => new THREE.ConeGeometry(0.085, 0.62, 5));
    for (let index = 0; index < 12; index += 1) {
        const angle = index * Math.PI / 6;
        mesh(frame.accent, `${type}_HaloThorn${index + 1}`, thorn, index % 4 === 0 ? materials.glow : materials.bone, {
            position: [Math.sin(angle) * 1.08, 0.66 + Math.cos(angle) * 1.08, 0],
            rotation: [0, 0, -angle]
        });
    }
    mesh(frame.weapon, `${type}_BriarStaff`, geometry('briar-staff', () => new THREE.CylinderGeometry(0.065, 0.11, 2.65, 6)), materials.bark, { position: [0, -0.85, 0] });
    mesh(frame.weapon, `${type}_CrescentSickle`, geometry('briar-sickle', () => new THREE.TorusGeometry(0.5, 0.09, 5, 10, Math.PI * 1.35)), materials.bronze, { position: [0.12, -2.08, 0], rotation: [Math.PI / 2, 0, 0.25] });
    mesh(frame.weapon, `${type}_SickleBud`, geometry('briar-bud', () => new THREE.IcosahedronGeometry(0.2, 0)), materials.glow, { position: [0, -1.78, 0] });
    addOrbit(frame.accent, type, 8, 1.32, materials, 0.9);
    return finalize(root, type, createClips(type, 2.08, { stride: 0.48, reach: 0.95, fall: 0.68 }));
}

export function createProceduralRustboundColossus() {
    const type = 'RustboundColossus';
    const definition = PROCEDURAL_THORNCRYPT_BOSS_DEFINITIONS[type];
    const materials = createMaterials(type, definition.palette);
    const root = new THREE.Group();
    addSigil(root, type, 1.72, materials);
    const frame = addFrame(root, type, materials, { width: 1.48, bodyY: 2.16 });
    addCrown(frame.head, type, 6, 0.52, 0.86, materials, 0.42);
    const armor = geometry('rustbound-armor-slab', () => new THREE.BoxGeometry(0.72, 0.72, 0.22));
    for (let index = 0; index < 10; index += 1) {
        const angle = (index / 10) * Math.PI * 2;
        mesh(frame.body, `${type}_ReliquarySlab${index + 1}`, armor, index % 2 ? materials.bronze : materials.stone, {
            position: [Math.sin(angle) * 1.18, 0.65 + (index % 3) * 0.36, Math.cos(angle) * 0.68],
            rotation: [0, angle, Math.sin(angle) * 0.12],
            scale: [1, 1 + (index % 2) * 0.22, 1]
        });
    }
    const rivet = geometry('rustbound-rivet', () => new THREE.IcosahedronGeometry(0.095, 0));
    for (let index = 0; index < 12; index += 1) {
        mesh(frame.body, `${type}_ProcessionRivet${index + 1}`, rivet, index % 3 === 0 ? materials.glow : materials.accent, {
            position: [((index % 4) - 1.5) * 0.38, 0.28 + Math.floor(index / 4) * 0.5, 0.86]
        });
    }
    const pipe = geometry('rustbound-pipe', () => new THREE.CylinderGeometry(0.1, 0.13, 1.15, 6));
    for (let index = 0; index < 6; index += 1) {
        const sign = index % 2 ? 1 : -1;
        mesh(frame.accent, `${type}_FuneralPipe${index + 1}`, pipe, materials.accent, {
            position: [sign * (0.5 + Math.floor(index / 2) * 0.26), 0.55 + Math.floor(index / 2) * 0.45, -0.15],
            rotation: [-0.18, 0, sign * 0.12]
        });
    }
    mesh(frame.weapon, `${type}_ProcessionHammerShaft`, geometry('rustbound-hammer-shaft', () => new THREE.CylinderGeometry(0.12, 0.16, 2.8, 7)), materials.bronze, { position: [0, -0.92, 0] });
    mesh(frame.weapon, `${type}_ProcessionHammer`, geometry('rustbound-hammer-head', () => new THREE.BoxGeometry(1.55, 0.82, 0.88)), materials.accent, { position: [0, -2.18, 0] });
    mesh(frame.weapon, `${type}_HammerReliquary`, geometry('rustbound-hammer-core', () => new THREE.OctahedronGeometry(0.28, 0)), materials.glow, { position: [0, -2.18, 0.53] });
    addOrbit(frame.accent, type, 6, 1.48, materials, 0.42);
    return finalize(root, type, createClips(type, 2.16, { stride: 0.3, reach: 1.12, fall: 0.92 }));
}

export function createProceduralHollowSentinel() {
    const type = 'HollowSentinel';
    const definition = PROCEDURAL_THORNCRYPT_BOSS_DEFINITIONS[type];
    const materials = createMaterials(type, definition.palette);
    const root = new THREE.Group();
    addSigil(root, type, 1.55, materials);
    const frame = addFrame(root, type, materials, { width: 1.22, bodyY: 2.12 });
    addCrown(frame.head, type, 9, 0.48, 1.28, materials, 0.42);
    mesh(frame.body, `${type}_HollowChest`, geometry('hollow-chest-void', () => new THREE.IcosahedronGeometry(0.48, 0)), materials.stone, { position: [0, 0.76, 0.68], scale: [1.2, 1.5, 0.38] });
    mesh(frame.body, `${type}_LastWitchlight`, geometry('hollow-heart', () => new THREE.OctahedronGeometry(0.24, 0)), materials.glow, { position: [0, 0.76, 0.94] });
    const rib = geometry('hollow-sentinel-rib', () => new THREE.TorusGeometry(0.62, 0.065, 5, 10, Math.PI));
    for (let index = 0; index < 8; index += 1) {
        mesh(frame.body, `${type}_EmptyRib${index + 1}`, rib, index % 2 ? materials.bone : materials.bronze, {
            position: [0, 0.25 + index * 0.19, 0.22], rotation: [Math.PI / 2, 0, index % 2 ? Math.PI : 0], scale: [1 - index * 0.035, 1, 1]
        });
    }
    const banner = geometry('hollow-banner', () => new THREE.ConeGeometry(0.3, 1.3, 3));
    for (let index = 0; index < 8; index += 1) {
        const sign = index % 2 ? 1 : -1;
        mesh(frame.accent, `${type}_VigilTatter${index + 1}`, banner, index % 3 === 0 ? materials.bronze : materials.stone, {
            position: [sign * (0.48 + Math.floor(index / 2) * 0.18), 0.55 - Math.floor(index / 2) * 0.25, -0.1],
            rotation: [0.1, 0, sign * 0.18], scale: [1, 1 + index * 0.04, 0.35]
        });
    }
    addOrbit(frame.accent, type, 12, 1.58, materials, 0.8);
    mesh(frame.weapon, `${type}_VigilPole`, geometry('hollow-pole', () => new THREE.CylinderGeometry(0.075, 0.11, 3.1, 6)), materials.bronze, { position: [0, -0.95, 0] });
    mesh(frame.weapon, `${type}_VigilBlade`, geometry('hollow-blade', () => new THREE.ConeGeometry(0.42, 1.35, 4)), materials.bone, { position: [0, -2.65, 0], rotation: [0, 0, Math.PI] });
    mesh(frame.weapon, `${type}_VigilEye`, geometry('hollow-weapon-eye', () => new THREE.IcosahedronGeometry(0.18, 0)), materials.glow, { position: [0, -2.02, 0.25] });
    return finalize(root, type, createClips(type, 2.12, { stride: 0.36, reach: 1.18, fall: 0.88 }));
}

export function createProceduralThorncryptBoss(type) {
    switch (type) {
        case 'RootboundWarden': return createProceduralRootboundWarden();
        case 'BriarMatron': return createProceduralBriarMatron();
        case 'RustboundColossus': return createProceduralRustboundColossus();
        case 'HollowSentinel': return createProceduralHollowSentinel();
        default: throw new Error(`Unknown procedural Thorncrypt boss: ${type}`);
    }
}

export function getProceduralThorncryptBossCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
