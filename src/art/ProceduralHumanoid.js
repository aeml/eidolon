import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

const FIGHTER_PALETTE = Object.freeze({
    iron: 0x343b46,
    ironLight: 0x747e84,
    edge: 0xc3c4b9,
    brass: 0xbd8437,
    leather: 0x4a2b1d,
    cloth: 0x7a2026,
    clothDark: 0x351016,
    skin: 0xa07860,
    glow: 0xffc04a
});

export const HUMANOID_ANIMATION_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const HUMANOID_EQUIPMENT_ANCHORS = Object.freeze({
    head: ['Equipment_Head'],
    shoulders: ['Equipment_ShoulderLeft', 'Equipment_ShoulderRight'],
    chest: ['Equipment_Chest'],
    gloves: ['Equipment_GloveLeft', 'Equipment_GloveRight'],
    belt: ['Equipment_Belt'],
    legs: ['Equipment_LegLeft', 'Equipment_LegRight'],
    feet: ['Equipment_FootLeft', 'Equipment_FootRight'],
    neck: ['Equipment_Neck'],
    ring1: ['Equipment_RingLeft'],
    ring2: ['Equipment_RingRight'],
    trinket1: ['Equipment_TrinketLeft'],
    trinket2: ['Equipment_TrinketRight'],
    mainHand: ['Equipment_MainHand'],
    offHand: ['Equipment_OffHand']
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
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            flatShading: true,
            side: options.side ?? THREE.FrontSide
        }));
    }
    return MATERIALS.get(key);
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

function addPivot(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(...position);
    pivot.rotation.set(...rotation);
    parent.add(pivot);
    return pivot;
}

function addAnchor(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const anchor = addPivot(parent, name, position, rotation);
    anchor.userData.equipmentAnchor = true;
    return anchor;
}

function addRivet(parent, name, position, size = 0.055) {
    return addMesh(
        parent,
        name,
        geometry('rivet', () => new THREE.OctahedronGeometry(1, 0)),
        material('fighter-brass', FIGHTER_PALETTE.brass, { metalness: 0.7, roughness: 0.38 }),
        { position, scale: [size, size, size] }
    );
}

function addArm(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const upperArm = addPivot(parent, `Rig_UpperArm${side}`, [sign * 0.87, 0.48, 0], [0.08, 0, -sign * 0.08]);
    addMesh(
        upperArm,
        `Fighter_UpperArm${side}`,
        geometry('limb-octagonal', () => new THREE.CylinderGeometry(0.2, 0.17, 0.72, 8)),
        materials.iron,
        { position: [0, -0.36, 0] }
    );

    const pauldronAnchor = addAnchor(upperArm, `Equipment_Shoulder${side}`, [0, -0.02, 0]);
    addMesh(
        pauldronAnchor,
        `Fighter_Pauldron${side}`,
        geometry('pauldron', () => new THREE.DodecahedronGeometry(0.5, 0)),
        materials.ironLight,
        { position: [sign * 0.05, -0.06, 0], scale: [1.12, 0.56, 0.86], rotation: [0, 0, sign * 0.16] }
    );
    addMesh(
        pauldronAnchor,
        `Fighter_PauldronRidge${side}`,
        geometry('pauldron-ridge', () => new THREE.ConeGeometry(0.13, 0.42, 4)),
        materials.edge,
        { position: [sign * 0.32, 0.14, 0], rotation: [0, 0, -sign * 0.45] }
    );
    addRivet(pauldronAnchor, `Fighter_PauldronRivet${side}`, [sign * 0.16, -0.12, 0.4], 0.06);

    const forearm = addPivot(upperArm, `Rig_Forearm${side}`, [0, -0.7, 0], [-0.08, 0, 0]);
    addMesh(
        forearm,
        `Fighter_Forearm${side}`,
        geometry('forearm', () => new THREE.CylinderGeometry(0.17, 0.13, 0.65, 8)),
        materials.leather,
        { position: [0, -0.32, 0] }
    );
    const gloveAnchor = addAnchor(forearm, `Equipment_Glove${side}`, [0, -0.63, 0]);
    addMesh(
        gloveAnchor,
        `Fighter_Gauntlet${side}`,
        geometry('gauntlet', () => new THREE.DodecahedronGeometry(0.2, 0)),
        materials.iron,
        { scale: [0.8, 1.05, 0.9] }
    );

    const ringName = side === 'Left' ? 'Equipment_RingLeft' : 'Equipment_RingRight';
    addAnchor(gloveAnchor, ringName, [sign * 0.12, -0.02, 0.05]);
    const handName = side === 'Left' ? 'Equipment_OffHand' : 'Equipment_MainHand';
    return addAnchor(gloveAnchor, handName, [0, -0.04, 0], [0, 0, sign * 0.08]);
}

