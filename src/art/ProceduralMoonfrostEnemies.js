import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_MOONFROST_ENEMY_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS = Object.freeze({
    MountainTroll: Object.freeze({
        artStyle: 'Moonfrost rimeback troll',
        region: 'Moonfrost Expanse',
        faction: 'rimebound',
        bounds: Object.freeze({ radius: 2.35, height: 5.3, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({
            hide: 0x52645f,
            rime: 0xb9d6cf,
            fur: 0x303b3d,
            bone: 0xc6c4ad,
            iron: 0x35434a,
            aurora: 0x7cf2d1
        })
    }),
    AquaGolem: Object.freeze({
        artStyle: 'Moonfrost drowned-cairn golem',
        region: 'Moonfrost Expanse',
        faction: 'drowned cairn',
        bounds: Object.freeze({ radius: 2.2, height: 4.75, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({
            stone: 0x344f55,
            deepStone: 0x23373e,
            barnacle: 0x87988a,
            iron: 0x3a484b,
            water: 0x41c7d5,
            soul: 0x9bf4e4
        })
    }),
    Siren: Object.freeze({
        artStyle: 'Moonfrost choir siren',
        region: 'Moonfrost Expanse',
        faction: 'drowned choir',
        bounds: Object.freeze({ radius: 1.85, height: 4.25, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({
            skin: 0x789999,
            shroud: 0x233842,
            fin: 0x426871,
            bone: 0xc8c7b3,
            silver: 0x74858e,
            voice: 0x85f1dc
        })
    }),
    FrostGuardian: Object.freeze({
        artStyle: 'Moonfrost glacial bell guardian',
        region: 'Moonfrost Expanse',
        faction: 'pale vigil',
        bounds: Object.freeze({ radius: 2.15, height: 5.35, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({
            ice: 0x9fc7ca,
            deepIce: 0x3c626c,
            armor: 0x354750,
            silver: 0x82959b,
            cloth: 0x27363f,
            aurora: 0x91f5dc
        })
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
            roughness: options.roughness ?? 0.82,
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
    const definition = PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS[type];
    root.name = `Procedural${type}`;
    root.userData.proceduralEnemyFamily = true;
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

function createMoonfrostClips(type, baseY, {
    stride = 0.48,
    attackReach = 1,
    idleAccent = 0.2,
    deathDrop = 0.65
} = {}) {
    const body = `Rig_${type}Body`;
    const head = `Rig_${type}Head`;
    const leftLeg = `Rig_${type}LegLeft`;
    const rightLeg = `Rig_${type}LegRight`;
    const leftArm = `Rig_${type}ArmLeft`;
    const rightArm = `Rig_${type}ArmRight`;
    const weapon = `Rig_${type}Weapon`;
    const accent = `Rig_${type}Accent`;
    const idle = [0, 0.6, 1.2, 1.8, 2.4];
    const walk = [0, 0.34, 0.68, 1.02, 1.36];
    const run = [0, 0.21, 0.42, 0.63, 0.84];
    const attack = [0, 0.2, 0.44, 0.7, 1];
    const death = [0, 0.34, 0.72, 1.18, 1.65];
    return [
        new THREE.AnimationClip('Idle', 2.4, [
            track(body, 'position[y]', idle, [baseY, baseY + 0.05, baseY, baseY - 0.025, baseY]),
            track(body, 'rotation[y]', idle, [0, 0.025, 0, -0.025, 0]),
            track(head, 'rotation[y]', idle, [0, 0.08, 0, -0.08, 0]),
            track(head, 'rotation[z]', idle, [0, 0.025, 0, -0.025, 0]),
            track(leftArm, 'rotation[z]', idle, [-0.08, -0.08 - idleAccent, -0.08, -0.08 + idleAccent, -0.08]),
            track(rightArm, 'rotation[z]', idle, [0.08, 0.08 + idleAccent, 0.08, 0.08 - idleAccent, 0.08]),
            track(weapon, 'rotation[z]', idle, [-0.15, -0.1, -0.15, -0.21, -0.15]),
            track(accent, 'rotation[y]', idle, [0, 0.3, 0.6, 0.9, 1.2]),
            track(accent, 'position[y]', idle, [0, 0.06, 0, -0.04, 0])
        ]),
        new THREE.AnimationClip('Walk', 1.36, [
            track(body, 'position[y]', walk, [baseY, baseY + 0.08, baseY, baseY + 0.08, baseY]),
            track(body, 'rotation[z]', walk, [0, 0.035, 0, -0.035, 0]),
            track(leftLeg, 'rotation[x]', walk, [stride, 0, -stride, 0, stride]),
            track(rightLeg, 'rotation[x]', walk, [-stride, 0, stride, 0, -stride]),
            track(leftArm, 'rotation[x]', walk, [-stride * 0.72, 0, stride * 0.72, 0, -stride * 0.72]),
            track(rightArm, 'rotation[x]', walk, [stride * 0.72, 0, -stride * 0.72, 0, stride * 0.72]),
            track(head, 'rotation[y]', walk, [0, -0.04, 0, 0.04, 0]),
            track(weapon, 'rotation[z]', walk, [-0.15, -0.03, -0.15, -0.3, -0.15]),
            track(accent, 'rotation[z]', walk, [0, 0.18, 0, -0.18, 0])
        ]),
        new THREE.AnimationClip('Run', 0.84, [
            track(body, 'position[y]', run, [baseY, baseY + 0.14, baseY, baseY + 0.14, baseY]),
            track(body, 'rotation[x]', run, [0.14, 0.2, 0.14, 0.2, 0.14]),
            track(leftLeg, 'rotation[x]', run, [stride * 1.5, 0, -stride * 1.5, 0, stride * 1.5]),
            track(rightLeg, 'rotation[x]', run, [-stride * 1.5, 0, stride * 1.5, 0, -stride * 1.5]),
            track(leftArm, 'rotation[x]', run, [-stride, 0, stride, 0, -stride]),
            track(rightArm, 'rotation[x]', run, [stride, 0, -stride, 0, stride]),
            track(head, 'rotation[x]', run, [-0.04, 0.02, -0.04, 0.02, -0.04]),
            track(weapon, 'rotation[z]', run, [-0.15, 0.08, -0.15, -0.42, -0.15]),
            track(accent, 'rotation[z]', run, [0, 0.3, 0, -0.3, 0])
        ]),
        new THREE.AnimationClip('Attack', 1, [
            track(body, 'position[y]', attack, [baseY, baseY + 0.04, baseY + 0.12, baseY - 0.04, baseY]),
            track(body, 'rotation[y]', attack, [0, -0.22, -0.48, 0.34, 0]),
            track(head, 'rotation[y]', attack, [0, 0.12, 0.22, -0.13, 0]),
            track(leftLeg, 'rotation[x]', attack, [0, 0.12, 0.22, -0.1, 0]),
            track(rightLeg, 'rotation[x]', attack, [0, -0.16, -0.28, 0.12, 0]),
            track(leftArm, 'rotation[x]', attack, [0, -0.28, -0.48, 0.25, 0]),
            track(rightArm, 'rotation[x]', attack, [0, -0.65 * attackReach, -1.15 * attackReach, 0.92 * attackReach, 0]),
            track(weapon, 'rotation[z]', attack, [-0.15, -0.85 * attackReach, -1.42 * attackReach, 0.94 * attackReach, -0.15]),
            track(accent, 'rotation[y]', attack, [0, -0.3, -0.7, 0.8, 0])
        ]),
        new THREE.AnimationClip('Death', 1.65, [
            track(body, 'position[y]', death, [baseY, baseY + 0.04, baseY - 0.15, baseY - deathDrop * 0.7, baseY - deathDrop]),
            track(body, 'rotation[x]', death, [0, -0.12, 0.32, 0.92, 1.38]),
            track(body, 'rotation[z]', death, [0, 0.06, -0.2, -0.58, -0.82]),
            track(head, 'rotation[x]', death, [0, -0.14, 0.26, 0.62, 0.9]),
            track(leftLeg, 'rotation[x]', death, [0, 0.08, -0.22, -0.62, -0.9]),
            track(rightLeg, 'rotation[x]', death, [0, -0.1, 0.28, 0.72, 1]),
            track(leftArm, 'rotation[z]', death, [-0.08, -0.3, -0.65, -1, -1.18]),
            track(rightArm, 'rotation[z]', death, [0.08, 0.34, 0.7, 1.04, 1.22]),
            track(weapon, 'rotation[z]', death, [-0.15, 0.08, 0.52, 1.08, 1.42]),
            track(accent, 'rotation[z]', death, [0, -0.2, 0.45, 0.98, 1.3])
        ])
    ];
}

function addGroundSigil(root, prefix, radius, materials) {
    mesh(root, `${prefix}_MoonfrostSigil`, geometry('moonfrost-ground-ring', () => new THREE.RingGeometry(0.72, 0.79, 12)), materials.glow, {
        position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius], castShadow: false, receiveShadow: false
    });
    const shard = geometry('moonfrost-ground-shard', () => new THREE.BoxGeometry(0.055, 0.012, 0.4));
    for (let index = 0; index < 6; index += 1) {
        const angle = index * Math.PI / 3;
        mesh(root, `${prefix}_SigilShard${index + 1}`, shard, materials.glow, {
            position: [Math.sin(angle) * radius * 0.64, 0.014, Math.cos(angle) * radius * 0.64],
            rotation: [0, angle, 0], castShadow: false, receiveShadow: false
        });
    }
}

function addBipedLimb(body, type, side, materials, dimensions = {}) {
    const sign = side === 'Left' ? 1 : -1;
    const arm = dimensions.arm === true;
    const first = pivot(body, `Rig_${type}${arm ? 'Arm' : 'Leg'}${side}`,
        arm ? [sign * dimensions.shoulderX, dimensions.shoulderY, 0] : [sign * dimensions.hipX, dimensions.hipY, 0],
        [0, 0, arm ? sign * -0.08 : 0]);
    mesh(first, `${type}_${arm ? 'UpperArm' : 'Thigh'}${side}`,
        geometry(`${type}-${arm ? 'upper-arm' : 'thigh'}`, () => new THREE.CylinderGeometry(
            arm ? dimensions.armTop : dimensions.legTop,
            arm ? dimensions.armBottom : dimensions.legBottom,
            arm ? dimensions.armLength : dimensions.legLength,
            6
        )), arm ? materials.limb : materials.boot,
        { position: [0, -(arm ? dimensions.armLength : dimensions.legLength) / 2, 0] });
    const lower = pivot(first, `Rig_${type}${arm ? 'Elbow' : 'Knee'}${side}`,
        [0, -(arm ? dimensions.armLength : dimensions.legLength), 0]);
    mesh(lower, `${type}_${arm ? 'Elbow' : 'Knee'}${side}`,
        geometry(`${type}-${arm ? 'elbow' : 'knee'}`, () => new THREE.DodecahedronGeometry(arm ? dimensions.armBottom : dimensions.legBottom, 0)),
        materials.plate);
    mesh(lower, `${type}_${arm ? 'Forearm' : 'Shin'}${side}`,
        geometry(`${type}-${arm ? 'forearm' : 'shin'}`, () => new THREE.CylinderGeometry(
            arm ? dimensions.forearmTop : dimensions.shinTop,
            arm ? dimensions.forearmBottom : dimensions.shinBottom,
            arm ? dimensions.forearmLength : dimensions.shinLength,
            6
        )), arm ? materials.limb : materials.plate,
        { position: [0, -(arm ? dimensions.forearmLength : dimensions.shinLength) / 2, 0] });
    const end = pivot(lower, `Rig_${type}${arm ? 'Hand' : 'Foot'}${side}`,
        [0, -(arm ? dimensions.forearmLength : dimensions.shinLength), arm ? 0 : dimensions.footZ]);
    mesh(end, `${type}_${arm ? 'Hand' : 'Foot'}${side}`,
        geometry(`${type}-${arm ? 'hand' : 'foot'}`, () => new THREE.BoxGeometry(
            arm ? dimensions.handWidth : dimensions.footWidth,
            arm ? dimensions.handHeight : dimensions.footHeight,
            arm ? dimensions.handDepth : dimensions.footDepth
        )), arm ? materials.limb : materials.boot,
        { position: [0, arm ? -dimensions.handHeight * 0.25 : 0, arm ? 0 : dimensions.footDepth * 0.2] });
    return end;
}

export function createProceduralMountainTroll() {
    const type = 'MountainTroll';
    const p = PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS[type].palette;
    const materials = {
        limb: material('rimeback-hide', p.hide, { roughness: 0.95 }),
        boot: material('rimeback-fur', p.fur, { roughness: 1 }),
        plate: material('rimeback-iron', p.iron, { metalness: 0.56, roughness: 0.62 }),
        fur: material('rimeback-fur', p.fur, { roughness: 1 }),
        bone: material('rimeback-bone', p.bone, { roughness: 0.78 }),
        rime: material('rimeback-rime', p.rime, { roughness: 0.46, metalness: 0.08 }),
        glow: material('moonfrost-aurora', p.aurora, { emissive: p.aurora, emissiveIntensity: 1.35, roughness: 0.18 })
    };
    const root = new THREE.Group();
    addGroundSigil(root, 'MountainTroll', 1.08, materials);
    const body = pivot(root, 'Rig_MountainTrollBody', [0, 0.48, 0], [0.12, 0, 0]);
    const dims = {
        shoulderX: 0.98, shoulderY: 2.62, hipX: 0.42, hipY: 1.25,
        armTop: 0.3, armBottom: 0.36, armLength: 0.9, forearmTop: 0.24, forearmBottom: 0.31, forearmLength: 0.76,
        legTop: 0.29, legBottom: 0.37, legLength: 0.78, shinTop: 0.22, shinBottom: 0.28, shinLength: 0.62,
        handWidth: 0.48, handHeight: 0.46, handDepth: 0.4, footWidth: 0.55, footHeight: 0.25, footDepth: 0.74, footZ: 0.12
    };
    const leftHand = addBipedLimb(body, type, 'Left', materials, { ...dims, arm: true });
    const rightHand = addBipedLimb(body, type, 'Right', materials, { ...dims, arm: true });
    addBipedLimb(body, type, 'Left', materials, dims);
    addBipedLimb(body, type, 'Right', materials, dims);
    mesh(body, 'MountainTroll_HunchedTorso', geometry('rimeback-torso', () => new THREE.CylinderGeometry(0.9, 0.68, 1.65, 7)), materials.limb,
        { position: [0, 2.02, 0], rotation: [0.14, 0, 0], scale: [1.16, 1, 0.86] });
    mesh(body, 'MountainTroll_Rimeback', geometry('rimeback-shell', () => new THREE.DodecahedronGeometry(0.92, 0)), materials.rime,
        { position: [0, 2.45, -0.36], scale: [1.2, 0.9, 0.55] });
    const ridge = geometry('rimeback-ridge', () => new THREE.ConeGeometry(0.14, 0.62, 5));
    for (let index = 0; index < 7; index += 1) {
        mesh(body, `MountainTroll_BackRidge${index + 1}`, ridge, index % 2 ? materials.rime : materials.bone, {
            position: [0, 1.72 + index * 0.28, -0.72 + Math.abs(3 - index) * 0.04],
            rotation: [-Math.PI / 2, 0, (index - 3) * 0.04], scale: [1, 0.72 + index * 0.04, 1]
        });
    }
    for (const [side, x] of [['Left', 0.92], ['Right', -0.92]]) {
        mesh(body, `MountainTroll_FurMantle${side}`, geometry('rimeback-fur-mantle', () => new THREE.ConeGeometry(0.48, 0.9, 5)), materials.fur,
            { position: [x, 2.62, -0.08], rotation: [0, 0, side === 'Left' ? -1.3 : 1.3], scale: [1, 1, 0.78] });
        mesh(body, `MountainTroll_KneeIcicle${side}`, geometry('rimeback-icicle', () => new THREE.ConeGeometry(0.08, 0.42, 5)), materials.rime,
            { position: [x * 0.44, 0.37, 0.27], rotation: [Math.PI, 0, 0] });
    }
    const head = pivot(body, 'Rig_MountainTrollHead', [0, 3.22, 0.18], [-0.18, 0, 0]);
    mesh(head, 'MountainTroll_Head', geometry('rimeback-head', () => new THREE.DodecahedronGeometry(0.55, 0)), materials.limb,
        { scale: [1.08, 0.92, 0.9] });
    mesh(head, 'MountainTroll_Brow', geometry('rimeback-brow', () => new THREE.BoxGeometry(0.85, 0.16, 0.24)), materials.rime,
        { position: [0, 0.12, 0.43], rotation: [-0.08, 0, 0] });
    for (const [side, x] of [['Left', 0.2], ['Right', -0.2]]) {
        mesh(head, `MountainTroll_Eye${side}`, geometry('rimeback-eye', () => new THREE.OctahedronGeometry(0.07, 0)), materials.glow,
            { position: [x, 0.05, 0.52], scale: [1.15, 0.65, 0.5], castShadow: false });
        mesh(head, `MountainTroll_Tusk${side}`, geometry('rimeback-tusk', () => new THREE.ConeGeometry(0.075, 0.34, 5)), materials.bone,
            { position: [x * 1.45, -0.32, 0.38], rotation: [0.18, 0, side === 'Left' ? -0.12 : 0.12] });
    }
    const weapon = pivot(rightHand, 'Rig_MountainTrollWeapon', [0, -0.12, 0], [0.08, 0, -0.15]);
    mesh(weapon, 'MountainTroll_CairnClub', geometry('rimeback-club', () => new THREE.CylinderGeometry(0.17, 0.12, 2.2, 7)), materials.bone,
        { position: [0, 0.52, 0] });
    for (let index = 0; index < 4; index += 1) {
        mesh(weapon, `MountainTroll_ClubStone${index + 1}`, geometry('rimeback-club-stone', () => new THREE.DodecahedronGeometry(0.34, 0)), index % 2 ? materials.plate : materials.rime,
            { position: [(index - 1.5) * 0.16, 1.42 + (index % 2) * 0.2, 0], scale: [1, 1.25, 0.82] });
    }
    const accent = pivot(leftHand, 'Rig_MountainTrollAccent', [0, -0.18, 0]);
    mesh(accent, 'MountainTroll_AuroraCharm', geometry('moonfrost-charm', () => new THREE.OctahedronGeometry(0.16, 0)), materials.glow,
        { position: [0, -0.38, 0], castShadow: false });
    mesh(accent, 'MountainTroll_CharmLoop', geometry('moonfrost-charm-loop', () => new THREE.TorusGeometry(0.16, 0.025, 5, 8)), materials.plate,
        { position: [0, -0.12, 0], rotation: [Math.PI / 2, 0, 0] });
    return finalize(root, type, createMoonfrostClips(type, 0.48, { stride: 0.48, attackReach: 1.05, idleAccent: 0.05, deathDrop: 0.72 }));
}

export function createProceduralAquaGolem() {
    const type = 'AquaGolem';
    const p = PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS[type].palette;
    const materials = {
        limb: material('drowned-cairn-stone', p.stone, { roughness: 0.88 }),
        boot: material('drowned-cairn-deep-stone', p.deepStone, { roughness: 0.94 }),
        plate: material('drowned-cairn-iron', p.iron, { metalness: 0.38, roughness: 0.72 }),
        barnacle: material('drowned-cairn-barnacle', p.barnacle, { roughness: 1 }),
        water: material('drowned-cairn-water', p.water, { emissive: p.water, emissiveIntensity: 0.92, roughness: 0.2, transparent: true, opacity: 0.82 }),
        glow: material('drowned-cairn-soul', p.soul, { emissive: p.soul, emissiveIntensity: 1.45, roughness: 0.16 })
    };
    const root = new THREE.Group();
    addGroundSigil(root, 'AquaGolem', 1.02, materials);
    const body = pivot(root, 'Rig_AquaGolemBody', [0, 0.46, 0]);
    const dims = {
        shoulderX: 0.9, shoulderY: 2.38, hipX: 0.4, hipY: 1.17,
        armTop: 0.28, armBottom: 0.36, armLength: 0.8, forearmTop: 0.27, forearmBottom: 0.35, forearmLength: 0.68,
        legTop: 0.31, legBottom: 0.38, legLength: 0.72, shinTop: 0.25, shinBottom: 0.32, shinLength: 0.58,
        handWidth: 0.48, handHeight: 0.42, handDepth: 0.44, footWidth: 0.6, footHeight: 0.24, footDepth: 0.7, footZ: 0.1
    };
    const leftHand = addBipedLimb(body, type, 'Left', materials, { ...dims, arm: true });
    const rightHand = addBipedLimb(body, type, 'Right', materials, { ...dims, arm: true });
    addBipedLimb(body, type, 'Left', materials, dims);
    addBipedLimb(body, type, 'Right', materials, dims);
    mesh(body, 'AquaGolem_CairnTorso', geometry('aqua-cairn-torso', () => new THREE.DodecahedronGeometry(0.94, 0)), materials.limb,
        { position: [0, 1.92, 0], scale: [1.05, 1.1, 0.78] });
    mesh(body, 'AquaGolem_DeepCairn', geometry('aqua-deep-cairn', () => new THREE.DodecahedronGeometry(0.72, 0)), materials.boot,
        { position: [0, 1.65, -0.22], scale: [1.18, 1.12, 0.72] });
    mesh(body, 'AquaGolem_TideWindow', geometry('aqua-tide-window', () => new THREE.TorusGeometry(0.36, 0.085, 6, 10)), materials.plate,
        { position: [0, 1.98, 0.7], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 0.45] });
    const accent = pivot(body, 'Rig_AquaGolemAccent', [0, 1.98, 0.73]);
    mesh(accent, 'AquaGolem_TideSoul', geometry('aqua-tide-soul', () => new THREE.IcosahedronGeometry(0.24, 0)), materials.glow,
        { scale: [1, 1.25, 0.45], castShadow: false });
    const head = pivot(body, 'Rig_AquaGolemHead', [0, 2.92, 0.08]);
    mesh(head, 'AquaGolem_CairnHead', geometry('aqua-cairn-head', () => new THREE.DodecahedronGeometry(0.48, 0)), materials.limb,
        { scale: [1.15, 0.88, 0.9] });
    mesh(head, 'AquaGolem_CrownStone', geometry('aqua-crown-stone', () => new THREE.ConeGeometry(0.38, 0.65, 5)), materials.boot,
        { position: [0, 0.5, -0.03], rotation: [0, 0, 0.1] });
    for (const [side, x] of [['Left', 0.18], ['Right', -0.18]]) {
        mesh(head, `AquaGolem_Eye${side}`, geometry('aqua-eye', () => new THREE.OctahedronGeometry(0.065, 0)), materials.glow,
            { position: [x, 0.05, 0.45], scale: [1, 0.68, 0.45], castShadow: false });
        mesh(body, `AquaGolem_ShoulderCairn${side}`, geometry('aqua-shoulder-cairn', () => new THREE.DodecahedronGeometry(0.5, 0)), materials.boot,
            { position: [x * 5.1, 2.42, -0.05], scale: [1.12, 0.72, 0.9] });
    }
    const barnacle = geometry('aqua-barnacle', () => new THREE.ConeGeometry(0.09, 0.18, 6, 1, true));
    for (let index = 0; index < 10; index += 1) {
        const angle = index * 2.399;
        mesh(body, `AquaGolem_Barnacle${index + 1}`, barnacle, materials.barnacle, {
            position: [Math.sin(angle) * (0.55 + (index % 2) * 0.28), 1.35 + (index % 5) * 0.3, Math.cos(angle) * 0.55],
            rotation: [Math.PI / 2, angle, 0]
        });
    }
    const drip = geometry('aqua-drip', () => new THREE.ConeGeometry(0.07, 0.4, 5));
    for (const [index, hand] of [leftHand, rightHand].entries()) {
        mesh(hand, `AquaGolem_TideDrip${index + 1}`, drip, materials.water,
            { position: [0, -0.44, 0.1], rotation: [Math.PI, 0, 0], castShadow: false });
    }
    const weapon = pivot(rightHand, 'Rig_AquaGolemWeapon', [0, -0.04, 0], [0, 0, -0.15]);
    mesh(weapon, 'AquaGolem_AnchorShaft', geometry('aqua-anchor-shaft', () => new THREE.CylinderGeometry(0.07, 0.09, 1.8, 6)), materials.plate,
        { position: [0, 0.4, 0] });
    mesh(weapon, 'AquaGolem_AnchorCross', geometry('aqua-anchor-cross', () => new THREE.BoxGeometry(1, 0.15, 0.16)), materials.plate,
        { position: [0, 1.1, 0] });
    for (const [side, x] of [['Left', 0.47], ['Right', -0.47]]) {
        mesh(weapon, `AquaGolem_AnchorFluke${side}`, geometry('aqua-anchor-fluke', () => new THREE.ConeGeometry(0.18, 0.55, 4)), materials.limb,
            { position: [x, 0.88, 0], rotation: [0, 0, side === 'Left' ? -0.8 : 0.8] });
    }
    return finalize(root, type, createMoonfrostClips(type, 0.46, { stride: 0.39, attackReach: 0.95, idleAccent: 0.04, deathDrop: 0.58 }));
}

export function createProceduralSiren() {
    const type = 'Siren';
    const p = PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS[type].palette;
    const materials = {
        skin: material('choir-siren-skin', p.skin, { roughness: 0.72 }),
        shroud: material('choir-siren-shroud', p.shroud, { roughness: 0.94, side: THREE.DoubleSide }),
        fin: material('choir-siren-fin', p.fin, { roughness: 0.68, side: THREE.DoubleSide }),
        bone: material('choir-siren-bone', p.bone, { roughness: 0.8 }),
        silver: material('choir-siren-silver', p.silver, { metalness: 0.64, roughness: 0.43 }),
        glow: material('choir-siren-voice', p.voice, { emissive: p.voice, emissiveIntensity: 1.4, roughness: 0.16, transparent: true, opacity: 0.9 })
    };
    const root = new THREE.Group();
    addGroundSigil(root, 'Siren', 0.88, materials);
    const body = pivot(root, 'Rig_SirenBody', [0, 0.58, 0]);
    const leftLeg = pivot(body, 'Rig_SirenLegLeft', [0.2, 0.35, 0]);
    const rightLeg = pivot(body, 'Rig_SirenLegRight', [-0.2, 0.35, 0]);
    for (const [index, leg] of [leftLeg, rightLeg].entries()) {
        mesh(leg, `Siren_DrownedTatter${index + 1}`, geometry('siren-drowned-tatter', () => new THREE.ConeGeometry(0.34, 0.95, 5, 1, true)), materials.shroud,
            { position: [0, -0.25, 0], rotation: [Math.PI, 0, index ? -0.16 : 0.16], scale: [0.75, 1, 0.48] });
        mesh(leg, `Siren_TailFin${index + 1}`, geometry('siren-tail-fin', () => new THREE.ConeGeometry(0.32, 0.75, 3)), materials.fin,
            { position: [index ? -0.2 : 0.2, -0.58, 0], rotation: [0, 0, index ? -1.05 : 1.05], scale: [0.3, 1, 0.08] });
    }
    mesh(body, 'Siren_ChoirShroud', geometry('siren-shroud', () => new THREE.ConeGeometry(0.72, 1.85, 7, 1, true)), materials.shroud,
        { position: [0, 1.12, 0], scale: [1, 1, 0.72] });
    mesh(body, 'Siren_RibCage', geometry('siren-rib-cage', () => new THREE.CylinderGeometry(0.48, 0.38, 1.15, 7)), materials.skin,
        { position: [0, 1.65, 0] });
    const rib = geometry('siren-rib', () => new THREE.TorusGeometry(0.44, 0.035, 4, 9, Math.PI));
    for (let index = 0; index < 5; index += 1) {
        mesh(body, `Siren_Rib${index + 1}`, rib, materials.bone,
            { position: [0, 1.42 + index * 0.16, 0.22], rotation: [Math.PI / 2, 0, 0], scale: [1 - index * 0.05, 1, 0.75] });
    }
    for (let index = 0; index < 5; index += 1) {
        const angle = -0.8 + index * 0.4;
        mesh(body, `Siren_ChoirChime${index + 1}`, geometry('siren-choir-chime', () => new THREE.OctahedronGeometry(0.075, 0)), materials.glow, {
            position: [Math.sin(angle) * 0.62, 1.02 + Math.abs(index - 2) * 0.05, Math.cos(angle) * 0.46],
            scale: [0.65, 1.35, 0.65], castShadow: false
        });
    }
    const addArm = (side) => {
        const sign = side === 'Left' ? 1 : -1;
        const arm = pivot(body, `Rig_SirenArm${side}`, [sign * 0.56, 2.05, 0], [0, 0, sign * -0.08]);
        mesh(arm, `Siren_UpperArm${side}`, geometry('siren-upper-arm', () => new THREE.CylinderGeometry(0.1, 0.14, 0.62, 6)), materials.skin,
            { position: [0, -0.33, 0] });
        const elbow = pivot(arm, `Rig_SirenElbow${side}`, [0, -0.67, 0]);
        mesh(elbow, `Siren_Forearm${side}`, geometry('siren-forearm', () => new THREE.CylinderGeometry(0.075, 0.1, 0.58, 6)), materials.skin,
            { position: [0, -0.31, 0] });
        const hand = pivot(elbow, `Rig_SirenHand${side}`, [0, -0.63, 0]);
        mesh(hand, `Siren_Hand${side}`, geometry('siren-hand', () => new THREE.BoxGeometry(0.2, 0.28, 0.13)), materials.skin,
            { position: [0, -0.08, 0] });
        for (let index = 0; index < 3; index += 1) {
            mesh(hand, `Siren_Talon${side}${index + 1}`, geometry('siren-talon', () => new THREE.ConeGeometry(0.022, 0.18, 4)), materials.bone,
                { position: [(index - 1) * 0.06, -0.27, 0.03], rotation: [Math.PI, 0, 0] });
        }
        return hand;
    };
    const leftHand = addArm('Left');
    const rightHand = addArm('Right');
    const head = pivot(body, 'Rig_SirenHead', [0, 2.68, 0.02]);
    mesh(head, 'Siren_Head', geometry('siren-head', () => new THREE.DodecahedronGeometry(0.34, 0)), materials.skin,
        { scale: [0.88, 1.12, 0.86] });
    mesh(head, 'Siren_Veil', geometry('siren-veil', () => new THREE.ConeGeometry(0.5, 1.1, 6, 1, true)), materials.fin,
        { position: [0, 0.13, -0.17], scale: [1, 1, 0.62] });
    for (const [side, x] of [['Left', 0.12], ['Right', -0.12]]) {
        mesh(head, `Siren_Eye${side}`, geometry('siren-eye', () => new THREE.OctahedronGeometry(0.05, 0)), materials.glow,
            { position: [x, 0.05, 0.31], scale: [1, 0.55, 0.4], castShadow: false });
        mesh(head, `Siren_CrownSpine${side}`, geometry('siren-crown-spine', () => new THREE.ConeGeometry(0.065, 0.52, 5)), materials.bone,
            { position: [x * 2.1, 0.44, -0.04], rotation: [0, 0, side === 'Left' ? -0.45 : 0.45] });
    }
    mesh(head, 'Siren_Mouth', geometry('siren-mouth', () => new THREE.TorusGeometry(0.1, 0.025, 5, 9)), materials.glow,
        { position: [0, -0.14, 0.33], rotation: [Math.PI / 2, 0, 0], scale: [1, 1.4, 0.5], castShadow: false });
    const weapon = pivot(rightHand, 'Rig_SirenWeapon', [0, -0.08, 0], [0, 0, -0.15]);
    mesh(weapon, 'Siren_ChoirBlade', geometry('siren-choir-blade', () => new THREE.TorusGeometry(0.48, 0.07, 4, 11, Math.PI * 1.18)), materials.silver,
        { position: [0.22, -0.12, 0], rotation: [0, 0, -0.42] });
    const accent = pivot(leftHand, 'Rig_SirenAccent', [0, -0.2, 0]);
    const note = geometry('siren-voice-shard', () => new THREE.OctahedronGeometry(0.09, 0));
    for (let index = 0; index < 4; index += 1) {
        mesh(accent, `Siren_VoiceShard${index + 1}`, note, materials.glow, {
            position: [Math.sin(index * Math.PI / 2) * 0.26, -0.18 + index * 0.11, Math.cos(index * Math.PI / 2) * 0.18], castShadow: false
        });
    }
    return finalize(root, type, createMoonfrostClips(type, 0.58, { stride: 0.28, attackReach: 0.86, idleAccent: 0.22, deathDrop: 0.5 }));
}

export function createProceduralFrostGuardian() {
    const type = 'FrostGuardian';
    const p = PROCEDURAL_MOONFROST_ENEMY_DEFINITIONS[type].palette;
    const materials = {
        limb: material('glacial-guardian-ice', p.ice, { roughness: 0.38, metalness: 0.12 }),
        boot: material('glacial-guardian-cloth', p.cloth, { roughness: 0.96 }),
        plate: material('glacial-guardian-armor', p.armor, { roughness: 0.54, metalness: 0.64 }),
        silver: material('glacial-guardian-silver', p.silver, { roughness: 0.38, metalness: 0.75 }),
        deepIce: material('glacial-guardian-deep-ice', p.deepIce, { roughness: 0.44, metalness: 0.18 }),
        glow: material('glacial-guardian-aurora', p.aurora, { emissive: p.aurora, emissiveIntensity: 1.45, roughness: 0.15 })
    };
    const root = new THREE.Group();
    addGroundSigil(root, 'FrostGuardian', 1.05, materials);
    const body = pivot(root, 'Rig_FrostGuardianBody', [0, 0.48, 0]);
    const dims = {
        shoulderX: 0.82, shoulderY: 2.5, hipX: 0.36, hipY: 1.22,
        armTop: 0.22, armBottom: 0.27, armLength: 0.78, forearmTop: 0.18, forearmBottom: 0.24, forearmLength: 0.66,
        legTop: 0.25, legBottom: 0.3, legLength: 0.76, shinTop: 0.2, shinBottom: 0.25, shinLength: 0.6,
        handWidth: 0.34, handHeight: 0.36, handDepth: 0.3, footWidth: 0.48, footHeight: 0.25, footDepth: 0.68, footZ: 0.11
    };
    const leftHand = addBipedLimb(body, type, 'Left', materials, { ...dims, arm: true });
    const rightHand = addBipedLimb(body, type, 'Right', materials, { ...dims, arm: true });
    addBipedLimb(body, type, 'Left', materials, dims);
    addBipedLimb(body, type, 'Right', materials, dims);
    mesh(body, 'FrostGuardian_Cuirass', geometry('frost-guardian-cuirass', () => new THREE.CylinderGeometry(0.7, 0.55, 1.45, 7)), materials.plate,
        { position: [0, 1.94, 0], scale: [1.08, 1, 0.78] });
    mesh(body, 'FrostGuardian_IceHeart', geometry('frost-guardian-heart', () => new THREE.OctahedronGeometry(0.29, 0)), materials.glow,
        { position: [0, 2, 0.61], scale: [0.78, 1.2, 0.4], castShadow: false });
    mesh(body, 'FrostGuardian_WarSkirt', geometry('frost-guardian-skirt', () => new THREE.CylinderGeometry(0.54, 0.74, 0.92, 7, 1, true)), materials.boot,
        { position: [0, 1.06, 0] });
    for (let index = 0; index < 6; index += 1) {
        const angle = -1.05 + index * 0.42;
        mesh(body, `FrostGuardian_SkirtPlate${index + 1}`, geometry('frost-skirt-plate', () => new THREE.BoxGeometry(0.24, 0.76, 0.09)), index % 2 ? materials.silver : materials.deepIce,
            { position: [Math.sin(angle) * 0.58, 0.93, Math.cos(angle) * 0.32], rotation: [0, angle, Math.sin(angle) * 0.05] });
    }
    for (const [side, x] of [['Left', 0.82], ['Right', -0.82]]) {
        mesh(body, `FrostGuardian_Pauldron${side}`, geometry('frost-pauldron', () => new THREE.ConeGeometry(0.42, 0.72, 5)), materials.deepIce,
            { position: [x, 2.52, 0], rotation: [0, 0, side === 'Left' ? -1.32 : 1.32], scale: [1, 1, 0.85] });
        mesh(body, `FrostGuardian_PauldronSpire${side}`, geometry('frost-pauldron-spire', () => new THREE.ConeGeometry(0.11, 0.72, 5)), materials.limb,
            { position: [x * 1.22, 2.92, 0], rotation: [0, 0, side === 'Left' ? -0.4 : 0.4] });
    }
    const head = pivot(body, 'Rig_FrostGuardianHead', [0, 3, 0.02]);
    mesh(head, 'FrostGuardian_Helm', geometry('frost-guardian-helm', () => new THREE.DodecahedronGeometry(0.43, 0)), materials.plate,
        { scale: [0.95, 1.08, 0.9] });
    mesh(head, 'FrostGuardian_Visor', geometry('frost-guardian-visor', () => new THREE.BoxGeometry(0.65, 0.18, 0.18)), materials.deepIce,
        { position: [0, 0.04, 0.4], rotation: [-0.08, 0, 0] });
    for (const [side, x] of [['Left', 0.14], ['Right', -0.14]]) {
        mesh(head, `FrostGuardian_Eye${side}`, geometry('frost-guardian-eye', () => new THREE.OctahedronGeometry(0.055, 0)), materials.glow,
            { position: [x, 0.05, 0.5], scale: [1.2, 0.52, 0.42], castShadow: false });
        mesh(head, `FrostGuardian_HelmHorn${side}`, geometry('frost-guardian-horn', () => new THREE.ConeGeometry(0.1, 0.7, 5)), materials.limb,
            { position: [x * 2.5, 0.46, -0.04], rotation: [0, 0, side === 'Left' ? -0.52 : 0.52] });
    }
    const weapon = pivot(rightHand, 'Rig_FrostGuardianWeapon', [0, -0.04, 0], [0, 0, -0.15]);
    mesh(weapon, 'FrostGuardian_Polearm', geometry('frost-polearm', () => new THREE.CylinderGeometry(0.055, 0.07, 2.65, 6)), materials.silver,
        { position: [0, 0.58, 0] });
    mesh(weapon, 'FrostGuardian_PolearmBlade', geometry('frost-polearm-blade', () => new THREE.ConeGeometry(0.25, 0.95, 4)), materials.limb,
        { position: [0, 2.02, 0] });
    mesh(weapon, 'FrostGuardian_PolearmRune', geometry('frost-polearm-rune', () => new THREE.OctahedronGeometry(0.14, 0)), materials.glow,
        { position: [0, 1.48, 0], castShadow: false });
    const accent = pivot(leftHand, 'Rig_FrostGuardianAccent', [0, -0.15, 0]);
    mesh(accent, 'FrostGuardian_VigilBell', geometry('frost-vigil-bell', () => new THREE.CylinderGeometry(0.17, 0.3, 0.42, 7, 1, true)), materials.silver,
        { position: [0, -0.32, 0] });
    mesh(accent, 'FrostGuardian_BellVoice', geometry('frost-bell-voice', () => new THREE.OctahedronGeometry(0.085, 0)), materials.glow,
        { position: [0, -0.4, 0], castShadow: false });
    const halo = pivot(body, 'FrostGuardian_BackHalo', [0, 2.35, -0.52], [Math.PI / 2, 0, 0]);
    mesh(halo, 'FrostGuardian_BrokenHalo', geometry('frost-broken-halo', () => new THREE.TorusGeometry(0.82, 0.075, 5, 12, Math.PI * 1.55)), materials.silver,
        { rotation: [0, 0, -0.45] });
    for (let index = 0; index < 4; index += 1) {
        mesh(halo, `FrostGuardian_HaloShard${index + 1}`, geometry('frost-halo-shard', () => new THREE.ConeGeometry(0.08, 0.35, 4)), materials.limb,
            { position: [-0.57 + index * 0.38, Math.sin(index * 1.7) * 0.54, 0], rotation: [0, 0, (index - 1.5) * 0.45] });
    }
    return finalize(root, type, createMoonfrostClips(type, 0.48, { stride: 0.43, attackReach: 1.12, idleAccent: 0.06, deathDrop: 0.64 }));
}

export function createProceduralMoonfrostEnemy(type) {
    switch (type) {
        case 'MountainTroll': return createProceduralMountainTroll();
        case 'AquaGolem': return createProceduralAquaGolem();
        case 'Siren': return createProceduralSiren();
        case 'FrostGuardian': return createProceduralFrostGuardian();
        default: throw new Error(`Unknown procedural Moonfrost enemy: ${type}`);
    }
}

export function getProceduralMoonfrostEnemyCacheMetrics() {
    return { geometries: GEOMETRIES.size, materials: MATERIALS.size };
}
