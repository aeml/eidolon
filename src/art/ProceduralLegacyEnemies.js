import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_LEGACY_ENEMY_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const PROCEDURAL_LEGACY_ENEMY_DEFINITIONS = Object.freeze({
    Skeleton: Object.freeze({
        artStyle: 'Gloamwood ossuary pilgrim',
        region: 'Gloamwood',
        faction: 'gravebound',
        bounds: Object.freeze({ radius: 1.45, height: 3.5, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({
            bone: 0xc8b994,
            oldBone: 0x80755f,
            shroud: 0x252a25,
            moss: 0x586044,
            iron: 0x3d4140,
            brass: 0x856638,
            spirit: 0x9bf5c4
        })
    }),
    DemonOrc: Object.freeze({
        artStyle: 'Cinder Wastes kiln-warrior',
        region: 'Cinder Wastes',
        faction: 'ash legion',
        bounds: Object.freeze({ radius: 2.05, height: 4.6, origin: 'feet' }),
        combatRadius: 2,
        palette: Object.freeze({
            hide: 0x442c29,
            ash: 0x211d20,
            iron: 0x403c3c,
            brass: 0x8f6538,
            bone: 0xb49a70,
            ember: 0xff5a24,
            flame: 0xffb340
        })
    }),
    Imp: Object.freeze({
        artStyle: 'Cinder Wastes ember-scavenger',
        region: 'Cinder Wastes',
        faction: 'ash legion',
        bounds: Object.freeze({ radius: 1.5, height: 2.65, origin: 'feet' }),
        combatRadius: 1,
        palette: Object.freeze({
            hide: 0x6e2f2a,
            belly: 0xa84a31,
            wing: 0x2d2429,
            horn: 0xb59a73,
            iron: 0x454043,
            ember: 0xff652c,
            flame: 0xffc052
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
            roughness: options.roughness ?? 0.8,
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

function addPivot(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(...position);
    pivot.rotation.set(...rotation);
    parent.add(pivot);
    return pivot;
}

function addMesh(parent, name, geometryValue, materialValue, {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
    castShadow = true,
    receiveShadow = true
} = {}) {
    const mesh = new THREE.Mesh(geometryValue, materialValue);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    parent.add(mesh);
    return mesh;
}

function numberTrack(objectName, property, times, values) {
    return new THREE.NumberKeyframeTrack(`${objectName}.${property}`, times, values);
}

function installRestPoseReset(root) {
    const restPose = [];
    root.traverse((object) => {
        restPose.push({
            object,
            position: object.position.clone(),
            quaternion: object.quaternion.clone(),
            scale: object.scale.clone(),
            visible: object.visible
        });
    });
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

function finalizeEnemy(root, type, clips) {
    const definition = PROCEDURAL_LEGACY_ENEMY_DEFINITIONS[type];
    root.name = `Procedural${type}`;
    root.userData.proceduralEnemyFamily = true;
    root.userData.proceduralActorType = type;
    root.userData.artStyle = definition.artStyle;
    root.userData.region = definition.region;
    root.userData.faction = definition.faction;
    root.userData.combatRadius = definition.combatRadius;
    root.userData.sharedGeometry = true;
    root.userData.bounds = definition.bounds;
    root.userData.animations = clips;
    installRestPoseReset(root);
    return root;
}

function addSkeletonArm(body, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const shoulder = addPivot(body, `Rig_SkeletonShoulder${side}`, [sign * 0.48, 1.92, 0], [0, 0, sign * -0.12]);
    addMesh(shoulder, `Skeleton_ShoulderKnot${side}`,
        geometry('skeleton-joint-large', () => new THREE.DodecahedronGeometry(0.12, 0)), materials.oldBone);
    addMesh(shoulder, `Skeleton_Humerus${side}`,
        geometry('skeleton-upper-limb', () => new THREE.CylinderGeometry(0.055, 0.075, 0.55, 5)), materials.bone,
        { position: [0, -0.29, 0], rotation: [0, 0, sign * 0.08] });
    const elbow = addPivot(shoulder, `Rig_SkeletonElbow${side}`, [sign * 0.035, -0.58, 0]);
    addMesh(elbow, `Skeleton_Elbow${side}`,
        geometry('skeleton-joint-small', () => new THREE.DodecahedronGeometry(0.085, 0)), materials.oldBone);
    addMesh(elbow, `Skeleton_Forearm${side}`,
        geometry('skeleton-lower-limb', () => new THREE.CylinderGeometry(0.045, 0.06, 0.5, 5)), materials.bone,
        { position: [0, -0.27, 0], rotation: [0, 0, sign * -0.06] });
    const hand = addPivot(elbow, `Rig_SkeletonHand${side}`, [sign * -0.025, -0.54, 0]);
    addMesh(hand, `Skeleton_Hand${side}`,
        geometry('skeleton-hand', () => new THREE.BoxGeometry(0.16, 0.2, 0.11)), materials.oldBone,
        { rotation: [0, 0, sign * 0.08] });
    return hand;
}

function addSkeletonLeg(body, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const hip = addPivot(body, `Rig_SkeletonHip${side}`, [sign * 0.23, 1.03, 0], [0, 0, sign * 0.02]);
    addMesh(hip, `Skeleton_HipJoint${side}`,
        geometry('skeleton-joint-large', () => new THREE.DodecahedronGeometry(0.12, 0)), materials.oldBone);
    addMesh(hip, `Skeleton_Femur${side}`,
        geometry('skeleton-thigh', () => new THREE.CylinderGeometry(0.065, 0.085, 0.58, 5)), materials.bone,
        { position: [0, -0.31, 0] });
    const knee = addPivot(hip, `Rig_SkeletonKnee${side}`, [0, -0.62, 0]);
    addMesh(knee, `Skeleton_Knee${side}`,
        geometry('skeleton-joint-small', () => new THREE.DodecahedronGeometry(0.085, 0)), materials.oldBone);
    addMesh(knee, `Skeleton_Shin${side}`,
        geometry('skeleton-shin', () => new THREE.CylinderGeometry(0.045, 0.065, 0.52, 5)), materials.bone,
        { position: [0, -0.28, 0] });
    addMesh(knee, `Skeleton_Foot${side}`,
        geometry('skeleton-foot', () => new THREE.BoxGeometry(0.19, 0.11, 0.36)), materials.oldBone,
        { position: [0, -0.58, 0.1], rotation: [0.08, 0, 0] });
}

function createSkeletonClips() {
    const idleTimes = [0, 0.6, 1.2, 1.8, 2.4];
    const walkTimes = [0, 0.32, 0.64, 0.96, 1.28];
    const runTimes = [0, 0.2, 0.4, 0.6, 0.8];
    const attackTimes = [0, 0.2, 0.42, 0.66, 0.92];
    const deathTimes = [0, 0.3, 0.65, 1.05, 1.45];
    return [
        new THREE.AnimationClip('Idle', 2.4, [
            numberTrack('Rig_SkeletonBody', 'position[y]', idleTimes, [0.34, 0.375, 0.34, 0.315, 0.34]),
            numberTrack('Rig_SkeletonBody', 'rotation[y]', idleTimes, [0, 0.025, 0, -0.025, 0]),
            numberTrack('Rig_SkeletonHead', 'rotation[z]', idleTimes, [-0.05, 0.03, -0.05, -0.11, -0.05]),
            numberTrack('Rig_SkeletonJaw', 'rotation[x]', idleTimes, [0.08, 0.16, 0.08, 0.03, 0.08]),
            numberTrack('Rig_SkeletonShoulderLeft', 'rotation[z]', idleTimes, [-0.12, -0.08, -0.12, -0.17, -0.12]),
            numberTrack('Rig_SkeletonShoulderRight', 'rotation[z]', idleTimes, [0.12, 0.08, 0.12, 0.17, 0.12]),
            numberTrack('Rig_SkeletonLantern', 'rotation[z]', idleTimes, [0, -0.12, 0, 0.12, 0]),
            numberTrack('Rig_SkeletonWeapon', 'rotation[z]', idleTimes, [-0.18, -0.13, -0.18, -0.23, -0.18])
        ]),
        new THREE.AnimationClip('Walk', 1.28, [
            numberTrack('Rig_SkeletonBody', 'position[y]', walkTimes, [0.34, 0.395, 0.34, 0.395, 0.34]),
            numberTrack('Rig_SkeletonBody', 'rotation[z]', walkTimes, [0, 0.035, 0, -0.035, 0]),
            numberTrack('Rig_SkeletonHipLeft', 'rotation[x]', walkTimes, [0.46, 0, -0.46, 0, 0.46]),
            numberTrack('Rig_SkeletonHipRight', 'rotation[x]', walkTimes, [-0.46, 0, 0.46, 0, -0.46]),
            numberTrack('Rig_SkeletonKneeLeft', 'rotation[x]', walkTimes, [0.05, 0.55, 0.08, 0.16, 0.05]),
            numberTrack('Rig_SkeletonKneeRight', 'rotation[x]', walkTimes, [0.08, 0.16, 0.05, 0.55, 0.08]),
            numberTrack('Rig_SkeletonShoulderLeft', 'rotation[x]', walkTimes, [-0.32, 0, 0.32, 0, -0.32]),
            numberTrack('Rig_SkeletonShoulderRight', 'rotation[x]', walkTimes, [0.32, 0, -0.32, 0, 0.32]),
            numberTrack('Rig_SkeletonLantern', 'rotation[z]', walkTimes, [0, 0.24, 0, -0.24, 0])
        ]),
        new THREE.AnimationClip('Run', 0.8, [
            numberTrack('Rig_SkeletonBody', 'position[y]', runTimes, [0.34, 0.43, 0.34, 0.43, 0.34]),
            numberTrack('Rig_SkeletonBody', 'rotation[x]', runTimes, [0.16, 0.21, 0.16, 0.21, 0.16]),
            numberTrack('Rig_SkeletonHipLeft', 'rotation[x]', runTimes, [0.72, 0, -0.72, 0, 0.72]),
            numberTrack('Rig_SkeletonHipRight', 'rotation[x]', runTimes, [-0.72, 0, 0.72, 0, -0.72]),
            numberTrack('Rig_SkeletonKneeLeft', 'rotation[x]', runTimes, [0.08, 0.78, 0.12, 0.2, 0.08]),
            numberTrack('Rig_SkeletonKneeRight', 'rotation[x]', runTimes, [0.12, 0.2, 0.08, 0.78, 0.12]),
            numberTrack('Rig_SkeletonShoulderLeft', 'rotation[x]', runTimes, [-0.58, 0, 0.58, 0, -0.58]),
            numberTrack('Rig_SkeletonShoulderRight', 'rotation[x]', runTimes, [0.58, 0, -0.58, 0, 0.58]),
            numberTrack('Rig_SkeletonLantern', 'rotation[z]', runTimes, [0, 0.42, 0, -0.42, 0])
        ]),
        new THREE.AnimationClip('Attack', 0.92, [
            numberTrack('Rig_SkeletonBody', 'position[y]', attackTimes, [0.34, 0.37, 0.44, 0.31, 0.34]),
            numberTrack('Rig_SkeletonBody', 'rotation[y]', attackTimes, [0, -0.22, -0.42, 0.32, 0]),
            numberTrack('Rig_SkeletonShoulderRight', 'rotation[x]', attackTimes, [0, -0.72, -1.12, 0.88, 0]),
            numberTrack('Rig_SkeletonShoulderRight', 'rotation[z]', attackTimes, [0.12, 0.48, 0.68, -0.36, 0.12]),
            numberTrack('Rig_SkeletonElbowRight', 'rotation[x]', attackTimes, [0, -0.35, -0.58, 0.34, 0]),
            numberTrack('Rig_SkeletonWeapon', 'rotation[z]', attackTimes, [-0.18, -1, -1.36, 0.74, -0.18]),
            numberTrack('Rig_SkeletonHead', 'rotation[y]', attackTimes, [0, 0.15, 0.22, -0.12, 0]),
            numberTrack('Rig_SkeletonLantern', 'rotation[z]', attackTimes, [0, -0.18, -0.36, 0.38, 0])
        ]),
        new THREE.AnimationClip('Death', 1.45, [
            numberTrack('Rig_SkeletonBody', 'position[y]', deathTimes, [0.34, 0.36, 0.14, -0.32, -0.56]),
            numberTrack('Rig_SkeletonBody', 'rotation[x]', deathTimes, [0, -0.1, 0.38, 0.94, 1.38]),
            numberTrack('Rig_SkeletonBody', 'rotation[z]', deathTimes, [0, 0.08, -0.2, -0.62, -0.86]),
            numberTrack('Rig_SkeletonHead', 'rotation[x]', deathTimes, [0, -0.12, 0.28, 0.65, 0.9]),
            numberTrack('Rig_SkeletonHead', 'rotation[z]', deathTimes, [-0.05, 0.08, 0.34, 0.7, 1.02]),
            numberTrack('Rig_SkeletonShoulderLeft', 'rotation[z]', deathTimes, [-0.12, -0.35, -0.72, -1.05, -1.2]),
            numberTrack('Rig_SkeletonShoulderRight', 'rotation[z]', deathTimes, [0.12, 0.42, 0.78, 1.08, 1.24]),
            numberTrack('Rig_SkeletonHipLeft', 'rotation[x]', deathTimes, [0, -0.12, 0.32, 0.8, 1.12]),
            numberTrack('Rig_SkeletonHipRight', 'rotation[x]', deathTimes, [0, 0.15, -0.22, -0.62, -0.9]),
            numberTrack('Rig_SkeletonWeapon', 'rotation[z]', deathTimes, [-0.18, 0.08, 0.62, 1.18, 1.42]),
            numberTrack('Rig_SkeletonLantern', 'rotation[z]', deathTimes, [0, -0.22, 0.52, 1.1, 1.48])
        ])
    ];
}

export function createProceduralSkeleton() {
    const definition = PROCEDURAL_LEGACY_ENEMY_DEFINITIONS.Skeleton;
    const p = definition.palette;
    const materials = {
        bone: material('gravebound-bone', p.bone, { roughness: 0.76 }),
        oldBone: material('gravebound-old-bone', p.oldBone, { roughness: 0.88 }),
        shroud: material('gravebound-shroud', p.shroud, { roughness: 0.96, side: THREE.DoubleSide }),
        moss: material('gravebound-moss', p.moss, { roughness: 1 }),
        iron: material('gravebound-iron', p.iron, { metalness: 0.58, roughness: 0.55 }),
        brass: material('gravebound-brass', p.brass, { metalness: 0.66, roughness: 0.42 }),
        spirit: material('gravebound-spirit', p.spirit, { emissive: p.spirit, emissiveIntensity: 1.35, roughness: 0.22 })
    };
    const root = new THREE.Group();
    addMesh(root, 'Skeleton_GraveSeal', geometry('gravebound-seal', () => new THREE.RingGeometry(0.55, 0.62, 12)), materials.moss,
        { position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], castShadow: false, receiveShadow: false });
    const body = addPivot(root, 'Rig_SkeletonBody', [0, 0.34, 0]);

    addMesh(body, 'Skeleton_Pelvis', geometry('skeleton-pelvis', () => new THREE.BoxGeometry(0.56, 0.27, 0.3)), materials.oldBone,
        { position: [0, 1.04, 0], rotation: [0.08, 0, 0] });
    addMesh(body, 'Skeleton_Spine', geometry('skeleton-spine', () => new THREE.CylinderGeometry(0.065, 0.09, 0.86, 5)), materials.bone,
        { position: [0, 1.48, 0] });
    addMesh(body, 'Skeleton_Sternum', geometry('skeleton-sternum', () => new THREE.BoxGeometry(0.09, 0.74, 0.1)), materials.oldBone,
        { position: [0, 1.63, 0.17] });
    const ribGeometry = geometry('skeleton-rib', () => new THREE.TorusGeometry(0.32, 0.035, 4, 10, Math.PI));
    for (let index = 0; index < 5; index += 1) {
        addMesh(body, `Skeleton_Rib${index + 1}`, ribGeometry, index % 2 ? materials.oldBone : materials.bone, {
            position: [0, 1.42 + index * 0.13, 0.02],
            rotation: [Math.PI / 2, 0, 0],
            scale: [1 - index * 0.04, 1, 1]
        });
    }
    addMesh(body, 'Skeleton_ShroudBack', geometry('skeleton-shroud', () => new THREE.ConeGeometry(0.55, 1.25, 5, 1, true)), materials.shroud,
        { position: [0, 1.2, -0.14], rotation: [0.08, 0, 0], scale: [1, 1, 0.62] });
    for (let index = 0; index < 4; index += 1) {
        addMesh(body, `Skeleton_ShroudTatter${index + 1}`, geometry('skeleton-tatter', () => new THREE.ConeGeometry(0.11, 0.65, 4)),
            index % 2 ? materials.moss : materials.shroud, {
                position: [-0.37 + index * 0.24, 0.61 - Math.abs(1.5 - index) * 0.04, -0.08],
                rotation: [0, 0, (index - 1.5) * 0.08]
            });
    }

    const head = addPivot(body, 'Rig_SkeletonHead', [0, 2.28, 0], [0, 0, -0.05]);
    addMesh(head, 'Skeleton_Skull', geometry('skeleton-skull', () => new THREE.DodecahedronGeometry(0.32, 0)), materials.bone,
        { scale: [0.9, 1.08, 0.85] });
    addMesh(head, 'Skeleton_Brow', geometry('skeleton-brow', () => new THREE.BoxGeometry(0.48, 0.1, 0.15)), materials.oldBone,
        { position: [0, 0.08, 0.25], rotation: [-0.1, 0, 0] });
    const eyeGeometry = geometry('skeleton-eye', () => new THREE.OctahedronGeometry(0.055, 0));
    for (const [side, x] of [['Left', 0.105], ['Right', -0.105]]) {
        addMesh(head, `Skeleton_Eye${side}`, eyeGeometry, materials.spirit,
            { position: [x, 0.04, 0.29], scale: [1.1, 0.68, 0.5], castShadow: false });
    }
    const jaw = addPivot(head, 'Rig_SkeletonJaw', [0, -0.23, 0.04], [0.08, 0, 0]);
    addMesh(jaw, 'Skeleton_Jaw', geometry('skeleton-jaw', () => new THREE.BoxGeometry(0.34, 0.13, 0.25)), materials.oldBone,
        { position: [0, 0, 0.1] });
    for (let index = 0; index < 4; index += 1) {
        addMesh(jaw, `Skeleton_Tooth${index + 1}`, geometry('skeleton-tooth', () => new THREE.ConeGeometry(0.022, 0.09, 4)), materials.bone,
            { position: [-0.105 + index * 0.07, 0.075, 0.22], rotation: [Math.PI, 0, 0] });
    }
    addMesh(head, 'Skeleton_GraveCandle', geometry('skeleton-candle', () => new THREE.CylinderGeometry(0.07, 0.085, 0.35, 6)), materials.bone,
        { position: [0.08, 0.47, 0] });
    addMesh(head, 'Skeleton_GraveFlame', geometry('skeleton-flame', () => new THREE.ConeGeometry(0.065, 0.22, 5)), materials.spirit,
        { position: [0.08, 0.75, 0], castShadow: false });

    const leftHand = addSkeletonArm(body, 'Left', materials);
    const rightHand = addSkeletonArm(body, 'Right', materials);
    addSkeletonLeg(body, 'Left', materials);
    addSkeletonLeg(body, 'Right', materials);

    const lantern = addPivot(leftHand, 'Rig_SkeletonLantern', [0, -0.18, 0]);
    addMesh(lantern, 'Skeleton_LanternFrame', geometry('skeleton-lantern', () => new THREE.BoxGeometry(0.32, 0.42, 0.28)), materials.iron,
        { position: [0, -0.24, 0] });
    addMesh(lantern, 'Skeleton_LanternSoul', geometry('skeleton-lantern-soul', () => new THREE.OctahedronGeometry(0.13, 0)), materials.spirit,
        { position: [0, -0.24, 0.15], castShadow: false });
    addMesh(lantern, 'Skeleton_LanternCap', geometry('skeleton-lantern-cap', () => new THREE.ConeGeometry(0.22, 0.18, 4)), materials.brass,
        { position: [0, 0.03, 0] });
    const weapon = addPivot(rightHand, 'Rig_SkeletonWeapon', [0, -0.02, 0], [0.05, 0, -0.18]);
    addMesh(weapon, 'Skeleton_GravesickleShaft', geometry('skeleton-sickle-shaft', () => new THREE.CylinderGeometry(0.035, 0.045, 1.65, 6)), materials.iron,
        { position: [0, -0.3, 0] });
    addMesh(weapon, 'Skeleton_GravesickleBlade', geometry('skeleton-sickle-blade', () => new THREE.TorusGeometry(0.34, 0.065, 4, 9, Math.PI * 0.72)), materials.brass,
        { position: [0.19, 0.51, 0], rotation: [0, 0, 0.35] });
    addMesh(weapon, 'Skeleton_GravesickleRune', geometry('skeleton-sickle-rune', () => new THREE.OctahedronGeometry(0.08, 0)), materials.spirit,
        { position: [0, 0.47, 0], castShadow: false });

    return finalizeEnemy(root, 'Skeleton', createSkeletonClips());
}

function addOrcLimb(body, side, materials, isArm) {
    const sign = side === 'Left' ? 1 : -1;
    const upperName = isArm ? 'Shoulder' : 'Hip';
    const lowerName = isArm ? 'Elbow' : 'Knee';
    const upper = addPivot(body, `Rig_DemonOrc${upperName}${side}`,
        isArm ? [sign * 0.84, 2.62, 0] : [sign * 0.38, 1.22, 0],
        [0, 0, isArm ? sign * -0.13 : 0]);
    addMesh(upper, `DemonOrc_${upperName}Plate${side}`,
        geometry(isArm ? 'orc-pauldron' : 'orc-hip', () => isArm
            ? new THREE.ConeGeometry(0.46, 0.72, 5)
            : new THREE.DodecahedronGeometry(0.28, 0)),
        isArm ? materials.iron : materials.hide,
        isArm ? { position: [sign * 0.12, 0.05, 0], rotation: [0, 0, sign * Math.PI / 2], scale: [1, 1, 0.85] } : {});
    addMesh(upper, `DemonOrc_Upper${isArm ? 'Arm' : 'Leg'}${side}`,
        geometry(isArm ? 'orc-upper-arm' : 'orc-thigh', () => new THREE.CylinderGeometry(isArm ? 0.23 : 0.25, isArm ? 0.3 : 0.32, isArm ? 0.75 : 0.88, 6)),
        materials.hide, { position: [0, isArm ? -0.42 : -0.5, 0] });
    const lower = addPivot(upper, `Rig_DemonOrc${lowerName}${side}`, [0, isArm ? -0.82 : -0.96, 0]);
    addMesh(lower, `DemonOrc_${lowerName}Guard${side}`,
        geometry(isArm ? 'orc-elbow' : 'orc-knee', () => new THREE.DodecahedronGeometry(isArm ? 0.25 : 0.27, 0)), materials.brass);
    addMesh(lower, `DemonOrc_Lower${isArm ? 'Arm' : 'Leg'}${side}`,
        geometry(isArm ? 'orc-forearm' : 'orc-shin', () => new THREE.CylinderGeometry(isArm ? 0.18 : 0.2, isArm ? 0.24 : 0.27, isArm ? 0.66 : 0.75, 6)),
        isArm ? materials.hide : materials.iron, { position: [0, isArm ? -0.37 : -0.43, 0] });
    const end = addPivot(lower, `Rig_DemonOrc${isArm ? 'Hand' : 'Foot'}${side}`, [0, isArm ? -0.73 : -0.84, isArm ? 0 : 0.12]);
    addMesh(end, `DemonOrc_${isArm ? 'Fist' : 'Boot'}${side}`,
        geometry(isArm ? 'orc-fist' : 'orc-boot', () => new THREE.BoxGeometry(isArm ? 0.38 : 0.48, isArm ? 0.4 : 0.28, isArm ? 0.32 : 0.7)),
        isArm ? materials.hide : materials.iron, { position: [0, isArm ? -0.05 : 0, isArm ? 0.04 : 0.16] });
    return end;
}

function createDemonOrcClips() {
    const idleTimes = [0, 0.55, 1.1, 1.65, 2.2];
    const walkTimes = [0, 0.36, 0.72, 1.08, 1.44];
    const runTimes = [0, 0.22, 0.44, 0.66, 0.88];
    const attackTimes = [0, 0.24, 0.48, 0.72, 1];
    const deathTimes = [0, 0.4, 0.82, 1.3, 1.8];
    return [
        new THREE.AnimationClip('Idle', 2.2, [
            numberTrack('Rig_DemonOrcBody', 'position[y]', idleTimes, [0.72, 0.76, 0.72, 0.695, 0.72]),
            numberTrack('Rig_DemonOrcChest', 'rotation[x]', idleTimes, [-0.05, -0.01, -0.05, -0.09, -0.05]),
            numberTrack('Rig_DemonOrcHead', 'rotation[y]', idleTimes, [0, 0.06, 0, -0.06, 0]),
            numberTrack('Rig_DemonOrcJaw', 'rotation[x]', idleTimes, [0.04, 0.12, 0.04, 0.09, 0.04]),
            numberTrack('Rig_DemonOrcShoulderLeft', 'rotation[z]', idleTimes, [-0.13, -0.09, -0.13, -0.18, -0.13]),
            numberTrack('Rig_DemonOrcShoulderRight', 'rotation[z]', idleTimes, [0.13, 0.09, 0.13, 0.18, 0.13]),
            numberTrack('Rig_DemonOrcWeapon', 'rotation[z]', idleTimes, [-0.24, -0.2, -0.24, -0.29, -0.24]),
            numberTrack('Rig_DemonOrcChain', 'rotation[z]', idleTimes, [0.16, -0.06, 0.16, 0.35, 0.16])
        ]),
        new THREE.AnimationClip('Walk', 1.44, [
            numberTrack('Rig_DemonOrcBody', 'position[y]', walkTimes, [0.72, 0.8, 0.72, 0.8, 0.72]),
            numberTrack('Rig_DemonOrcBody', 'rotation[z]', walkTimes, [0, 0.035, 0, -0.035, 0]),
            numberTrack('Rig_DemonOrcHipLeft', 'rotation[x]', walkTimes, [0.42, 0, -0.42, 0, 0.42]),
            numberTrack('Rig_DemonOrcHipRight', 'rotation[x]', walkTimes, [-0.42, 0, 0.42, 0, -0.42]),
            numberTrack('Rig_DemonOrcKneeLeft', 'rotation[x]', walkTimes, [0.08, 0.45, 0.1, 0.2, 0.08]),
            numberTrack('Rig_DemonOrcKneeRight', 'rotation[x]', walkTimes, [0.1, 0.2, 0.08, 0.45, 0.1]),
            numberTrack('Rig_DemonOrcShoulderLeft', 'rotation[x]', walkTimes, [-0.28, 0, 0.28, 0, -0.28]),
            numberTrack('Rig_DemonOrcShoulderRight', 'rotation[x]', walkTimes, [0.28, 0, -0.28, 0, 0.28]),
            numberTrack('Rig_DemonOrcChain', 'rotation[z]', walkTimes, [0.16, 0.42, 0.16, -0.18, 0.16])
        ]),
        new THREE.AnimationClip('Run', 0.88, [
            numberTrack('Rig_DemonOrcBody', 'position[y]', runTimes, [0.72, 0.85, 0.72, 0.85, 0.72]),
            numberTrack('Rig_DemonOrcChest', 'rotation[x]', runTimes, [0.16, 0.23, 0.16, 0.23, 0.16]),
            numberTrack('Rig_DemonOrcHipLeft', 'rotation[x]', runTimes, [0.68, 0, -0.68, 0, 0.68]),
            numberTrack('Rig_DemonOrcHipRight', 'rotation[x]', runTimes, [-0.68, 0, 0.68, 0, -0.68]),
            numberTrack('Rig_DemonOrcKneeLeft', 'rotation[x]', runTimes, [0.1, 0.68, 0.12, 0.22, 0.1]),
            numberTrack('Rig_DemonOrcKneeRight', 'rotation[x]', runTimes, [0.12, 0.22, 0.1, 0.68, 0.12]),
            numberTrack('Rig_DemonOrcShoulderLeft', 'rotation[x]', runTimes, [-0.48, 0, 0.48, 0, -0.48]),
            numberTrack('Rig_DemonOrcShoulderRight', 'rotation[x]', runTimes, [0.48, 0, -0.48, 0, 0.48]),
            numberTrack('Rig_DemonOrcChain', 'rotation[z]', runTimes, [0.16, 0.62, 0.16, -0.38, 0.16])
        ]),
        new THREE.AnimationClip('Attack', 1, [
            numberTrack('Rig_DemonOrcBody', 'position[y]', attackTimes, [0.72, 0.76, 0.86, 0.68, 0.72]),
            numberTrack('Rig_DemonOrcChest', 'rotation[y]', attackTimes, [0, -0.3, -0.55, 0.42, 0]),
            numberTrack('Rig_DemonOrcShoulderRight', 'rotation[x]', attackTimes, [0, -0.85, -1.22, 0.92, 0]),
            numberTrack('Rig_DemonOrcShoulderRight', 'rotation[z]', attackTimes, [0.13, 0.58, 0.82, -0.48, 0.13]),
            numberTrack('Rig_DemonOrcElbowRight', 'rotation[x]', attackTimes, [0, -0.32, -0.66, 0.52, 0]),
            numberTrack('Rig_DemonOrcWeapon', 'rotation[z]', attackTimes, [-0.24, -1.02, -1.48, 0.88, -0.24]),
            numberTrack('Rig_DemonOrcHead', 'rotation[y]', attackTimes, [0, 0.18, 0.3, -0.16, 0]),
            numberTrack('Rig_DemonOrcChain', 'rotation[z]', attackTimes, [0.16, -0.28, -0.55, 0.6, 0.16])
        ]),
        new THREE.AnimationClip('Death', 1.8, [
            numberTrack('Rig_DemonOrcBody', 'position[y]', deathTimes, [0.72, 0.78, 0.57, -0.06, -0.36]),
            numberTrack('Rig_DemonOrcBody', 'rotation[x]', deathTimes, [0, -0.18, 0.28, 0.9, 1.34]),
            numberTrack('Rig_DemonOrcBody', 'rotation[z]', deathTimes, [0, -0.05, 0.18, 0.54, 0.78]),
            numberTrack('Rig_DemonOrcChest', 'rotation[x]', deathTimes, [-0.05, -0.16, 0.18, 0.5, 0.72]),
            numberTrack('Rig_DemonOrcHead', 'rotation[x]', deathTimes, [0, -0.1, 0.24, 0.58, 0.86]),
            numberTrack('Rig_DemonOrcShoulderLeft', 'rotation[z]', deathTimes, [-0.13, -0.42, -0.78, -1.08, -1.2]),
            numberTrack('Rig_DemonOrcShoulderRight', 'rotation[z]', deathTimes, [0.13, 0.46, 0.82, 1.12, 1.26]),
            numberTrack('Rig_DemonOrcHipLeft', 'rotation[x]', deathTimes, [0, 0.1, -0.22, -0.62, -0.9]),
            numberTrack('Rig_DemonOrcHipRight', 'rotation[x]', deathTimes, [0, -0.1, 0.28, 0.72, 1.02]),
            numberTrack('Rig_DemonOrcWeapon', 'rotation[z]', deathTimes, [-0.24, 0.08, 0.58, 1.16, 1.44]),
            numberTrack('Rig_DemonOrcChain', 'rotation[z]', deathTimes, [0.16, -0.32, 0.45, 1.05, 1.38])
        ])
    ];
}

export function createProceduralDemonOrc() {
    const definition = PROCEDURAL_LEGACY_ENEMY_DEFINITIONS.DemonOrc;
    const p = definition.palette;
    const materials = {
        hide: material('kiln-orc-hide', p.hide, { roughness: 0.92 }),
        ash: material('kiln-orc-ash', p.ash, { roughness: 0.98 }),
        iron: material('kiln-orc-iron', p.iron, { metalness: 0.68, roughness: 0.5 }),
        brass: material('kiln-orc-brass', p.brass, { metalness: 0.72, roughness: 0.38 }),
        bone: material('kiln-orc-bone', p.bone, { roughness: 0.76 }),
        ember: material('kiln-orc-ember', p.ember, { emissive: p.ember, emissiveIntensity: 1.35, roughness: 0.24 }),
        flame: material('kiln-orc-flame', p.flame, { emissive: p.flame, emissiveIntensity: 1.7, roughness: 0.18 })
    };
    const root = new THREE.Group();
    addMesh(root, 'DemonOrc_AshBrand', geometry('orc-ground-brand', () => new THREE.RingGeometry(0.82, 0.9, 10)), materials.ember,
        { position: [0, 0.015, 0], rotation: [-Math.PI / 2, 0, 0], castShadow: false, receiveShadow: false });
    const body = addPivot(root, 'Rig_DemonOrcBody', [0, 0.72, 0]);
    addMesh(body, 'DemonOrc_Waist', geometry('orc-waist', () => new THREE.CylinderGeometry(0.56, 0.68, 0.62, 7)), materials.hide,
        { position: [0, 1.45, 0] });
    addMesh(body, 'DemonOrc_WarSkirt', geometry('orc-war-skirt', () => new THREE.CylinderGeometry(0.58, 0.82, 0.8, 7, 1, true)), materials.ash,
        { position: [0, 1.02, 0] });
    for (let index = 0; index < 5; index += 1) {
        const angle = -0.9 + index * 0.45;
        addMesh(body, `DemonOrc_SkirtPlate${index + 1}`, geometry('orc-skirt-plate', () => new THREE.BoxGeometry(0.26, 0.74, 0.09)),
            index % 2 ? materials.brass : materials.iron,
            { position: [Math.sin(angle) * 0.61, 0.91, Math.cos(angle) * 0.35], rotation: [0, angle, Math.sin(angle) * 0.06] });
    }
    const chest = addPivot(body, 'Rig_DemonOrcChest', [0, 2.14, 0], [-0.05, 0, 0]);
    addMesh(chest, 'DemonOrc_KilnTorso', geometry('orc-torso', () => new THREE.CylinderGeometry(0.83, 0.58, 1.38, 7)), materials.hide);
    addMesh(chest, 'DemonOrc_FurnacePlate', geometry('orc-breastplate', () => new THREE.OctahedronGeometry(0.72, 0)), materials.iron,
        { position: [0, 0.08, 0.42], scale: [1.05, 1, 0.38] });
    addMesh(chest, 'DemonOrc_FurnaceMouth', geometry('orc-furnace-mouth', () => new THREE.OctahedronGeometry(0.24, 0)), materials.ember,
        { position: [0, -0.05, 0.72], scale: [1.15, 0.72, 0.4], castShadow: false });
    for (let index = 0; index < 4; index += 1) {
        addMesh(chest, `DemonOrc_EmberRift${index + 1}`, geometry('orc-rift', () => new THREE.BoxGeometry(0.045, 0.4, 0.035)), materials.ember,
            { position: [-0.34 + index * 0.22, 0.03 + (index % 2) * 0.13, 0.69], rotation: [0, 0, -0.35 + index * 0.2], castShadow: false });
    }
    for (const [side, x] of [['Left', 0.62], ['Right', -0.62]]) {
        addMesh(chest, `DemonOrc_BackSpike${side}`, geometry('orc-back-spike', () => new THREE.ConeGeometry(0.13, 0.6, 5)), materials.bone,
            { position: [x, 0.42, -0.35], rotation: [Math.PI / 2.7, 0, side === 'Left' ? -0.25 : 0.25] });
    }
    const head = addPivot(chest, 'Rig_DemonOrcHead', [0, 1.05, 0.04]);
    addMesh(head, 'DemonOrc_Head', geometry('orc-head', () => new THREE.DodecahedronGeometry(0.48, 0)), materials.hide,
        { scale: [1.05, 0.95, 0.95] });
    addMesh(head, 'DemonOrc_KilnMask', geometry('orc-mask', () => new THREE.CylinderGeometry(0.38, 0.31, 0.48, 6)), materials.iron,
        { position: [0, 0.03, 0.38], rotation: [Math.PI / 2, 0, 0], scale: [1.08, 1, 0.55] });
    for (const [side, x] of [['Left', 0.39], ['Right', -0.39]]) {
        addMesh(head, `DemonOrc_Horn${side}`, geometry('orc-horn', () => new THREE.ConeGeometry(0.13, 0.65, 5)), materials.bone,
            { position: [x, 0.33, 0], rotation: [0, 0, side === 'Left' ? -0.78 : 0.78] });
        addMesh(head, `DemonOrc_Eye${side}`, geometry('orc-eye', () => new THREE.OctahedronGeometry(0.07, 0)), materials.ember,
            { position: [x * 0.43, 0.09, 0.54], scale: [1.2, 0.65, 0.45], castShadow: false });
    }
    const jaw = addPivot(head, 'Rig_DemonOrcJaw', [0, -0.28, 0.18], [0.04, 0, 0]);
    addMesh(jaw, 'DemonOrc_Jaw', geometry('orc-jaw', () => new THREE.BoxGeometry(0.55, 0.23, 0.38)), materials.hide,
        { position: [0, 0, 0.08] });
    for (const [side, x] of [['Left', 0.18], ['Right', -0.18]]) {
        addMesh(jaw, `DemonOrc_Tusk${side}`, geometry('orc-tusk', () => new THREE.ConeGeometry(0.065, 0.3, 5)), materials.bone,
            { position: [x, 0.18, 0.27], rotation: [0.18, 0, side === 'Left' ? -0.08 : 0.08] });
    }

    const leftHand = addOrcLimb(body, 'Left', materials, true);
    const rightHand = addOrcLimb(body, 'Right', materials, true);
    addOrcLimb(body, 'Left', materials, false);
    addOrcLimb(body, 'Right', materials, false);
    const weapon = addPivot(rightHand, 'Rig_DemonOrcWeapon', [0, -0.06, 0.04], [0.08, 0, -0.24]);
    addMesh(weapon, 'DemonOrc_CinderCleaverGrip', geometry('orc-cleaver-grip', () => new THREE.CylinderGeometry(0.065, 0.08, 1.25, 6)), materials.brass,
        { position: [0, -0.18, 0] });
    addMesh(weapon, 'DemonOrc_CinderCleaverBlade', geometry('orc-cleaver-blade', () => new THREE.BoxGeometry(0.72, 1.08, 0.16)), materials.iron,
        { position: [0.25, 0.73, 0], rotation: [0, 0, -0.2], scale: [0.82, 1, 1] });
    addMesh(weapon, 'DemonOrc_CinderCleaverEdge', geometry('orc-cleaver-edge', () => new THREE.BoxGeometry(0.09, 1.02, 0.19)), materials.ember,
        { position: [0.59, 0.69, 0], rotation: [0, 0, -0.2], castShadow: false });
    const chain = addPivot(leftHand, 'Rig_DemonOrcChain', [0, -0.12, 0.02], [0, 0, 0.16]);
    const linkGeometry = geometry('orc-chain-link', () => new THREE.TorusGeometry(0.085, 0.018, 4, 7));
    for (let index = 0; index < 5; index += 1) {
        addMesh(chain, `DemonOrc_ChainLink${index + 1}`, linkGeometry, materials.brass,
            { position: [0, -0.16 - index * 0.17, 0], rotation: [Math.PI / 2, index % 2 ? Math.PI / 2 : 0, 0] });
    }
    addMesh(chain, 'DemonOrc_ChainCoal', geometry('orc-chain-coal', () => new THREE.DodecahedronGeometry(0.2, 0)), materials.flame,
        { position: [0, -1.05, 0], castShadow: false });

    return finalizeEnemy(root, 'DemonOrc', createDemonOrcClips());
}

function addImpWing(body, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const wing = addPivot(body, `Rig_ImpWing${side}`, [sign * 0.3, 1.48, -0.18], [0.06, 0, sign * -0.28]);
    addMesh(wing, `Imp_WingFinger${side}1`, geometry('imp-wing-finger-long', () => new THREE.CylinderGeometry(0.025, 0.04, 0.9, 5)), materials.horn,
        { position: [sign * 0.35, 0.26, 0], rotation: [0, 0, sign * -0.88] });
    addMesh(wing, `Imp_WingFinger${side}2`, geometry('imp-wing-finger-short', () => new THREE.CylinderGeometry(0.022, 0.035, 0.7, 5)), materials.horn,
        { position: [sign * 0.28, -0.12, 0], rotation: [0, 0, sign * -1.08] });
    addMesh(wing, `Imp_WingMembrane${side}`, geometry('imp-wing-membrane', () => new THREE.ConeGeometry(0.55, 1.15, 3)), materials.wing,
        { position: [sign * 0.38, 0.02, 0.02], rotation: [Math.PI / 2, 0, sign * -0.72], scale: [0.58, 1, 0.12] });
    addMesh(wing, `Imp_WingEmber${side}`, geometry('imp-wing-ember', () => new THREE.ConeGeometry(0.08, 0.42, 4)), materials.ember,
        { position: [sign * 0.66, -0.26, 0.03], rotation: [0, 0, sign * -1.12], castShadow: false });
}

function addImpLimb(body, side, materials, isArm) {
    const sign = side === 'Left' ? 1 : -1;
    const firstName = isArm ? 'Shoulder' : 'Hip';
    const secondName = isArm ? 'Elbow' : 'Knee';
    const first = addPivot(body, `Rig_Imp${firstName}${side}`,
        isArm ? [sign * 0.38, 1.42, 0] : [sign * 0.18, 0.72, 0], [0, 0, isArm ? sign * -0.18 : 0]);
    addMesh(first, `Imp_Upper${isArm ? 'Arm' : 'Leg'}${side}`,
        geometry(isArm ? 'imp-upper-arm' : 'imp-thigh', () => new THREE.CylinderGeometry(isArm ? 0.07 : 0.09, isArm ? 0.105 : 0.13, isArm ? 0.42 : 0.44, 5)),
        materials.hide, { position: [0, isArm ? -0.23 : -0.25, 0] });
    const second = addPivot(first, `Rig_Imp${secondName}${side}`, [0, isArm ? -0.48 : -0.5, 0]);
    addMesh(second, `Imp_${secondName}${side}`, geometry('imp-joint', () => new THREE.DodecahedronGeometry(0.09, 0)), materials.horn);
    addMesh(second, `Imp_Lower${isArm ? 'Arm' : 'Leg'}${side}`,
        geometry(isArm ? 'imp-forearm' : 'imp-shin', () => new THREE.CylinderGeometry(isArm ? 0.055 : 0.065, isArm ? 0.08 : 0.09, isArm ? 0.38 : 0.4, 5)),
        materials.hide, { position: [0, isArm ? -0.21 : -0.23, 0] });
    const end = addPivot(second, `Rig_Imp${isArm ? 'Hand' : 'Foot'}${side}`, [0, isArm ? -0.43 : -0.46, isArm ? 0 : 0.1]);
    addMesh(end, `Imp_${isArm ? 'Claw' : 'Hoof'}${side}`,
        geometry(isArm ? 'imp-claw' : 'imp-hoof', () => isArm ? new THREE.ConeGeometry(0.105, 0.28, 5) : new THREE.BoxGeometry(0.18, 0.12, 0.3)),
        materials.horn, { position: [0, isArm ? -0.1 : 0, isArm ? 0 : 0.1], rotation: [isArm ? Math.PI : 0, 0, 0] });
    return end;
}

function createImpClips() {
    const idleTimes = [0, 0.42, 0.84, 1.26, 1.68];
    const walkTimes = [0, 0.26, 0.52, 0.78, 1.04];
    const runTimes = [0, 0.16, 0.32, 0.48, 0.64];
    const attackTimes = [0, 0.16, 0.34, 0.54, 0.78];
    const deathTimes = [0, 0.25, 0.52, 0.86, 1.2];
    return [
        new THREE.AnimationClip('Idle', 1.68, [
            numberTrack('Rig_ImpBody', 'position[y]', idleTimes, [0.33, 0.4, 0.33, 0.295, 0.33]),
            numberTrack('Rig_ImpBody', 'rotation[y]', idleTimes, [0, 0.05, 0, -0.05, 0]),
            numberTrack('Rig_ImpHead', 'rotation[z]', idleTimes, [0, 0.06, 0, -0.06, 0]),
            numberTrack('Rig_ImpJaw', 'rotation[x]', idleTimes, [0.05, 0.16, 0.05, 0.11, 0.05]),
            numberTrack('Rig_ImpWingLeft', 'rotation[z]', idleTimes, [-0.28, -0.55, -0.28, -0.04, -0.28]),
            numberTrack('Rig_ImpWingRight', 'rotation[z]', idleTimes, [0.28, 0.55, 0.28, 0.04, 0.28]),
            numberTrack('Rig_ImpTailBase', 'rotation[y]', idleTimes, [0, 0.25, 0, -0.25, 0]),
            numberTrack('Rig_ImpWeapon', 'rotation[z]', idleTimes, [-0.12, -0.06, -0.12, -0.2, -0.12])
        ]),
        new THREE.AnimationClip('Walk', 1.04, [
            numberTrack('Rig_ImpBody', 'position[y]', walkTimes, [0.33, 0.42, 0.33, 0.42, 0.33]),
            numberTrack('Rig_ImpBody', 'rotation[z]', walkTimes, [0, 0.05, 0, -0.05, 0]),
            numberTrack('Rig_ImpHipLeft', 'rotation[x]', walkTimes, [0.55, 0, -0.55, 0, 0.55]),
            numberTrack('Rig_ImpHipRight', 'rotation[x]', walkTimes, [-0.55, 0, 0.55, 0, -0.55]),
            numberTrack('Rig_ImpKneeLeft', 'rotation[x]', walkTimes, [0.05, 0.58, 0.08, 0.16, 0.05]),
            numberTrack('Rig_ImpKneeRight', 'rotation[x]', walkTimes, [0.08, 0.16, 0.05, 0.58, 0.08]),
            numberTrack('Rig_ImpShoulderLeft', 'rotation[x]', walkTimes, [-0.38, 0, 0.38, 0, -0.38]),
            numberTrack('Rig_ImpShoulderRight', 'rotation[x]', walkTimes, [0.38, 0, -0.38, 0, 0.38]),
            numberTrack('Rig_ImpWingLeft', 'rotation[z]', walkTimes, [-0.28, -0.64, -0.28, 0.1, -0.28]),
            numberTrack('Rig_ImpWingRight', 'rotation[z]', walkTimes, [0.28, 0.64, 0.28, -0.1, 0.28]),
            numberTrack('Rig_ImpTailBase', 'rotation[y]', walkTimes, [0, 0.42, 0, -0.42, 0])
        ]),
        new THREE.AnimationClip('Run', 0.64, [
            numberTrack('Rig_ImpBody', 'position[y]', runTimes, [0.33, 0.47, 0.33, 0.47, 0.33]),
            numberTrack('Rig_ImpBody', 'rotation[x]', runTimes, [0.16, 0.24, 0.16, 0.24, 0.16]),
            numberTrack('Rig_ImpHipLeft', 'rotation[x]', runTimes, [0.78, 0, -0.78, 0, 0.78]),
            numberTrack('Rig_ImpHipRight', 'rotation[x]', runTimes, [-0.78, 0, 0.78, 0, -0.78]),
            numberTrack('Rig_ImpShoulderLeft', 'rotation[x]', runTimes, [-0.62, 0, 0.62, 0, -0.62]),
            numberTrack('Rig_ImpShoulderRight', 'rotation[x]', runTimes, [0.62, 0, -0.62, 0, 0.62]),
            numberTrack('Rig_ImpWingLeft', 'rotation[z]', runTimes, [-0.45, -0.86, -0.45, 0.18, -0.45]),
            numberTrack('Rig_ImpWingRight', 'rotation[z]', runTimes, [0.45, 0.86, 0.45, -0.18, 0.45]),
            numberTrack('Rig_ImpTailBase', 'rotation[y]', runTimes, [0, 0.62, 0, -0.62, 0])
        ]),
        new THREE.AnimationClip('Attack', 0.78, [
            numberTrack('Rig_ImpBody', 'position[y]', attackTimes, [0.33, 0.41, 0.51, 0.31, 0.33]),
            numberTrack('Rig_ImpBody', 'rotation[y]', attackTimes, [0, -0.26, -0.48, 0.4, 0]),
            numberTrack('Rig_ImpShoulderRight', 'rotation[x]', attackTimes, [0, -0.8, -1.22, 0.9, 0]),
            numberTrack('Rig_ImpShoulderRight', 'rotation[z]', attackTimes, [0.18, 0.56, 0.78, -0.42, 0.18]),
            numberTrack('Rig_ImpElbowRight', 'rotation[x]', attackTimes, [0, -0.28, -0.58, 0.44, 0]),
            numberTrack('Rig_ImpWeapon', 'rotation[z]', attackTimes, [-0.12, -1, -1.4, 0.8, -0.12]),
            numberTrack('Rig_ImpWingLeft', 'rotation[z]', attackTimes, [-0.28, -0.7, -0.82, 0.12, -0.28]),
            numberTrack('Rig_ImpWingRight', 'rotation[z]', attackTimes, [0.28, 0.7, 0.82, -0.12, 0.28]),
            numberTrack('Rig_ImpTailBase', 'rotation[y]', attackTimes, [0, 0.35, 0.62, -0.5, 0])
        ]),
        new THREE.AnimationClip('Death', 1.2, [
            numberTrack('Rig_ImpBody', 'position[y]', deathTimes, [0.33, 0.41, 0.21, -0.19, -0.37]),
            numberTrack('Rig_ImpBody', 'rotation[x]', deathTimes, [0, -0.16, 0.38, 0.98, 1.4]),
            numberTrack('Rig_ImpBody', 'rotation[z]', deathTimes, [0, 0.1, -0.24, -0.7, -0.96]),
            numberTrack('Rig_ImpHead', 'rotation[x]', deathTimes, [0, -0.12, 0.3, 0.66, 0.9]),
            numberTrack('Rig_ImpWingLeft', 'rotation[z]', deathTimes, [-0.28, -0.68, -0.12, 0.52, 0.88]),
            numberTrack('Rig_ImpWingRight', 'rotation[z]', deathTimes, [0.28, 0.68, 0.12, -0.52, -0.88]),
            numberTrack('Rig_ImpShoulderLeft', 'rotation[z]', deathTimes, [-0.18, -0.46, -0.82, -1.1, -1.24]),
            numberTrack('Rig_ImpShoulderRight', 'rotation[z]', deathTimes, [0.18, 0.48, 0.85, 1.12, 1.26]),
            numberTrack('Rig_ImpTailBase', 'rotation[y]', deathTimes, [0, -0.2, 0.38, 0.85, 1.2]),
            numberTrack('Rig_ImpWeapon', 'rotation[z]', deathTimes, [-0.12, 0.15, 0.65, 1.22, 1.5])
        ])
    ];
}

export function createProceduralImp() {
    const definition = PROCEDURAL_LEGACY_ENEMY_DEFINITIONS.Imp;
    const p = definition.palette;
    const materials = {
        hide: material('ember-imp-hide', p.hide, { roughness: 0.9 }),
        belly: material('ember-imp-belly', p.belly, { roughness: 0.86 }),
        wing: material('ember-imp-wing', p.wing, { roughness: 0.95, side: THREE.DoubleSide }),
        horn: material('ember-imp-horn', p.horn, { roughness: 0.72 }),
        iron: material('ember-imp-iron', p.iron, { metalness: 0.58, roughness: 0.5 }),
        ember: material('ember-imp-ember', p.ember, { emissive: p.ember, emissiveIntensity: 1.45, roughness: 0.2 }),
        flame: material('ember-imp-flame', p.flame, { emissive: p.flame, emissiveIntensity: 1.8, roughness: 0.15 })
    };
    const root = new THREE.Group();
    addMesh(root, 'Imp_CinderScratch', geometry('imp-ground-mark', () => new THREE.RingGeometry(0.42, 0.49, 9)), materials.ember,
        { position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], castShadow: false, receiveShadow: false });
    const body = addPivot(root, 'Rig_ImpBody', [0, 0.33, 0]);
    addMesh(body, 'Imp_Belly', geometry('imp-belly', () => new THREE.DodecahedronGeometry(0.38, 0)), materials.belly,
        { position: [0, 1.02, 0], scale: [0.9, 1.2, 0.82] });
    addMesh(body, 'Imp_Back', geometry('imp-back', () => new THREE.ConeGeometry(0.34, 0.68, 6)), materials.hide,
        { position: [0, 1.3, -0.08], rotation: [Math.PI, 0, 0], scale: [1, 1, 0.86] });
    addMesh(body, 'Imp_HeartCoal', geometry('imp-heart', () => new THREE.OctahedronGeometry(0.13, 0)), materials.flame,
        { position: [0, 1.16, 0.35], rotation: [0, 0, Math.PI / 4], castShadow: false });
    for (let index = 0; index < 3; index += 1) {
        addMesh(body, `Imp_BellyBand${index + 1}`, geometry('imp-belly-band', () => new THREE.TorusGeometry(0.31, 0.025, 4, 8, Math.PI)), materials.iron,
            { position: [0, 0.91 + index * 0.16, 0.04], rotation: [Math.PI / 2, 0, 0] });
    }
    addImpWing(body, 'Left', materials);
    addImpWing(body, 'Right', materials);
    const head = addPivot(body, 'Rig_ImpHead', [0, 1.72, 0]);
    addMesh(head, 'Imp_Head', geometry('imp-head', () => new THREE.DodecahedronGeometry(0.34, 0)), materials.hide,
        { scale: [1.08, 0.95, 0.92] });
    for (const [side, x] of [['Left', 0.27], ['Right', -0.27]]) {
        addMesh(head, `Imp_Horn${side}`, geometry('imp-horn', () => new THREE.ConeGeometry(0.085, 0.55, 5)), materials.horn,
            { position: [x, 0.32, -0.01], rotation: [0, 0, side === 'Left' ? -0.6 : 0.6] });
        addMesh(head, `Imp_Eye${side}`, geometry('imp-eye', () => new THREE.OctahedronGeometry(0.065, 0)), materials.flame,
            { position: [x * 0.45, 0.06, 0.31], scale: [1.15, 0.62, 0.45], castShadow: false });
    }
    addMesh(head, 'Imp_Brow', geometry('imp-brow', () => new THREE.BoxGeometry(0.43, 0.08, 0.1)), materials.iron,
        { position: [0, 0.13, 0.29], rotation: [-0.12, 0, 0] });
    const jaw = addPivot(head, 'Rig_ImpJaw', [0, -0.22, 0.1], [0.05, 0, 0]);
    addMesh(jaw, 'Imp_Grin', geometry('imp-grin', () => new THREE.BoxGeometry(0.38, 0.14, 0.22)), materials.belly,
        { position: [0, 0, 0.07] });
    for (let index = 0; index < 5; index += 1) {
        addMesh(jaw, `Imp_Tooth${index + 1}`, geometry('imp-tooth', () => new THREE.ConeGeometry(0.022, 0.11, 4)), materials.horn,
            { position: [-0.12 + index * 0.06, 0.08, 0.18], rotation: [Math.PI, 0, 0] });
    }
    const leftHand = addImpLimb(body, 'Left', materials, true);
    const rightHand = addImpLimb(body, 'Right', materials, true);
    addImpLimb(body, 'Left', materials, false);
    addImpLimb(body, 'Right', materials, false);

    const tail = addPivot(body, 'Rig_ImpTailBase', [0, 0.85, -0.22]);
    for (let index = 0; index < 4; index += 1) {
        addMesh(tail, `Imp_TailSegment${index + 1}`, geometry('imp-tail-segment', () => new THREE.CylinderGeometry(0.045, 0.065, 0.38, 5)), materials.hide,
            { position: [0, -0.03 + index * 0.03, -0.12 - index * 0.2], rotation: [Math.PI / 2 + index * 0.08, 0, 0] });
    }
    addMesh(tail, 'Imp_TailSpade', geometry('imp-tail-spade', () => new THREE.ConeGeometry(0.16, 0.42, 4)), materials.ember,
        { position: [0, 0.12, -0.98], rotation: [Math.PI / 2, 0, Math.PI / 4], castShadow: false });
    const weapon = addPivot(rightHand, 'Rig_ImpWeapon', [0, -0.04, 0], [0.08, 0, -0.12]);
    addMesh(weapon, 'Imp_PilferForkShaft', geometry('imp-fork-shaft', () => new THREE.CylinderGeometry(0.025, 0.035, 1.15, 5)), materials.iron,
        { position: [0, -0.23, 0] });
    for (const x of [-0.1, 0, 0.1]) {
        addMesh(weapon, `Imp_PilferForkTine${x}`, geometry('imp-fork-tine', () => new THREE.ConeGeometry(0.035, 0.3, 4)), x === 0 ? materials.flame : materials.iron,
            { position: [x, 0.48, 0], castShadow: x !== 0 });
    }
    addMesh(leftHand, 'Imp_StolenCoal', geometry('imp-stolen-coal', () => new THREE.DodecahedronGeometry(0.14, 0)), materials.ember,
        { position: [0, -0.18, 0.08], castShadow: false });

    return finalizeEnemy(root, 'Imp', createImpClips());
}

export function createProceduralLegacyEnemy(type) {
    switch (type) {
        case 'Skeleton': return createProceduralSkeleton();
        case 'DemonOrc': return createProceduralDemonOrc();
        case 'Imp': return createProceduralImp();
        default: throw new Error(`Unknown procedural legacy enemy: ${type}`);
    }
}

export function getProceduralLegacyEnemyCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