function addLeg(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const thigh = addPivot(parent, `Rig_Thigh${side}`, [sign * 0.32, -0.12, 0], [0, 0, sign * 0.025]);
    const legAnchor = addAnchor(thigh, `Equipment_Leg${side}`);
    addMesh(
        legAnchor,
        `Fighter_Thigh${side}`,
        geometry('thigh', () => new THREE.CylinderGeometry(0.26, 0.21, 0.86, 8)),
        materials.iron,
        { position: [0, -0.43, 0] }
    );

    const shin = addPivot(thigh, `Rig_Shin${side}`, [0, -0.84, 0], [0.02, 0, 0]);
    addMesh(
        shin,
        `Fighter_Shin${side}`,
        geometry('shin', () => new THREE.CylinderGeometry(0.2, 0.16, 0.8, 8)),
        materials.leather,
        { position: [0, -0.4, 0] }
    );
    addMesh(
        shin,
        `Fighter_Greave${side}`,
        geometry('greave', () => new THREE.ConeGeometry(0.22, 0.72, 5)),
        materials.ironLight,
        { position: [0, -0.38, 0.11], rotation: [Math.PI, 0, 0], scale: [0.88, 1, 0.5] }
    );

    const footAnchor = addAnchor(shin, `Equipment_Foot${side}`, [0, -0.8, 0.09]);
    addMesh(
        footAnchor,
        `Fighter_Boot${side}`,
        geometry('boot', () => new THREE.BoxGeometry(0.38, 0.24, 0.62, 1, 1, 1)),
        materials.iron,
        { position: [0, 0.1, 0.13], rotation: [-0.05, 0, 0] }
    );
    return thigh;
}

function addShield(anchor, materials) {
    const shield = addPivot(anchor, 'Fighter_KiteShield', [0.06, 0.02, 0.22], [0.03, 0, -0.08]);
    addMesh(
        shield,
        'Fighter_ShieldFace',
        geometry('kite-shield', () => {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0.82);
            shape.lineTo(0.57, 0.52);
            shape.lineTo(0.48, -0.34);
            shape.lineTo(0, -0.84);
            shape.lineTo(-0.48, -0.34);
            shape.lineTo(-0.57, 0.52);
            shape.closePath();
            const result = new THREE.ExtrudeGeometry(shape, {
                depth: 0.11,
                bevelEnabled: true,
                bevelSegments: 1,
                bevelSize: 0.035,
                bevelThickness: 0.025,
                curveSegments: 1
            });
            result.center();
            return result;
        }),
        materials.iron,
        { rotation: [0, 0, 0] }
    );
    addMesh(
        shield,
        'Fighter_ShieldCrossVertical',
        geometry('shield-bar-v', () => new THREE.BoxGeometry(0.11, 1.35, 0.07)),
        materials.brass,
        { position: [0, 0.02, 0.095] }
    );
    addMesh(
        shield,
        'Fighter_ShieldCrossHorizontal',
        geometry('shield-bar-h', () => new THREE.BoxGeometry(0.86, 0.1, 0.07)),
        materials.brass,
        { position: [0, 0.23, 0.095] }
    );
    addMesh(
        shield,
        'Fighter_ShieldBoss',
        geometry('shield-boss', () => new THREE.OctahedronGeometry(0.17, 0)),
        materials.edge,
        { position: [0, 0.23, 0.16], scale: [1, 1, 0.56] }
    );
}

function addSword(anchor, materials) {
    const sword = addPivot(anchor, 'Fighter_Oathblade', [0, -0.02, 0], [0.08, 0, -0.1]);
    addMesh(
        sword,
        'Fighter_SwordGrip',
        geometry('sword-grip', () => new THREE.CylinderGeometry(0.065, 0.065, 0.46, 8)),
        materials.leather,
        { position: [0, -0.12, 0] }
    );
    addMesh(
        sword,
        'Fighter_SwordPommel',
        geometry('sword-pommel', () => new THREE.OctahedronGeometry(0.11, 0)),
        materials.brass,
        { position: [0, -0.38, 0] }
    );
    addMesh(
        sword,
        'Fighter_SwordGuard',
        geometry('sword-guard', () => new THREE.BoxGeometry(0.6, 0.09, 0.1)),
        materials.brass,
        { position: [0, 0.1, 0] }
    );
    addMesh(
        sword,
        'Fighter_SwordBlade',
        geometry('sword-blade', () => new THREE.CylinderGeometry(0.12, 0.17, 1.52, 4)),
        materials.edge,
        { position: [0, 0.89, 0], rotation: [0, Math.PI / 4, 0], scale: [0.66, 1, 0.3] }
    );
    addMesh(
        sword,
        'Fighter_SwordFuller',
        geometry('sword-fuller', () => new THREE.BoxGeometry(0.035, 1.1, 0.035)),
        materials.glow,
        { position: [0, 0.82, 0.08] }
    );
}

function numberTrack(name, property, times, values) {
    return new THREE.NumberKeyframeTrack(`${name}.${property}`, times, values);
}

function createHumanoidAnimationClips() {
    const idle = [
        numberTrack('Rig_Chest', 'position[y]', [0, 0.9, 1.8], [0.42, 0.46, 0.42]),
        numberTrack('Rig_Chest', 'rotation[x]', [0, 0.9, 1.8], [0.01, -0.025, 0.01]),
        numberTrack('Rig_Head', 'rotation[y]', [0, 0.45, 1.35, 1.8], [0, 0.06, -0.045, 0]),
        numberTrack('Rig_UpperArmLeft', 'rotation[z]', [0, 0.9, 1.8], [-0.08, -0.105, -0.08]),
        numberTrack('Rig_UpperArmRight', 'rotation[z]', [0, 0.9, 1.8], [0.08, 0.105, 0.08]),
        numberTrack('Rig_Cloak', 'rotation[x]', [0, 0.9, 1.8], [0.05, 0.1, 0.05])
    ];

    const walkTimes = [0, 0.25, 0.5, 0.75, 1];
    const walk = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', walkTimes, [-0.55, 0, 0.55, 0, -0.55]),
        numberTrack('Rig_ThighRight', 'rotation[x]', walkTimes, [0.55, 0, -0.55, 0, 0.55]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', walkTimes, [0.42, 0.05, 0.02, 0.38, 0.42]),
        numberTrack('Rig_ShinRight', 'rotation[x]', walkTimes, [0.02, 0.38, 0.42, 0.05, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', walkTimes, [0.38, 0, -0.38, 0, 0.38]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', walkTimes, [-0.38, 0, 0.38, 0, -0.38]),
        numberTrack('Rig_Hips', 'position[y]', walkTimes, [1.8, 1.86, 1.8, 1.86, 1.8]),
        numberTrack('Rig_Hips', 'rotation[y]', walkTimes, [-0.045, 0, 0.045, 0, -0.045]),
        numberTrack('Rig_Cloak', 'rotation[x]', walkTimes, [0.08, 0.15, 0.08, 0.15, 0.08])
    ];

    const runTimes = [0, 0.15, 0.3, 0.45, 0.6];
    const run = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', runTimes, [-0.85, 0, 0.85, 0, -0.85]),
        numberTrack('Rig_ThighRight', 'rotation[x]', runTimes, [0.85, 0, -0.85, 0, 0.85]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', runTimes, [0.72, 0.08, 0.02, 0.62, 0.72]),
        numberTrack('Rig_ShinRight', 'rotation[x]', runTimes, [0.02, 0.62, 0.72, 0.08, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', runTimes, [0.66, 0, -0.66, 0, 0.66]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', runTimes, [-0.66, 0, 0.66, 0, -0.66]),
        numberTrack('Rig_Chest', 'rotation[x]', runTimes, [-0.16, -0.2, -0.16, -0.2, -0.16]),
        numberTrack('Rig_Hips', 'position[y]', runTimes, [1.76, 1.88, 1.76, 1.88, 1.76]),
        numberTrack('Rig_Cloak', 'rotation[x]', runTimes, [0.2, 0.42, 0.2, 0.42, 0.2])
    ];

    const attackTimes = [0, 0.17, 0.34, 0.5, 0.72];
    const attack = [
        numberTrack('Rig_Hips', 'rotation[y]', attackTimes, [0, -0.34, -0.2, 0.48, 0]),
        numberTrack('Rig_Chest', 'rotation[y]', attackTimes, [0, -0.5, -0.22, 0.65, 0]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', attackTimes, [0.08, -1.75, -1.35, 1.05, 0.08]),
        numberTrack('Rig_UpperArmRight', 'rotation[z]', attackTimes, [0.08, 0.62, 0.45, -0.32, 0.08]),
        numberTrack('Rig_ForearmRight', 'rotation[x]', attackTimes, [-0.08, -0.72, -0.32, -0.1, -0.08]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', attackTimes, [0.08, 0.28, 0.24, -0.18, 0.08]),
        numberTrack('Rig_ThighLeft', 'rotation[x]', attackTimes, [0, 0.12, 0.18, -0.08, 0]),
        numberTrack('Rig_Cloak', 'rotation[x]', attackTimes, [0.05, 0.28, 0.22, -0.12, 0.05])
    ];

    const deathTimes = [0, 0.24, 0.58, 1.05];
    const death = [
        numberTrack('RigRoot', 'rotation[z]', deathTimes, [0, -0.08, -0.62, -1.48]),
        numberTrack('RigRoot', 'position[y]', deathTimes, [0, 0, -0.18, -0.7]),
        numberTrack('RigRoot', 'position[x]', deathTimes, [0, 0.04, 0.3, 0.76]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', deathTimes, [0.08, -0.42, 0.45, 0.9]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', deathTimes, [0.08, 0.35, -0.3, -0.72]),
        numberTrack('Rig_Head', 'rotation[x]', deathTimes, [0, 0.18, 0.42, 0.5])
    ];

    return [
        new THREE.AnimationClip('Idle', 1.8, idle),
        new THREE.AnimationClip('Walk', 1, walk),
        new THREE.AnimationClip('Run', 0.6, run),
        new THREE.AnimationClip('Attack', 0.72, attack),
        new THREE.AnimationClip('Death', 1.05, death)
    ];
}

function assertEquipmentAnchors(root) {
    const names = Object.values(HUMANOID_EQUIPMENT_ANCHORS).flat();
    const missing = names.filter((name) => !root.getObjectByName(name));
    if (missing.length > 0) {
        throw new Error(`Procedural humanoid is missing equipment anchors: ${missing.join(', ')}`);
    }
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

/**
 * Creates the shared code-native humanoid foundation with the Fighter's
 * Lanternhold oathguard silhouette. Geometry and immutable materials are
 * cached; transform pivots and animation state are unique per actor instance.
 */
export function createProceduralFighter() {
    const materials = {
        iron: material('fighter-iron', FIGHTER_PALETTE.iron, { metalness: 0.72, roughness: 0.42 }),
        ironLight: material('fighter-iron-light', FIGHTER_PALETTE.ironLight, { metalness: 0.66, roughness: 0.38 }),
        edge: material('fighter-edge', FIGHTER_PALETTE.edge, { metalness: 0.88, roughness: 0.25 }),
        brass: material('fighter-brass', FIGHTER_PALETTE.brass, { metalness: 0.7, roughness: 0.38 }),
        leather: material('fighter-leather', FIGHTER_PALETTE.leather, { roughness: 0.9 }),
        cloth: material('fighter-cloth', FIGHTER_PALETTE.cloth, { roughness: 0.96 }),
        clothDark: material('fighter-cloth-dark', FIGHTER_PALETTE.clothDark, { roughness: 0.98 }),
        skin: material('fighter-skin', FIGHTER_PALETTE.skin, { roughness: 0.88 }),
        glow: material('fighter-glow', FIGHTER_PALETTE.glow, {
            emissive: FIGHTER_PALETTE.glow,
            emissiveIntensity: 1.4,
            roughness: 0.3
        })
    };

    const root = new THREE.Group();
    root.name = 'ProceduralFighter';
    const rigRoot = addPivot(root, 'RigRoot');
    const hips = addPivot(rigRoot, 'Rig_Hips', [0, 1.8, 0]);

    addMesh(
        hips,
        'Fighter_HipArmor',
        geometry('hip-armor', () => new THREE.CylinderGeometry(0.58, 0.5, 0.52, 8)),
        materials.iron,
        { position: [0, 0.08, 0] }
    );
    addMesh(
        hips,
        'Fighter_TabardFront',
        geometry('tabard', () => new THREE.BoxGeometry(0.48, 0.82, 0.08)),
        materials.cloth,
        { position: [0, -0.38, 0.4], rotation: [-0.08, 0, 0] }
    );
    addMesh(
        hips,
        'Fighter_TabardMark',
        geometry('tabard-mark', () => new THREE.OctahedronGeometry(0.13, 0)),
        materials.brass,
        { position: [0, -0.42, 0.46], scale: [0.7, 1.35, 0.32] }
    );

    const beltAnchor = addAnchor(hips, 'Equipment_Belt', [0, 0.2, 0]);
    addMesh(
        beltAnchor,
        'Fighter_Belt',
        geometry('belt', () => new THREE.CylinderGeometry(0.54, 0.54, 0.16, 8)),
        materials.leather
    );
    addMesh(
        beltAnchor,
        'Fighter_BeltBuckle',
        geometry('belt-buckle', () => new THREE.BoxGeometry(0.22, 0.22, 0.08)),
        materials.brass,
        { position: [0, 0, 0.52], rotation: [0, 0, Math.PI / 4] }
    );
    addAnchor(beltAnchor, 'Equipment_TrinketLeft', [0.34, -0.18, 0.28]);
    addAnchor(beltAnchor, 'Equipment_TrinketRight', [-0.34, -0.18, 0.28]);

    addLeg(hips, 'Left', materials);
    addLeg(hips, 'Right', materials);

    const chest = addPivot(hips, 'Rig_Chest', [0, 0.42, 0], [0.01, 0, 0]);
    const chestAnchor = addAnchor(chest, 'Equipment_Chest');
    addMesh(
        chestAnchor,
        'Fighter_Breastplate',
        geometry('breastplate', () => new THREE.CylinderGeometry(0.62, 0.52, 1.12, 8)),
        materials.iron,
        { position: [0, 0.48, 0], scale: [1.18, 1, 0.72] }
    );
    addMesh(
        chestAnchor,
        'Fighter_BreastplateKeel',
        geometry('breastplate-keel', () => new THREE.ConeGeometry(0.29, 0.82, 4)),
        materials.ironLight,
        { position: [0, 0.48, 0.48], rotation: [0, 0, Math.PI], scale: [0.66, 1, 0.3] }
    );
    addMesh(
        chestAnchor,
        'Fighter_OathSigil',
        geometry('oath-sigil', () => new THREE.TorusGeometry(0.16, 0.035, 4, 8)),
        materials.glow,
        { position: [0, 0.55, 0.61], rotation: [Math.PI / 2, 0, 0], scale: [0.84, 1.18, 1] }
    );
    addMesh(
        chestAnchor,
        'Fighter_ChestCollar',
        geometry('chest-collar', () => new THREE.TorusGeometry(0.48, 0.085, 4, 8, Math.PI)),
        materials.edge,
        { position: [0, 1.02, 0.03], rotation: [Math.PI / 2, 0, 0] }
    );
    addRivet(chestAnchor, 'Fighter_ChestRivetLeft', [0.45, 0.72, 0.45]);
    addRivet(chestAnchor, 'Fighter_ChestRivetRight', [-0.45, 0.72, 0.45]);

    const cloak = addPivot(chest, 'Rig_Cloak', [0, 0.78, -0.42], [0.05, 0, 0]);
    addMesh(
        cloak,
        'Fighter_Cloak',
        geometry('cloak', () => {
            const shape = new THREE.Shape();
            shape.moveTo(-0.58, 0.1);
            shape.lineTo(0.58, 0.1);
            shape.lineTo(0.44, -1.64);
            shape.lineTo(0.15, -1.48);
            shape.lineTo(0, -1.66);
            shape.lineTo(-0.16, -1.48);
            shape.lineTo(-0.44, -1.64);
            shape.closePath();
            return new THREE.ShapeGeometry(shape, 1);
        }),
        materials.clothDark,
        { position: [0, -0.05, 0], rotation: [0.08, Math.PI, 0], castShadow: true, receiveShadow: false }
    );

    const neckAnchor = addAnchor(chest, 'Equipment_Neck', [0, 1.07, 0.04]);
    addMesh(
        neckAnchor,
        'Fighter_Gorget',
        geometry('gorget', () => new THREE.CylinderGeometry(0.31, 0.4, 0.26, 8)),
        materials.ironLight,
        { position: [0, 0.03, 0] }
    );

    const head = addPivot(chest, 'Rig_Head', [0, 1.35, 0]);
    const headAnchor = addAnchor(head, 'Equipment_Head');
    const face = addMesh(
        headAnchor,
        'Fighter_Head',
        geometry('head', () => new THREE.DodecahedronGeometry(0.31, 1)),
        materials.skin,
        { position: [0, 0.12, 0], scale: [0.86, 1.08, 0.86] }
    );
    face.userData.equipmentBodyBase = true;
    addMesh(
        headAnchor,
        'Fighter_GreatHelm',
        geometry('great-helm', () => new THREE.CylinderGeometry(0.38, 0.34, 0.65, 8)),
        materials.iron,
        { position: [0, 0.17, 0] }
    );
    addMesh(
        headAnchor,
        'Fighter_HelmBrow',
        geometry('helm-brow', () => new THREE.BoxGeometry(0.68, 0.12, 0.12)),
        materials.edge,
        { position: [0, 0.23, 0.31] }
    );
    addMesh(
        headAnchor,
        'Fighter_HelmNose',
        geometry('helm-nose', () => new THREE.BoxGeometry(0.09, 0.37, 0.09)),
        materials.edge,
        { position: [0, 0.05, 0.37] }
    );
    const eyes = addMesh(
        headAnchor,
        'Fighter_EyeGlow',
        geometry('eye-glow', () => new THREE.BoxGeometry(0.42, 0.045, 0.035)),
        materials.glow,
        { position: [0, 0.18, 0.385] }
    );
    eyes.userData.equipmentBodyBase = true;
    addMesh(
        headAnchor,
        'Fighter_HelmCrown',
        geometry('helm-crown', () => new THREE.ConeGeometry(0.12, 0.45, 4)),
        materials.brass,
        { position: [0, 0.7, -0.02], rotation: [0, 0, Math.PI] }
    );

    const offHand = addArm(chest, 'Left', materials);
    const mainHand = addArm(chest, 'Right', materials);
    addShield(offHand, materials);
    addSword(mainHand, materials);

    assertEquipmentAnchors(root);
    root.userData.proceduralHumanoid = true;
    root.userData.proceduralClass = 'Fighter';
    root.userData.artStyle = 'Lanternhold oathguard';
    root.userData.sharedGeometry = true;
    root.userData.equipmentAnchors = Object.fromEntries(
        Object.entries(HUMANOID_EQUIPMENT_ANCHORS).map(([slot, names]) => [slot, [...names]])
    );
    root.userData.animations = createHumanoidAnimationClips();
    root.userData.bounds = Object.freeze({ radius: 1.25, height: 4.5, origin: 'feet' });
    installRestPoseReset(root);
    return root;
}

export function getProceduralHumanoidCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
