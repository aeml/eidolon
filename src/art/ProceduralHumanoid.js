import * as THREE from 'three';
import { createTailoredTorsoGeometry, createPairedEyesGeometry, createOpenHoodGeometry } from './ProceduralGarmentGeometry.js';

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

const ROGUE_PALETTE = Object.freeze({
    leather: 0x25272b,
    leatherLight: 0x4c5052,
    cloth: 0x24202d,
    clothDark: 0x100f16,
    steel: 0x8a9699,
    silver: 0xc0c8c3,
    poison: 0x68c878,
    skin: 0x8f6b5c,
    hair: 0x17151d,
    hairLight: 0x49364d,
    lips: 0x793b4d,
    glow: 0x78e08a
});

const WIZARD_PALETTE = Object.freeze({
    cloth: 0x24233b,
    clothDark: 0x10121f,
    clothLight: 0x4a4b70,
    slate: 0x41485c,
    silver: 0xa9b8ca,
    leather: 0x34283b,
    skin: 0x927065,
    arcane: 0x8d78ff,
    storm: 0x73d9ff
});

const CLERIC_PALETTE = Object.freeze({
    cloth: 0x70243d,
    clothDark: 0x24121d,
    ivory: 0xc8b99d,
    bronze: 0x9a6938,
    gold: 0xe0b75a,
    iron: 0x56616a,
    leather: 0x38232a,
    skin: 0xc18b76,
    hair: 0x5b281f,
    hairLight: 0x9d4f37,
    lips: 0xa74762,
    holy: 0xffdf72,
    spirit: 0xa9f0c2
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
    const upperArm = addPivot(parent, `Rig_UpperArm${side}`, [sign * 0.81, 0.72, 0], [0.08, 0, -sign * 0.08]);
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

function addRogueDagger(anchor, materials, side, name) {
    const sign = side === 'Left' ? 1 : -1;
    const dagger = addPivot(anchor, name, [0, -0.03, 0], [0.08, sign * 0.08, -sign * 0.14]);
    addMesh(
        dagger,
        `${name}_Grip`,
        geometry('rogue-dagger-grip', () => new THREE.CylinderGeometry(0.052, 0.058, 0.34, 7)),
        materials.leather,
        { position: [0, -0.1, 0] }
    );
    addMesh(
        dagger,
        `${name}_Pommel`,
        geometry('rogue-dagger-pommel', () => new THREE.OctahedronGeometry(0.075, 0)),
        materials.poison,
        { position: [0, -0.3, 0], scale: [0.7, 1, 0.7] }
    );
    addMesh(
        dagger,
        `${name}_Guard`,
        geometry('rogue-dagger-guard', () => new THREE.BoxGeometry(0.35, 0.06, 0.075)),
        materials.steel,
        { position: [0, 0.08, 0], rotation: [0, 0, sign * 0.12] }
    );
    addMesh(
        dagger,
        `${name}_Blade`,
        geometry('rogue-dagger-blade', () => new THREE.CylinderGeometry(0.035, 0.115, 0.82, 4)),
        materials.silver,
        { position: [0, 0.51, 0], rotation: [0, Math.PI / 4, 0], scale: [0.62, 1, 0.25] }
    );
    addMesh(
        dagger,
        `${name}_VenomChannel`,
        geometry('rogue-dagger-channel', () => new THREE.BoxGeometry(0.022, 0.52, 0.022)),
        materials.poison,
        { position: [0, 0.49, 0.052] }
    );
}

function addRogueArm(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const upperArm = addPivot(parent, `Rig_UpperArm${side}`, [sign * 0.63, 0.66, 0.01], [0.16, 0, -sign * 0.13]);
    addMesh(
        upperArm,
        `Rogue_UpperArm${side}`,
        geometry('rogue-upper-arm', () => new THREE.CylinderGeometry(0.145, 0.12, 0.7, 7)),
        materials.cloth,
        { position: [0, -0.35, 0] }
    );

    const shoulder = addAnchor(upperArm, `Equipment_Shoulder${side}`, [0, -0.02, 0]);
    addMesh(
        shoulder,
        `Rogue_ShoulderGuard${side}`,
        geometry('rogue-shoulder-guard', () => new THREE.DodecahedronGeometry(0.38, 0)),
        side === 'Left' ? materials.leatherLight : materials.leather,
        {
            position: [sign * 0.04, -0.08, 0.01],
            rotation: [0, 0, sign * 0.18],
            scale: side === 'Left' ? [1.12, 0.48, 0.78] : [0.92, 0.38, 0.68]
        }
    );
    if (side === 'Left') {
        addMesh(
            shoulder,
            'Rogue_ShoulderHookLeft',
            geometry('rogue-shoulder-hook', () => new THREE.ConeGeometry(0.085, 0.34, 4)),
            materials.steel,
            { position: [0.23, 0.08, -0.02], rotation: [0, 0, -0.5] }
        );
    }

    const forearm = addPivot(upperArm, `Rig_Forearm${side}`, [0, -0.68, 0], [-0.16, 0, 0]);
    addMesh(
        forearm,
        `Rogue_Forearm${side}`,
        geometry('rogue-forearm', () => new THREE.CylinderGeometry(0.135, 0.105, 0.62, 7)),
        materials.skin,
        { position: [0, -0.3, 0] }
    );
    const glove = addAnchor(forearm, `Equipment_Glove${side}`, [0, -0.59, 0]);
    addMesh(
        glove,
        `Rogue_Bracer${side}`,
        geometry('rogue-bracer', () => new THREE.CylinderGeometry(0.14, 0.115, 0.34, 7)),
        materials.leatherLight,
        { position: [0, 0.11, 0] }
    );
    addMesh(
        glove,
        `Rogue_WristBlade${side}`,
        geometry('rogue-wrist-blade', () => new THREE.ConeGeometry(0.055, 0.38, 4)),
        materials.steel,
        { position: [0, 0.08, 0.16], rotation: [Math.PI / 2, 0, 0] }
    );

    addAnchor(glove, side === 'Left' ? 'Equipment_RingLeft' : 'Equipment_RingRight', [sign * 0.1, -0.03, 0.04]);
    return addAnchor(
        glove,
        side === 'Left' ? 'Equipment_OffHand' : 'Equipment_MainHand',
        [0, -0.04, 0],
        [0, 0, sign * 0.08]
    );
}

function addRogueLeg(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const thigh = addPivot(parent, `Rig_Thigh${side}`, [sign * 0.29, -0.08, 0], [0.04, 0, sign * 0.035]);
    const leg = addAnchor(thigh, `Equipment_Leg${side}`);
    addMesh(
        leg,
        `Rogue_Thigh${side}`,
        geometry('rogue-thigh', () => new THREE.CylinderGeometry(0.225, 0.17, 0.8, 7)),
        materials.cloth,
        { position: [0, -0.4, 0] }
    );
    addMesh(
        leg,
        `Rogue_ThighStrap${side}`,
        geometry('rogue-thigh-strap', () => new THREE.TorusGeometry(0.185, 0.035, 4, 7)),
        materials.leatherLight,
        { position: [0, -0.25, 0], rotation: [Math.PI / 2, 0, 0], scale: [1, 0.82, 1] }
    );

    const shin = addPivot(thigh, `Rig_Shin${side}`, [0, -0.78, 0], [0.08, 0, 0]);
    addMesh(
        shin,
        `Rogue_Shin${side}`,
        geometry('rogue-shin', () => new THREE.CylinderGeometry(0.16, 0.12, 0.73, 7)),
        materials.clothDark,
        { position: [0, -0.36, 0] }
    );
    addMesh(
        shin,
        `Rogue_ShinGuard${side}`,
        geometry('rogue-shin-guard', () => new THREE.ConeGeometry(0.16, 0.56, 5)),
        materials.leatherLight,
        { position: [0, -0.35, 0.1], rotation: [Math.PI, 0, 0], scale: [0.8, 1, 0.42] }
    );

    const foot = addAnchor(shin, `Equipment_Foot${side}`, [0, -0.78, 0.08]);
    addMesh(
        foot,
        `Rogue_Boot${side}`,
        geometry('rogue-boot', () => new THREE.BoxGeometry(0.31, 0.2, 0.56)),
        materials.leather,
        { position: [0, 0.09, 0.13], rotation: [-0.08, 0, 0] }
    );
    addMesh(
        foot,
        `Rogue_BootToe${side}`,
        geometry('rogue-boot-toe', () => new THREE.ConeGeometry(0.15, 0.3, 5)),
        materials.leatherLight,
        { position: [0, 0.08, 0.39], rotation: [Math.PI / 2, 0, 0], scale: [0.86, 1, 0.62] }
    );
}

function addWizardArm(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const upperArm = addPivot(parent, `Rig_UpperArm${side}`, [sign * 0.68, 0.73, 0], [-0.04, 0, -sign * 0.16]);
    addMesh(
        upperArm,
        `Wizard_UpperArm${side}`,
        geometry('wizard-upper-arm', () => new THREE.CylinderGeometry(0.19, 0.145, 0.74, 7)),
        materials.cloth,
        { position: [0, -0.36, 0], scale: [1, 1, 0.88] }
    );

    const shoulder = addAnchor(upperArm, `Equipment_Shoulder${side}`, [0, -0.02, 0]);
    addMesh(
        shoulder,
        `Wizard_Mantle${side}`,
        geometry('wizard-mantle', () => new THREE.TetrahedronGeometry(0.42, 0)),
        side === 'Left' ? materials.slate : materials.clothLight,
        {
            position: [sign * 0.04, -0.08, -0.01],
            rotation: [0.1, 0, sign * 0.72],
            scale: side === 'Left' ? [1.2, 0.72, 0.9] : [1, 0.62, 0.82]
        }
    );
    addMesh(
        shoulder,
        `Wizard_MantleRune${side}`,
        geometry('wizard-mantle-rune', () => new THREE.TorusGeometry(0.1, 0.025, 4, 6)),
        side === 'Left' ? materials.storm : materials.arcane,
        { position: [sign * 0.08, -0.08, 0.25], rotation: [Math.PI / 2, 0, 0], scale: [0.9, 1.2, 1] }
    );

    const forearm = addPivot(upperArm, `Rig_Forearm${side}`, [0, -0.71, 0], [0.08, 0, 0]);
    addMesh(
        forearm,
        `Wizard_Forearm${side}`,
        geometry('wizard-forearm', () => new THREE.CylinderGeometry(0.14, 0.105, 0.64, 7)),
        materials.skin,
        { position: [0, -0.31, 0] }
    );
    const glove = addAnchor(forearm, `Equipment_Glove${side}`, [0, -0.62, 0]);
    addMesh(
        glove,
        `Wizard_RuneBracer${side}`,
        geometry('wizard-rune-bracer', () => new THREE.CylinderGeometry(0.155, 0.115, 0.36, 7)),
        materials.slate,
        { position: [0, 0.12, 0] }
    );
    addMesh(
        glove,
        `Wizard_BracerGem${side}`,
        geometry('wizard-bracer-gem', () => new THREE.OctahedronGeometry(0.075, 0)),
        side === 'Left' ? materials.storm : materials.arcane,
        { position: [0, 0.12, 0.14], scale: [0.75, 1, 0.45] }
    );

    addAnchor(glove, side === 'Left' ? 'Equipment_RingLeft' : 'Equipment_RingRight', [sign * 0.1, -0.04, 0.04]);
    return addAnchor(
        glove,
        side === 'Left' ? 'Equipment_OffHand' : 'Equipment_MainHand',
        [0, -0.05, 0],
        [0, 0, sign * 0.06]
    );
}

function addWizardLeg(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const thigh = addPivot(parent, `Rig_Thigh${side}`, [sign * 0.28, -0.1, 0], [0, 0, sign * 0.025]);
    const leg = addAnchor(thigh, `Equipment_Leg${side}`);
    addMesh(
        leg,
        `Wizard_Thigh${side}`,
        geometry('wizard-thigh', () => new THREE.CylinderGeometry(0.22, 0.17, 0.84, 7)),
        materials.clothDark,
        { position: [0, -0.42, 0] }
    );
    addMesh(
        leg,
        `Wizard_RobePanel${side}`,
        geometry('wizard-robe-panel', () => {
            const shape = new THREE.Shape();
            shape.moveTo(-0.3, 0.12);
            shape.lineTo(0.3, 0.12);
            shape.lineTo(0.22, -1.12);
            shape.lineTo(0, -1.28);
            shape.lineTo(-0.24, -1.08);
            shape.closePath();
            return new THREE.ShapeGeometry(shape, 1);
        }),
        side === 'Left' ? materials.cloth : materials.clothLight,
        { position: [sign * 0.12, -0.16, 0.22], rotation: [0.04, Math.PI, sign * 0.035], receiveShadow: false }
    );

    const shin = addPivot(thigh, `Rig_Shin${side}`, [0, -0.82, 0], [0.03, 0, 0]);
    addMesh(
        shin,
        `Wizard_Shin${side}`,
        geometry('wizard-shin', () => new THREE.CylinderGeometry(0.17, 0.12, 0.78, 7)),
        materials.clothDark,
        { position: [0, -0.38, 0] }
    );
    const foot = addAnchor(shin, `Equipment_Foot${side}`, [0, -0.8, 0.08]);
    addMesh(
        foot,
        `Wizard_Boot${side}`,
        geometry('wizard-boot', () => new THREE.BoxGeometry(0.32, 0.22, 0.58)),
        materials.leather,
        { position: [0, 0.1, 0.13], rotation: [-0.06, 0, 0] }
    );
    addMesh(
        foot,
        `Wizard_BootCap${side}`,
        geometry('wizard-boot-cap', () => new THREE.ConeGeometry(0.15, 0.32, 5)),
        materials.slate,
        { position: [0, 0.1, 0.4], rotation: [Math.PI / 2, 0, 0], scale: [0.82, 1, 0.58] }
    );
}

function addWizardStaff(anchor, materials) {
    const staff = addPivot(anchor, 'Wizard_Stormstaff', [0, -0.2, 0], [0.04, 0, -0.08]);
    addMesh(
        staff,
        'Wizard_StaffShaft',
        geometry('wizard-staff-shaft', () => new THREE.CylinderGeometry(0.055, 0.075, 2.65, 7)),
        materials.leather,
        { position: [0, 0.68, 0] }
    );
    addMesh(
        staff,
        'Wizard_StaffHeel',
        geometry('wizard-staff-heel', () => new THREE.ConeGeometry(0.09, 0.34, 5)),
        materials.silver,
        { position: [0, -0.82, 0], rotation: [0, 0, Math.PI] }
    );
    [-1, 1].forEach((side) => {
        addMesh(
            staff,
            side < 0 ? 'Wizard_StaffProngLeft' : 'Wizard_StaffProngRight',
            geometry('wizard-staff-prong', () => new THREE.ConeGeometry(0.075, 0.62, 5)),
            materials.silver,
            { position: [side * 0.2, 2.06, 0], rotation: [0, 0, side * 0.46], scale: [0.9, 1, 0.68] }
        );
    });
    addMesh(
        staff,
        'Wizard_StaffHalo',
        geometry('wizard-staff-halo', () => new THREE.TorusGeometry(0.28, 0.045, 5, 10)),
        materials.arcane,
        { position: [0, 2.05, 0], rotation: [Math.PI / 2, 0, 0] }
    );
    addMesh(
        staff,
        'Wizard_StaffCore',
        geometry('wizard-staff-core', () => new THREE.OctahedronGeometry(0.17, 1)),
        materials.storm,
        { position: [0, 2.05, 0], scale: [0.75, 1.3, 0.75] }
    );
}

function addWizardFocus(anchor, materials) {
    const focus = addPivot(anchor, 'Rig_Focus', [0.08, 0.5, 0.08], [0, 0, 0]);
    focus.userData.defaultEquipmentPart = true;
    addMesh(
        focus,
        'Wizard_Astrolabe',
        geometry('wizard-astrolabe', () => new THREE.TorusGeometry(0.29, 0.035, 5, 10)),
        materials.silver,
        { rotation: [Math.PI / 2, 0, 0] }
    );
    addMesh(
        focus,
        'Wizard_AstrolabeCross',
        geometry('wizard-astrolabe-cross', () => new THREE.TorusGeometry(0.22, 0.026, 4, 8)),
        materials.arcane,
        { rotation: [0, Math.PI / 2, 0] }
    );
    addMesh(
        focus,
        'Wizard_AstrolabeCore',
        geometry('wizard-astrolabe-core', () => new THREE.OctahedronGeometry(0.115, 0)),
        materials.storm,
        { scale: [0.78, 1.16, 0.78] }
    );
}

function addClericArm(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const upperArm = addPivot(parent, `Rig_UpperArm${side}`, [sign * 0.65, 0.72, 0], [0.02, 0, -sign * 0.1]);
    addMesh(
        upperArm,
        `Cleric_UpperArm${side}`,
        geometry('cleric-upper-arm', () => new THREE.CylinderGeometry(0.165, 0.13, 0.74, 8)),
        materials.iron,
        { position: [0, -0.36, 0], scale: [1, 1, 0.86] }
    );

    const shoulder = addAnchor(upperArm, `Equipment_Shoulder${side}`, [0, -0.02, 0]);
    addMesh(
        shoulder,
        `Cleric_ReliquaryPauldron${side}`,
        geometry('cleric-reliquary-pauldron', () => new THREE.DodecahedronGeometry(0.42, 0)),
        side === 'Left' ? materials.bronze : materials.iron,
        {
            position: [sign * 0.04, -0.08, 0],
            rotation: [0, 0, sign * 0.18],
            scale: side === 'Left' ? [1.02, 0.5, 0.82] : [0.92, 0.44, 0.76]
        }
    );
    addMesh(
        shoulder,
        `Cleric_ShoulderSeal${side}`,
        geometry('cleric-shoulder-seal', () => new THREE.CylinderGeometry(0.11, 0.11, 0.035, 8)),
        side === 'Left' ? materials.holy : materials.spirit,
        { position: [sign * 0.08, -0.06, 0.34], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 0.5] }
    );

    const forearm = addPivot(upperArm, `Rig_Forearm${side}`, [0, -0.71, 0], [-0.04, 0, 0]);
    addMesh(
        forearm,
        `Cleric_Forearm${side}`,
        geometry('cleric-forearm', () => new THREE.CylinderGeometry(0.155, 0.12, 0.64, 8)),
        materials.skin,
        { position: [0, -0.31, 0] }
    );
    const glove = addAnchor(forearm, `Equipment_Glove${side}`, [0, -0.62, 0]);
    addMesh(
        glove,
        `Cleric_VotiveGauntlet${side}`,
        geometry('cleric-votive-gauntlet', () => new THREE.CylinderGeometry(0.165, 0.125, 0.38, 8)),
        materials.bronze,
        { position: [0, 0.12, 0] }
    );
    addMesh(
        glove,
        `Cleric_GauntletRune${side}`,
        geometry('cleric-gauntlet-rune', () => new THREE.OctahedronGeometry(0.07, 0)),
        materials.holy,
        { position: [0, 0.12, 0.15], scale: [0.7, 1.05, 0.42] }
    );

    addAnchor(glove, side === 'Left' ? 'Equipment_RingLeft' : 'Equipment_RingRight', [sign * 0.11, -0.04, 0.04]);
    return addAnchor(
        glove,
        side === 'Left' ? 'Equipment_OffHand' : 'Equipment_MainHand',
        [0, -0.05, 0],
        [0, 0, sign * 0.07]
    );
}

function addClericLeg(parent, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const thigh = addPivot(parent, `Rig_Thigh${side}`, [sign * 0.33, -0.1, 0], [0, 0, sign * 0.025]);
    const leg = addAnchor(thigh, `Equipment_Leg${side}`);
    addMesh(
        leg,
        `Cleric_Thigh${side}`,
        geometry('cleric-thigh', () => new THREE.CylinderGeometry(0.23, 0.175, 0.82, 8)),
        materials.iron,
        { position: [0, -0.41, 0] }
    );
    addMesh(
        leg,
        `Cleric_VestmentPanel${side}`,
        geometry('cleric-vestment-panel', () => {
            const shape = new THREE.Shape();
            shape.moveTo(-0.29, 0.14);
            shape.lineTo(0.29, 0.14);
            shape.lineTo(0.24, -0.62);
            shape.lineTo(0.06, -0.76);
            shape.lineTo(-0.08, -0.65);
            shape.lineTo(-0.25, -0.72);
            shape.closePath();
            return new THREE.ShapeGeometry(shape, 1);
        }),
        side === 'Left' ? materials.cloth : materials.clothDark,
        { position: [sign * 0.11, -0.11, 0.22], rotation: [0.035, Math.PI, sign * 0.04], receiveShadow: false }
    );
    addMesh(
        leg,
        `Cleric_VestmentHem${side}`,
        geometry('cleric-vestment-hem', () => new THREE.BoxGeometry(0.46, 0.08, 0.05)),
        materials.gold,
        { position: [sign * 0.11, -0.77, 0.235], rotation: [0, 0, sign * 0.06], scale: [0.82, 1, 1] }
    );
    addMesh(
        leg,
        `Cleric_ThighSunplate${side}`,
        geometry('cleric-thigh-sunplate', () => new THREE.DodecahedronGeometry(0.2, 0)),
        materials.bronze,
        { position: [0, -0.32, 0.18], scale: [0.82, 1.25, 0.34] }
    );

    const shin = addPivot(thigh, `Rig_Shin${side}`, [0, -0.81, 0], [0.03, 0, 0]);
    addMesh(
        shin,
        `Cleric_Shin${side}`,
        geometry('cleric-shin', () => new THREE.CylinderGeometry(0.18, 0.14, 0.77, 8)),
        materials.clothDark,
        { position: [0, -0.38, 0] }
    );
    const foot = addAnchor(shin, `Equipment_Foot${side}`, [0, -0.79, 0.08]);
    addMesh(
        foot,
        `Cleric_Boot${side}`,
        geometry('cleric-boot', () => new THREE.BoxGeometry(0.36, 0.23, 0.59)),
        materials.leather,
        { position: [0, 0.1, 0.13], rotation: [-0.05, 0, 0] }
    );
    addMesh(
        foot,
        `Cleric_BootReliquary${side}`,
        geometry('cleric-boot-reliquary', () => new THREE.BoxGeometry(0.22, 0.15, 0.08)),
        materials.bronze,
        { position: [0, 0.12, 0.38], rotation: [0, 0, Math.PI / 4] }
    );
}

function addClericMace(anchor, materials) {
    const mace = addPivot(anchor, 'Cleric_Oathmace', [0, -0.08, 0], [0.06, 0, -0.09]);
    addMesh(
        mace,
        'Cleric_MaceGrip',
        geometry('cleric-mace-grip', () => new THREE.CylinderGeometry(0.065, 0.075, 0.62, 8)),
        materials.leather,
        { position: [0, 0.08, 0] }
    );
    addMesh(
        mace,
        'Cleric_MacePommel',
        geometry('cleric-mace-pommel', () => new THREE.OctahedronGeometry(0.12, 0)),
        materials.gold,
        { position: [0, -0.3, 0], scale: [0.82, 1, 0.82] }
    );
    addMesh(
        mace,
        'Cleric_MaceNeck',
        geometry('cleric-mace-neck', () => new THREE.CylinderGeometry(0.055, 0.055, 0.5, 7)),
        materials.iron,
        { position: [0, 0.63, 0] }
    );
    addMesh(
        mace,
        'Cleric_MaceHead',
        geometry('cleric-mace-head', () => new THREE.DodecahedronGeometry(0.27, 0)),
        materials.bronze,
        { position: [0, 1, 0], scale: [0.9, 1.18, 0.9] }
    );
    for (let index = 0; index < 4; index++) {
        const angle = (index / 4) * Math.PI * 2;
        addMesh(
            mace,
            `Cleric_MaceRay${index}`,
            geometry('cleric-mace-ray', () => new THREE.ConeGeometry(0.065, 0.27, 4)),
            materials.gold,
            {
                position: [Math.cos(angle) * 0.27, 1, Math.sin(angle) * 0.27],
                rotation: [Math.sin(angle) * Math.PI / 2, 0, -Math.cos(angle) * Math.PI / 2]
            }
        );
    }
    addMesh(
        mace,
        'Cleric_MaceCore',
        geometry('cleric-mace-core', () => new THREE.OctahedronGeometry(0.11, 0)),
        materials.holy,
        { position: [0, 1, 0], scale: [0.8, 1.15, 0.8] }
    );
}

function addClericCenser(anchor, materials) {
    const censer = addPivot(anchor, 'Rig_Censer', [0, -0.04, 0.02], [0, 0, 0.12]);
    censer.userData.defaultEquipmentPart = true;
    addMesh(
        censer,
        'Cleric_CenserChain',
        geometry('cleric-censer-chain', () => new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6)),
        materials.gold,
        { position: [0, -0.4, 0] }
    );
    addMesh(
        censer,
        'Cleric_CenserBowl',
        geometry('cleric-censer-bowl', () => new THREE.DodecahedronGeometry(0.22, 0)),
        materials.bronze,
        { position: [0, -0.83, 0], scale: [1, 0.82, 1] }
    );
    addMesh(
        censer,
        'Cleric_CenserCap',
        geometry('cleric-censer-cap', () => new THREE.ConeGeometry(0.18, 0.25, 8)),
        materials.iron,
        { position: [0, -0.62, 0] }
    );
    addMesh(
        censer,
        'Cleric_CenserFlame',
        geometry('cleric-censer-flame', () => new THREE.OctahedronGeometry(0.1, 0)),
        materials.spirit,
        { position: [0, -0.82, 0.16], scale: [0.7, 1.3, 0.5] }
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

function createRogueAnimationClips() {
    const idleTimes = [0, 0.7, 1.4, 2.1];
    const idle = [
        numberTrack('Rig_Hips', 'position[y]', idleTimes, [1.7, 1.66, 1.7, 1.7]),
        numberTrack('Rig_Hips', 'rotation[y]', idleTimes, [-0.08, 0.04, 0.1, -0.08]),
        numberTrack('Rig_Chest', 'rotation[x]', idleTimes, [-0.1, -0.15, -0.1, -0.1]),
        numberTrack('Rig_Head', 'rotation[y]', idleTimes, [-0.18, 0.08, 0.22, -0.18]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', idleTimes, [0.2, 0.3, 0.18, 0.2]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', idleTimes, [-0.05, -0.16, -0.05, -0.05]),
        numberTrack('Rig_Cloak', 'rotation[x]', idleTimes, [0.12, 0.18, 0.11, 0.12])
    ];

    const walkTimes = [0, 0.24, 0.48, 0.72, 0.96];
    const walk = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', walkTimes, [-0.62, 0, 0.62, 0, -0.62]),
        numberTrack('Rig_ThighRight', 'rotation[x]', walkTimes, [0.62, 0, -0.62, 0, 0.62]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', walkTimes, [0.48, 0.04, 0.02, 0.44, 0.48]),
        numberTrack('Rig_ShinRight', 'rotation[x]', walkTimes, [0.02, 0.44, 0.48, 0.04, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', walkTimes, [0.46, 0.12, -0.28, 0.08, 0.46]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', walkTimes, [-0.28, 0.08, 0.46, 0.12, -0.28]),
        numberTrack('Rig_Hips', 'position[y]', walkTimes, [1.66, 1.74, 1.66, 1.74, 1.66]),
        numberTrack('Rig_Chest', 'rotation[x]', walkTimes, [-0.12, -0.08, -0.12, -0.08, -0.12]),
        numberTrack('Rig_Cloak', 'rotation[x]', walkTimes, [0.18, 0.28, 0.18, 0.28, 0.18])
    ];

    const runTimes = [0, 0.14, 0.28, 0.42, 0.56];
    const run = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', runTimes, [-0.98, 0, 0.98, 0, -0.98]),
        numberTrack('Rig_ThighRight', 'rotation[x]', runTimes, [0.98, 0, -0.98, 0, 0.98]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', runTimes, [0.82, 0.08, 0.03, 0.72, 0.82]),
        numberTrack('Rig_ShinRight', 'rotation[x]', runTimes, [0.03, 0.72, 0.82, 0.08, 0.03]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', runTimes, [0.78, 0.08, -0.66, 0.08, 0.78]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', runTimes, [-0.66, 0.08, 0.78, 0.08, -0.66]),
        numberTrack('Rig_Hips', 'position[y]', runTimes, [1.62, 1.76, 1.62, 1.76, 1.62]),
        numberTrack('Rig_Chest', 'rotation[x]', runTimes, [-0.28, -0.34, -0.28, -0.34, -0.28]),
        numberTrack('Rig_Cloak', 'rotation[x]', runTimes, [0.38, 0.62, 0.38, 0.62, 0.38])
    ];

    const attackTimes = [0, 0.12, 0.26, 0.4, 0.56, 0.72];
    const attack = [
        numberTrack('Rig_Hips', 'rotation[y]', attackTimes, [0, -0.42, 0.56, 0.28, -0.5, 0]),
        numberTrack('Rig_Chest', 'rotation[y]', attackTimes, [0, -0.62, 0.76, 0.36, -0.68, 0]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', attackTimes, [-0.05, -1.6, 0.9, 0.38, -0.18, -0.05]),
        numberTrack('Rig_UpperArmRight', 'rotation[z]', attackTimes, [0.13, 0.62, -0.38, -0.2, 0.16, 0.13]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', attackTimes, [0.2, 0.42, -0.18, -1.5, 0.96, 0.2]),
        numberTrack('Rig_UpperArmLeft', 'rotation[z]', attackTimes, [-0.13, -0.2, 0.2, -0.58, 0.34, -0.13]),
        numberTrack('Rig_Head', 'rotation[y]', attackTimes, [0, -0.22, 0.3, 0.16, -0.28, 0]),
        numberTrack('Rig_Cloak', 'rotation[x]', attackTimes, [0.12, 0.34, -0.08, 0.42, 0.18, 0.12])
    ];

    const deathTimes = [0, 0.2, 0.46, 0.8, 1.08];
    const death = [
        numberTrack('Rig_Hips', 'position[y]', deathTimes, [1.7, 1.56, 1.08, 0.48, 0.14]),
        numberTrack('Rig_Hips', 'rotation[x]', deathTimes, [0, -0.12, -0.38, -0.7, -1.12]),
        numberTrack('Rig_Chest', 'rotation[x]', deathTimes, [-0.1, 0.12, 0.48, 0.82, 1.22]),
        numberTrack('Rig_Chest', 'rotation[z]', deathTimes, [0, 0.08, -0.18, -0.3, -0.36]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', deathTimes, [0.2, -0.5, 0.34, 0.9, 1.18]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', deathTimes, [-0.05, 0.48, -0.4, -0.84, -1.04]),
        numberTrack('Rig_Head', 'rotation[x]', deathTimes, [0, 0.18, 0.42, 0.72, 0.92])
    ];

    return [
        new THREE.AnimationClip('Idle', 2.1, idle),
        new THREE.AnimationClip('Walk', 0.96, walk),
        new THREE.AnimationClip('Run', 0.56, run),
        new THREE.AnimationClip('Attack', 0.72, attack),
        new THREE.AnimationClip('Death', 1.08, death)
    ];
}

function createWizardAnimationClips() {
    const idleTimes = [0, 1, 2, 3];
    const idle = [
        numberTrack('Rig_Hips', 'position[y]', idleTimes, [1.75, 1.78, 1.75, 1.75]),
        numberTrack('Rig_Chest', 'rotation[y]', idleTimes, [-0.05, 0.06, 0.1, -0.05]),
        numberTrack('Rig_Head', 'rotation[x]', idleTimes, [-0.03, -0.1, -0.03, -0.03]),
        numberTrack('Rig_Head', 'rotation[y]', idleTimes, [-0.1, 0.06, 0.14, -0.1]),
        numberTrack('Rig_UpperArmLeft', 'rotation[z]', idleTimes, [-0.18, -0.25, -0.18, -0.18]),
        numberTrack('Rig_UpperArmRight', 'rotation[z]', idleTimes, [0.16, 0.2, 0.16, 0.16]),
        numberTrack('Rig_Cloak', 'rotation[x]', idleTimes, [0.06, 0.13, 0.06, 0.06]),
        numberTrack('Rig_Focus', 'position[y]', idleTimes, [0.5, 0.63, 0.5, 0.5]),
        numberTrack('Rig_Focus', 'rotation[y]', idleTimes, [0, 2.1, 4.2, Math.PI * 2])
    ];

    const walkTimes = [0, 0.28, 0.56, 0.84, 1.12];
    const walk = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', walkTimes, [-0.46, 0, 0.46, 0, -0.46]),
        numberTrack('Rig_ThighRight', 'rotation[x]', walkTimes, [0.46, 0, -0.46, 0, 0.46]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', walkTimes, [0.34, 0.04, 0.02, 0.3, 0.34]),
        numberTrack('Rig_ShinRight', 'rotation[x]', walkTimes, [0.02, 0.3, 0.34, 0.04, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', walkTimes, [0.3, 0.08, -0.22, 0.08, 0.3]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', walkTimes, [-0.12, -0.04, 0.12, -0.04, -0.12]),
        numberTrack('Rig_Hips', 'position[y]', walkTimes, [1.75, 1.82, 1.75, 1.82, 1.75]),
        numberTrack('Rig_Chest', 'rotation[y]', walkTimes, [-0.06, 0, 0.06, 0, -0.06]),
        numberTrack('Rig_Cloak', 'rotation[x]', walkTimes, [0.14, 0.25, 0.14, 0.25, 0.14]),
        numberTrack('Rig_Focus', 'rotation[y]', walkTimes, [0, 1.6, 3.2, 4.8, Math.PI * 2])
    ];

    const runTimes = [0, 0.17, 0.34, 0.51, 0.68];
    const run = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', runTimes, [-0.76, 0, 0.76, 0, -0.76]),
        numberTrack('Rig_ThighRight', 'rotation[x]', runTimes, [0.76, 0, -0.76, 0, 0.76]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', runTimes, [0.62, 0.06, 0.02, 0.56, 0.62]),
        numberTrack('Rig_ShinRight', 'rotation[x]', runTimes, [0.02, 0.56, 0.62, 0.06, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', runTimes, [0.55, 0.04, -0.48, 0.04, 0.55]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', runTimes, [-0.28, -0.04, 0.28, -0.04, -0.28]),
        numberTrack('Rig_Hips', 'position[y]', runTimes, [1.7, 1.84, 1.7, 1.84, 1.7]),
        numberTrack('Rig_Chest', 'rotation[x]', runTimes, [-0.18, -0.23, -0.18, -0.23, -0.18]),
        numberTrack('Rig_Cloak', 'rotation[x]', runTimes, [0.34, 0.58, 0.34, 0.58, 0.34]),
        numberTrack('Rig_Focus', 'position[y]', runTimes, [0.52, 0.68, 0.52, 0.68, 0.52])
    ];

    const attackTimes = [0, 0.18, 0.4, 0.62, 0.86, 1.08];
    const attack = [
        numberTrack('Rig_Hips', 'rotation[y]', attackTimes, [0, -0.12, 0.08, 0.18, -0.08, 0]),
        numberTrack('Rig_Chest', 'rotation[x]', attackTimes, [0, 0.1, -0.18, -0.28, -0.08, 0]),
        numberTrack('Rig_Chest', 'rotation[y]', attackTimes, [0, -0.24, 0.18, 0.32, -0.12, 0]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', attackTimes, [0, -0.5, -1.28, -1.52, -0.42, 0]),
        numberTrack('Rig_UpperArmLeft', 'rotation[z]', attackTimes, [-0.16, -0.55, -0.76, -0.42, -0.24, -0.16]),
        numberTrack('Rig_ForearmLeft', 'rotation[x]', attackTimes, [0.08, -0.38, -0.78, -0.24, 0.04, 0.08]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', attackTimes, [0, -0.72, -1.16, -1.34, -0.36, 0]),
        numberTrack('Rig_UpperArmRight', 'rotation[z]', attackTimes, [0.16, 0.48, 0.68, 0.38, 0.22, 0.16]),
        numberTrack('Rig_ForearmRight', 'rotation[x]', attackTimes, [0.08, -0.24, -0.58, -0.12, 0.04, 0.08]),
        numberTrack('Rig_Head', 'rotation[x]', attackTimes, [0, 0.08, -0.16, -0.24, -0.06, 0]),
        numberTrack('Rig_Cloak', 'rotation[x]', attackTimes, [0.06, 0.2, 0.42, 0.54, 0.22, 0.06]),
        numberTrack('Rig_Focus', 'position[y]', attackTimes, [0.5, 0.72, 0.96, 1.16, 0.72, 0.5]),
        numberTrack('Rig_Focus', 'rotation[y]', attackTimes, [0, 0.9, 2.8, 5.2, 7.1, Math.PI * 2])
    ];

    const deathTimes = [0, 0.24, 0.54, 0.9, 1.28];
    const death = [
        numberTrack('RigRoot', 'rotation[z]', deathTimes, [0, 0.06, 0.34, 0.92, 1.42]),
        numberTrack('RigRoot', 'position[y]', deathTimes, [0, 0, -0.12, -0.46, -0.72]),
        numberTrack('RigRoot', 'position[x]', deathTimes, [0, -0.03, -0.18, -0.48, -0.72]),
        numberTrack('Rig_Chest', 'rotation[x]', deathTimes, [0, 0.12, 0.48, 0.82, 1.08]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', deathTimes, [0, -0.42, 0.3, 0.76, 1.02]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', deathTimes, [0, 0.36, -0.24, -0.62, -0.9]),
        numberTrack('Rig_Head', 'rotation[x]', deathTimes, [0, 0.16, 0.38, 0.68, 0.88]),
        numberTrack('Rig_Focus', 'position[y]', deathTimes, [0.5, 0.34, 0.02, -0.44, -0.82]),
        numberTrack('Rig_Focus', 'rotation[z]', deathTimes, [0, 0.4, 1.4, 2.6, 3.6])
    ];

    return [
        new THREE.AnimationClip('Idle', 3, idle),
        new THREE.AnimationClip('Walk', 1.12, walk),
        new THREE.AnimationClip('Run', 0.68, run),
        new THREE.AnimationClip('Attack', 1.08, attack),
        new THREE.AnimationClip('Death', 1.28, death)
    ];
}

function createClericAnimationClips() {
    const idleTimes = [0, 0.9, 1.8, 2.7];
    const idle = [
        numberTrack('Rig_Hips', 'position[y]', idleTimes, [1.74, 1.77, 1.74, 1.74]),
        numberTrack('Rig_Chest', 'rotation[x]', idleTimes, [0.01, 0.06, 0.01, 0.01]),
        numberTrack('Rig_Head', 'rotation[x]', idleTimes, [0.02, 0.1, 0.02, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', idleTimes, [-0.12, -0.22, -0.12, -0.12]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', idleTimes, [0.06, 0.13, 0.06, 0.06]),
        numberTrack('Rig_Cloak', 'rotation[x]', idleTimes, [0.05, 0.11, 0.05, 0.05]),
        numberTrack('Rig_Censer', 'rotation[z]', idleTimes, [0.12, -0.08, 0.22, 0.12])
    ];

    const walkTimes = [0, 0.27, 0.54, 0.81, 1.08];
    const walk = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', walkTimes, [-0.5, 0, 0.5, 0, -0.5]),
        numberTrack('Rig_ThighRight', 'rotation[x]', walkTimes, [0.5, 0, -0.5, 0, 0.5]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', walkTimes, [0.38, 0.04, 0.02, 0.34, 0.38]),
        numberTrack('Rig_ShinRight', 'rotation[x]', walkTimes, [0.02, 0.34, 0.38, 0.04, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', walkTimes, [0.26, 0.04, -0.24, 0.04, 0.26]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', walkTimes, [-0.3, 0.02, 0.3, 0.02, -0.3]),
        numberTrack('Rig_Hips', 'position[y]', walkTimes, [1.74, 1.81, 1.74, 1.81, 1.74]),
        numberTrack('Rig_Chest', 'rotation[y]', walkTimes, [-0.04, 0, 0.04, 0, -0.04]),
        numberTrack('Rig_Cloak', 'rotation[x]', walkTimes, [0.12, 0.23, 0.12, 0.23, 0.12]),
        numberTrack('Rig_Censer', 'rotation[z]', walkTimes, [0.38, 0, -0.38, 0, 0.38])
    ];

    const runTimes = [0, 0.16, 0.32, 0.48, 0.64];
    const run = [
        numberTrack('Rig_ThighLeft', 'rotation[x]', runTimes, [-0.78, 0, 0.78, 0, -0.78]),
        numberTrack('Rig_ThighRight', 'rotation[x]', runTimes, [0.78, 0, -0.78, 0, 0.78]),
        numberTrack('Rig_ShinLeft', 'rotation[x]', runTimes, [0.64, 0.07, 0.02, 0.58, 0.64]),
        numberTrack('Rig_ShinRight', 'rotation[x]', runTimes, [0.02, 0.58, 0.64, 0.07, 0.02]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', runTimes, [0.54, 0.02, -0.52, 0.02, 0.54]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', runTimes, [-0.56, 0.02, 0.56, 0.02, -0.56]),
        numberTrack('Rig_Hips', 'position[y]', runTimes, [1.69, 1.84, 1.69, 1.84, 1.69]),
        numberTrack('Rig_Chest', 'rotation[x]', runTimes, [-0.16, -0.22, -0.16, -0.22, -0.16]),
        numberTrack('Rig_Cloak', 'rotation[x]', runTimes, [0.32, 0.54, 0.32, 0.54, 0.32]),
        numberTrack('Rig_Censer', 'rotation[z]', runTimes, [0.58, 0, -0.58, 0, 0.58])
    ];

    const attackTimes = [0, 0.18, 0.38, 0.58, 0.78, 0.98];
    const attack = [
        numberTrack('Rig_Hips', 'rotation[y]', attackTimes, [0, -0.28, -0.18, 0.4, 0.22, 0]),
        numberTrack('Rig_Chest', 'rotation[y]', attackTimes, [0, -0.46, -0.3, 0.62, 0.34, 0]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', attackTimes, [0.06, -1.4, -1.72, 0.86, 0.42, 0.06]),
        numberTrack('Rig_UpperArmRight', 'rotation[z]', attackTimes, [0.11, 0.52, 0.62, -0.28, -0.08, 0.11]),
        numberTrack('Rig_ForearmRight', 'rotation[x]', attackTimes, [-0.04, -0.62, -0.82, -0.12, -0.02, -0.04]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', attackTimes, [-0.12, -0.76, -1.12, -0.52, -0.24, -0.12]),
        numberTrack('Rig_UpperArmLeft', 'rotation[z]', attackTimes, [-0.11, -0.38, -0.58, -0.3, -0.16, -0.11]),
        numberTrack('Rig_Head', 'rotation[x]', attackTimes, [0.02, -0.1, -0.18, -0.06, 0, 0.02]),
        numberTrack('Rig_Cloak', 'rotation[x]', attackTimes, [0.05, 0.24, 0.42, -0.08, 0.12, 0.05]),
        numberTrack('Rig_Censer', 'rotation[z]', attackTimes, [0.12, -0.5, -0.82, 0.74, 0.38, 0.12])
    ];

    const deathTimes = [0, 0.22, 0.5, 0.84, 1.2, 1.46];
    const death = [
        numberTrack('Rig_Hips', 'position[y]', deathTimes, [1.74, 1.58, 1.1, 0.48, 0.18, 0.08]),
        numberTrack('Rig_Hips', 'rotation[x]', deathTimes, [0, -0.08, -0.28, -0.56, -0.88, -1.02]),
        numberTrack('Rig_Chest', 'rotation[x]', deathTimes, [0.01, 0.14, 0.4, 0.7, 1.02, 1.16]),
        numberTrack('Rig_Chest', 'rotation[z]', deathTimes, [0, -0.04, 0.12, 0.24, 0.34, 0.4]),
        numberTrack('Rig_UpperArmLeft', 'rotation[x]', deathTimes, [-0.12, -0.5, 0.18, 0.68, 0.96, 1.1]),
        numberTrack('Rig_UpperArmRight', 'rotation[x]', deathTimes, [0.06, 0.42, -0.18, -0.58, -0.82, -0.96]),
        numberTrack('Rig_Head', 'rotation[x]', deathTimes, [0.02, 0.18, 0.4, 0.66, 0.84, 0.94]),
        numberTrack('Rig_Censer', 'rotation[z]', deathTimes, [0.12, 0.46, 0.92, 1.5, 2.2, 2.7])
    ];

    return [
        new THREE.AnimationClip('Idle', 2.7, idle),
        new THREE.AnimationClip('Walk', 1.08, walk),
        new THREE.AnimationClip('Run', 0.64, run),
        new THREE.AnimationClip('Attack', 0.98, attack),
        new THREE.AnimationClip('Death', 1.46, death)
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
        cloth: material('fighter-cloth', FIGHTER_PALETTE.cloth, { roughness: 0.96, side: THREE.DoubleSide }),
        clothDark: material('fighter-cloth-dark', FIGHTER_PALETTE.clothDark, { roughness: 0.98, side: THREE.DoubleSide }),
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
        geometry('breastplate', () => createTailoredTorsoGeometry(0.52, 0.62, 1.12)),
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
    addMesh(neckAnchor, 'Fighter_Neck', geometry('humanoid-neck', () => new THREE.CylinderGeometry(0.145, 0.17, 0.34, 8)), materials.skin, {
        position: [0, 0.1, -0.04], scale: [1, 1, 0.9]
    }).userData.equipmentBodyBase = true;
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
        geometry('eye-glow', () => createPairedEyesGeometry(0.105, 0.045, 0.25)),
        material('fighter-eyes', 0xd4ad62, { emissive: 0xa07838, emissiveIntensity: 0.25 }),
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
    root.userData.equipmentLengthBySlot = Object.freeze({ chest: 1, legs: 0.96 });
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

/**
 * Creates Gloamreach's code-native shadeblade: a narrow, forward-weighted
 * silhouette with asymmetrical leathers, split cloak, venom glass, and a
 * dedicated dual-strike motion set on the shared humanoid attachment contract.
 */
export function createProceduralRogue() {
    const materials = {
        leather: material('rogue-leather', ROGUE_PALETTE.leather, { roughness: 0.88 }),
        leatherLight: material('rogue-leather-light', ROGUE_PALETTE.leatherLight, { roughness: 0.76 }),
        cloth: material('rogue-cloth', ROGUE_PALETTE.cloth, { roughness: 0.96, side: THREE.DoubleSide }),
        clothDark: material('rogue-cloth-dark', ROGUE_PALETTE.clothDark, { roughness: 0.98, side: THREE.DoubleSide }),
        steel: material('rogue-steel', ROGUE_PALETTE.steel, { metalness: 0.76, roughness: 0.34 }),
        silver: material('rogue-silver', ROGUE_PALETTE.silver, { metalness: 0.9, roughness: 0.22 }),
        poison: material('rogue-poison', ROGUE_PALETTE.poison, {
            emissive: ROGUE_PALETTE.poison,
            emissiveIntensity: 1.15,
            roughness: 0.24
        }),
        skin: material('rogue-skin', ROGUE_PALETTE.skin, { roughness: 0.9 }),
        hair: material('rogue-hair', ROGUE_PALETTE.hair, { roughness: 0.94 }),
        hairLight: material('rogue-hair-light', ROGUE_PALETTE.hairLight, { roughness: 0.88 }),
        lips: material('rogue-lips', ROGUE_PALETTE.lips, { roughness: 0.76 }),
        glow: material('rogue-glow', ROGUE_PALETTE.glow, {
            emissive: ROGUE_PALETTE.glow,
            emissiveIntensity: 1.5,
            roughness: 0.2
        })
    };

    const root = new THREE.Group();
    root.name = 'ProceduralRogue';
    const rigRoot = addPivot(root, 'RigRoot');
    const hips = addPivot(rigRoot, 'Rig_Hips', [0, 1.7, 0], [-0.04, 0, 0]);

    addMesh(
        hips,
        'Rogue_HipWrap',
        geometry('rogue-hip-wrap', () => new THREE.CylinderGeometry(0.4, 0.5, 0.45, 7)),
        materials.cloth,
        { position: [0, 0.08, 0], scale: [1, 1, 0.78] }
    );
    addMesh(
        hips,
        'Rogue_Loincloth',
        geometry('rogue-loincloth', () => {
            const shape = new THREE.Shape();
            shape.moveTo(-0.24, 0.12);
            shape.lineTo(0.24, 0.12);
            shape.lineTo(0.15, -0.68);
            shape.lineTo(0, -0.54);
            shape.lineTo(-0.16, -0.7);
            shape.closePath();
            return new THREE.ShapeGeometry(shape, 1);
        }),
        materials.leather,
        { position: [0, -0.3, 0.34], rotation: [0.04, 0, 0] }
    );

    const belt = addAnchor(hips, 'Equipment_Belt', [0, 0.2, 0]);
    addMesh(
        belt,
        'Rogue_Belt',
        geometry('rogue-belt', () => new THREE.CylinderGeometry(0.405, 0.405, 0.14, 7)),
        materials.leatherLight,
        { scale: [1, 1, 0.8] }
    );
    addMesh(
        belt,
        'Rogue_BeltClasp',
        geometry('rogue-belt-clasp', () => new THREE.OctahedronGeometry(0.12, 0)),
        materials.poison,
        { position: [0.1, 0, 0.38], scale: [0.8, 1.1, 0.42] }
    );
    addAnchor(belt, 'Equipment_TrinketLeft', [0.31, -0.16, 0.23]);
    addAnchor(belt, 'Equipment_TrinketRight', [-0.31, -0.16, 0.23]);

    addRogueLeg(hips, 'Left', materials);
    addRogueLeg(hips, 'Right', materials);

    const chest = addPivot(hips, 'Rig_Chest', [0, 0.38, 0], [-0.1, 0, 0]);
    const chestAnchor = addAnchor(chest, 'Equipment_Chest');
    addMesh(
        chestAnchor,
        'Rogue_Jerkin',
        geometry('rogue-jerkin', () => createTailoredTorsoGeometry(0.355, 0.48, 1.04)),
        materials.leather,
        { position: [0, 0.45, 0], scale: [1.04, 1, 0.72] }
    );
    addMesh(
        chestAnchor,
        'Rogue_CuirassContour',
        geometry('rogue-cuirass-contour', () => new THREE.DodecahedronGeometry(0.5, 0)),
        materials.leatherLight,
        { position: [0, 0.63, 0.34], scale: [0.82, 0.45, 0.26] }
    );
    addMesh(
        chestAnchor,
        'Rogue_JerkinPanel',
        geometry('rogue-jerkin-panel', () => new THREE.BoxGeometry(0.34, 0.82, 0.055)),
        materials.leatherLight,
        { position: [0.1, 0.45, 0.39], rotation: [0, 0, -0.11] }
    );
    for (let index = 0; index < 4; index++) {
        addMesh(
            chestAnchor,
            `Rogue_JerkinClasp${index}`,
            geometry('rogue-jerkin-clasp', () => new THREE.OctahedronGeometry(0.045, 0)),
            materials.steel,
            { position: [-0.08, 0.72 - index * 0.18, 0.43], scale: [0.7, 1, 0.45] }
        );
    }
    addMesh(
        chestAnchor,
        'Rogue_VenomVial',
        geometry('rogue-venom-vial', () => new THREE.OctahedronGeometry(0.09, 1)),
        materials.glow,
        { position: [-0.35, 0.35, 0.28], scale: [0.6, 1.25, 0.6], rotation: [0, 0, 0.28] }
    );

    const cloak = addPivot(chest, 'Rig_Cloak', [0, 0.76, -0.34], [0.12, 0, 0]);
    [-1, 1].forEach((side) => {
        addMesh(
            cloak,
            side < 0 ? 'Rogue_CloakLeft' : 'Rogue_CloakRight',
            geometry('rogue-split-cloak', () => {
                const shape = new THREE.Shape();
                shape.moveTo(-0.3, 0.1);
                shape.lineTo(0.3, 0.1);
                shape.lineTo(0.2, -1.36);
                shape.lineTo(0, -1.18);
                shape.lineTo(-0.18, -1.44);
                shape.closePath();
                return new THREE.ShapeGeometry(shape, 1);
            }),
            side < 0 ? materials.clothDark : materials.cloth,
            {
                position: [side * 0.22, -0.05, 0],
                rotation: [0.08, Math.PI, side * 0.05],
                scale: [0.94, side < 0 ? 1 : 0.9, 1],
                receiveShadow: false
            }
        );
    });

    const neck = addAnchor(chest, 'Equipment_Neck', [0, 1, 0]);
    addMesh(neck, 'Rogue_Neck', geometry('humanoid-neck', () => new THREE.CylinderGeometry(0.145, 0.17, 0.34, 8)), materials.skin, {
        position: [0, 0.1, 0], scale: [0.85, 1, 0.85]
    }).userData.equipmentBodyBase = true;
    addMesh(
        neck,
        'Rogue_Scarf',
        geometry('rogue-scarf', () => new THREE.TorusGeometry(0.29, 0.08, 5, 8)),
        materials.clothDark,
        { rotation: [Math.PI / 2, 0, 0], scale: [1, 0.82, 1] }
    );

    const head = addPivot(chest, 'Rig_Head', [0, 1.27, 0], [0.02, 0, 0]);
    const headAnchor = addAnchor(head, 'Equipment_Head');
    const face = addMesh(
        headAnchor,
        'Rogue_Head',
        geometry('rogue-head', () => new THREE.DodecahedronGeometry(0.285, 1)),
        materials.skin,
        { position: [0, 0.1, 0], scale: [0.76, 1.08, 0.8] }
    );
    face.userData.equipmentBodyBase = true;
    addMesh(
        headAnchor,
        'Rogue_HairCap',
        geometry('rogue-hair-cap', () => new THREE.SphereGeometry(0.3, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.61)),
        materials.hair,
        { position: [0, 0.18, -0.015], scale: [0.83, 1, 0.83] }
    );
    [-1, 1].forEach((side) => {
        addMesh(
            headAnchor,
            side < 0 ? 'Rogue_HairLockLeft' : 'Rogue_HairLockRight',
            geometry('rogue-hair-lock', () => new THREE.ConeGeometry(0.075, 0.42, 5)),
            side < 0 ? materials.hairLight : materials.hair,
            {
                position: [side * 0.205, -0.005, 0.02],
                rotation: [0.1, 0, side * 0.1],
                scale: [0.82, side < 0 ? 1.08 : 0.9, 0.72]
            }
        );
    });
    addMesh(
        headAnchor,
        'Rogue_Hood',
        geometry('rogue-hood', () => new THREE.ConeGeometry(0.43, 0.76, 7, 1, true)),
        materials.cloth,
        { position: [0, 0.29, -0.09], rotation: [0, 0, Math.PI], scale: [1, 1, 0.82] }
    );
    addMesh(
        headAnchor,
        'Rogue_HoodTail',
        geometry('rogue-hood-tail', () => new THREE.ConeGeometry(0.15, 0.58, 5)),
        materials.clothDark,
        { position: [0, 0.36, -0.34], rotation: [1.05, 0, Math.PI] }
    );
    addMesh(
        headAnchor,
        'Rogue_MaskScarf',
        geometry('rogue-mask-scarf', () => new THREE.CylinderGeometry(0.245, 0.26, 0.11, 7, 1, false, 0, Math.PI)),
        materials.leatherLight,
        { position: [0, -0.14, 0.045], rotation: [0, Math.PI / 2, Math.PI / 2], scale: [0.88, 1, 0.76] }
    );
    const eyes = addMesh(
        headAnchor,
        'Rogue_EyeGlow',
        geometry('rogue-eye', () => new THREE.OctahedronGeometry(0.065, 0)),
        material('rogue-eyes', 0x91b49b, { emissive: 0x54765d, emissiveIntensity: 0.18 }),
        { position: [0.095, 0.17, 0.235], scale: [1, 0.34, 0.28], rotation: [0, 0, -0.08] }
    );
    eyes.userData.equipmentBodyBase = true;
    const rightEye = addMesh(
        headAnchor,
        'Rogue_EyeGlowRight',
        geometry('rogue-eye', () => new THREE.OctahedronGeometry(0.065, 0)),
        material('rogue-eyes', 0x91b49b, { emissive: 0x54765d, emissiveIntensity: 0.18 }),
        { position: [-0.095, 0.17, 0.235], scale: [1, 0.34, 0.28], rotation: [0, 0, 0.08] }
    );
    rightEye.userData.equipmentBodyBase = true;
    [-1, 1].forEach((side) => {
        addMesh(
            headAnchor,
            side < 0 ? 'Rogue_BrowLeft' : 'Rogue_BrowRight',
            geometry('rogue-brow', () => new THREE.BoxGeometry(0.105, 0.018, 0.018)),
            materials.hair,
            { position: [side * 0.095, 0.225, 0.235], rotation: [0, 0, -side * 0.09] }
        );
    });
    addMesh(
        headAnchor,
        'Rogue_Nose',
        geometry('rogue-nose', () => new THREE.TetrahedronGeometry(0.065, 0)),
        materials.skin,
        { position: [0, 0.105, 0.255], rotation: [0.16, Math.PI / 4, 0], scale: [0.52, 1, 0.55] }
    );
    addMesh(
        headAnchor,
        'Rogue_Lips',
        geometry('rogue-lips', () => new THREE.BoxGeometry(0.105, 0.022, 0.018)),
        materials.lips,
        { position: [0, 0.01, 0.238], rotation: [0, 0, -0.025] }
    );
    const braid = addPivot(headAnchor, 'Rogue_Braid', [0.22, 0.02, -0.21], [0.18, 0, -0.16]);
    for (let index = 0; index < 4; index++) {
        addMesh(
            braid,
            `Rogue_BraidKnot${index}`,
            geometry('rogue-braid-knot', () => new THREE.OctahedronGeometry(0.095, 0)),
            index % 2 === 0 ? materials.hairLight : materials.hair,
            { position: [index * 0.035, -index * 0.15, 0], scale: [0.8 - index * 0.08, 1, 0.68] }
        );
    }
    addMesh(
        braid,
        'Rogue_BraidTie',
        geometry('rogue-braid-tie', () => new THREE.OctahedronGeometry(0.06, 0)),
        materials.poison,
        { position: [0.13, -0.58, 0], scale: [0.7, 1.1, 0.65] }
    );

    const offHand = addRogueArm(chest, 'Left', materials);
    const mainHand = addRogueArm(chest, 'Right', materials);
    addRogueDagger(offHand, materials, 'Left', 'Rogue_OffhandFang');
    addRogueDagger(mainHand, materials, 'Right', 'Rogue_MainhandFang');

    assertEquipmentAnchors(root);
    root.userData.proceduralHumanoid = true;
    root.userData.proceduralClass = 'Rogue';
    root.userData.equipmentLengthBySlot = Object.freeze({ chest: 0.95, legs: 0.92 });
    root.userData.artStyle = 'Gloamreach shadeblade';
    root.userData.genderPresentation = 'female';
    root.userData.sharedGeometry = true;
    root.userData.equipmentAnchors = Object.fromEntries(
        Object.entries(HUMANOID_EQUIPMENT_ANCHORS).map(([slot, names]) => [slot, [...names]])
    );
    root.userData.equipmentScaleBySlot = Object.freeze({
        head: 0.88,
        shoulders: 0.78,
        chest: 0.85,
        gloves: 0.84,
        belt: 0.86,
        legs: 0.84,
        feet: 0.82,
        neck: 0.9,
        ring1: 0.86,
        ring2: 0.86,
        trinket1: 0.88,
        trinket2: 0.88,
        mainHand: 0.92,
        offHand: 0.88
    });
    root.userData.animations = createRogueAnimationClips();
    root.userData.bounds = Object.freeze({ radius: 1.05, height: 4.25, origin: 'feet' });
    installRestPoseReset(root);
    return root;
}

/**
 * Creates Stormcrown's code-native hexweaver: a tall, rear-weighted caster
 * framed by split robes, an asymmetric rune mantle, a stormstaff, and a
 * hovering astrolabe on the shared humanoid attachment contract.
 */
export function createProceduralWizard() {
    const materials = {
        cloth: material('wizard-cloth', WIZARD_PALETTE.cloth, { roughness: 0.96, side: THREE.DoubleSide }),
        clothDark: material('wizard-cloth-dark', WIZARD_PALETTE.clothDark, { roughness: 0.99, side: THREE.DoubleSide }),
        clothLight: material('wizard-cloth-light', WIZARD_PALETTE.clothLight, { roughness: 0.9, side: THREE.DoubleSide }),
        slate: material('wizard-slate', WIZARD_PALETTE.slate, { metalness: 0.28, roughness: 0.66 }),
        silver: material('wizard-silver', WIZARD_PALETTE.silver, { metalness: 0.86, roughness: 0.28 }),
        leather: material('wizard-leather', WIZARD_PALETTE.leather, { roughness: 0.9 }),
        skin: material('wizard-skin', WIZARD_PALETTE.skin, { roughness: 0.9 }),
        arcane: material('wizard-arcane', WIZARD_PALETTE.arcane, {
            emissive: WIZARD_PALETTE.arcane,
            emissiveIntensity: 1.35,
            roughness: 0.22
        }),
        storm: material('wizard-storm', WIZARD_PALETTE.storm, {
            emissive: WIZARD_PALETTE.storm,
            emissiveIntensity: 1.5,
            roughness: 0.18
        })
    };

    const root = new THREE.Group();
    root.name = 'ProceduralWizard';
    const rigRoot = addPivot(root, 'RigRoot');
    const hips = addPivot(rigRoot, 'Rig_Hips', [0, 1.75, 0], [0.02, 0, 0]);

    addMesh(
        hips,
        'Wizard_HipRobe',
        geometry('wizard-hip-robe', () => new THREE.CylinderGeometry(0.48, 0.56, 0.54, 7)),
        materials.cloth,
        { position: [0, 0.06, 0], scale: [1, 1, 0.82] }
    );
    addMesh(
        hips,
        'Wizard_RobeGlyph',
        geometry('wizard-robe-glyph', () => new THREE.TorusGeometry(0.12, 0.025, 4, 6)),
        materials.arcane,
        { position: [0.08, -0.18, 0.45], rotation: [Math.PI / 2, 0, 0], scale: [0.72, 1.2, 1] }
    );

    const belt = addAnchor(hips, 'Equipment_Belt', [0, 0.22, 0]);
    addMesh(
        belt,
        'Wizard_CordBelt',
        geometry('wizard-cord-belt', () => new THREE.TorusGeometry(0.46, 0.055, 5, 9)),
        materials.silver,
        { rotation: [Math.PI / 2, 0, 0], scale: [1, 0.82, 1] }
    );
    addMesh(
        belt,
        'Wizard_BeltSeal',
        geometry('wizard-belt-seal', () => new THREE.OctahedronGeometry(0.13, 0)),
        materials.storm,
        { position: [-0.12, -0.08, 0.4], scale: [0.82, 1.2, 0.48] }
    );
    addAnchor(belt, 'Equipment_TrinketLeft', [0.33, -0.18, 0.25]);
    addAnchor(belt, 'Equipment_TrinketRight', [-0.33, -0.18, 0.25]);

    addWizardLeg(hips, 'Left', materials);
    addWizardLeg(hips, 'Right', materials);

    const chest = addPivot(hips, 'Rig_Chest', [0, 0.4, 0], [0.01, 0, 0]);
    const chestAnchor = addAnchor(chest, 'Equipment_Chest');
    addMesh(
        chestAnchor,
        'Wizard_RunicCuirass',
        geometry('wizard-runic-cuirass', () => createTailoredTorsoGeometry(0.45, 0.52, 1.13)),
        materials.cloth,
        { position: [0, 0.48, 0], scale: [1.04, 1, 0.75] }
    );
    addMesh(
        chestAnchor,
        'Wizard_CuirassPanel',
        geometry('wizard-cuirass-panel', () => {
            const shape = new THREE.Shape();
            shape.moveTo(-0.27, 0.47);
            shape.lineTo(0.27, 0.47);
            shape.lineTo(0.19, -0.4);
            shape.lineTo(0, -0.52);
            shape.lineTo(-0.2, -0.38);
            shape.closePath();
            return new THREE.ShapeGeometry(shape, 1);
        }),
        materials.clothLight,
        { position: [0.05, 0.47, 0.4], rotation: [0, 0, -0.08] }
    );
    addMesh(
        chestAnchor,
        'Wizard_ChestSigilOuter',
        geometry('wizard-chest-sigil-outer', () => new THREE.TorusGeometry(0.17, 0.026, 4, 8)),
        materials.arcane,
        { position: [0.03, 0.58, 0.455], rotation: [Math.PI / 2, 0, 0], scale: [0.82, 1.18, 1] }
    );
    addMesh(
        chestAnchor,
        'Wizard_ChestSigilCore',
        geometry('wizard-chest-sigil-core', () => new THREE.OctahedronGeometry(0.075, 0)),
        materials.storm,
        { position: [0.03, 0.58, 0.47], scale: [0.7, 1, 0.4] }
    );
    for (let index = 0; index < 3; index++) {
        addMesh(
            chestAnchor,
            `Wizard_ChestClasp${index}`,
            geometry('wizard-chest-clasp', () => new THREE.OctahedronGeometry(0.045, 0)),
            materials.silver,
            { position: [-0.25, 0.78 - index * 0.2, 0.36], scale: [0.66, 1, 0.4] }
        );
    }

    const cloak = addPivot(chest, 'Rig_Cloak', [0, 0.88, -0.36], [0.06, 0, 0]);
    [-1, 1].forEach((side) => {
        addMesh(
            cloak,
            side < 0 ? 'Wizard_CloakLeft' : 'Wizard_CloakRight',
            geometry('wizard-split-cloak', () => {
                const shape = new THREE.Shape();
                shape.moveTo(-0.36, 0.12);
                shape.lineTo(0.36, 0.12);
                shape.lineTo(0.3, -1.56);
                shape.lineTo(0.08, -1.42);
                shape.lineTo(-0.1, -1.7);
                shape.lineTo(-0.3, -1.5);
                shape.closePath();
                return new THREE.ShapeGeometry(shape, 1);
            }),
            side < 0 ? materials.clothDark : materials.cloth,
            {
                position: [side * 0.23, -0.05, 0],
                rotation: [0.08, Math.PI, side * 0.035],
                scale: [0.95, side < 0 ? 1 : 0.94, 1],
                receiveShadow: false
            }
        );
    });
    addMesh(
        cloak,
        'Wizard_CloakStar',
        geometry('wizard-cloak-star', () => new THREE.OctahedronGeometry(0.12, 0)),
        materials.arcane,
        { position: [0.16, -0.56, -0.02], scale: [0.55, 1.2, 0.22] }
    );

    const neck = addAnchor(chest, 'Equipment_Neck', [0, 1.04, 0]);
    addMesh(neck, 'Wizard_Neck', geometry('humanoid-neck', () => new THREE.CylinderGeometry(0.145, 0.17, 0.34, 8)), materials.skin, {
        position: [0, 0.1, 0], scale: [0.92, 1, 0.88]
    }).userData.equipmentBodyBase = true;
    addMesh(
        neck,
        'Wizard_HighCollar',
        geometry('wizard-high-collar', () => new THREE.CylinderGeometry(0.32, 0.42, 0.34, 7, 1, true)),
        materials.slate,
        { position: [0, 0.06, -0.02], scale: [1, 1, 0.86] }
    );

    const head = addPivot(chest, 'Rig_Head', [0, 1.32, 0], [-0.03, 0, 0]);
    const headAnchor = addAnchor(head, 'Equipment_Head');
    const face = addMesh(
        headAnchor,
        'Wizard_Head',
        geometry('wizard-head', () => new THREE.DodecahedronGeometry(0.29, 1)),
        materials.skin,
        { position: [0, 0.11, 0], scale: [0.82, 1.08, 0.82] }
    );
    face.userData.equipmentBodyBase = true;
    addMesh(
        headAnchor,
        'Wizard_Cowl',
        geometry('wizard-cowl', createOpenHoodGeometry),
        materials.clothDark,
        { position: [0, 0, -0.04], scale: [0.94, 1, 0.92] }
    );
    addMesh(
        headAnchor,
        'Wizard_CowlCrest',
        geometry('wizard-cowl-crest', () => new THREE.ConeGeometry(0.13, 0.7, 5)),
        materials.clothLight,
        { position: [0.05, 0.72, -0.08], rotation: [0.24, 0, Math.PI], scale: [0.9, 1, 0.76] }
    );
    addMesh(
        headAnchor,
        'Wizard_BrowVane',
        geometry('wizard-brow-vane', () => new THREE.TetrahedronGeometry(0.17, 0)),
        materials.silver,
        { position: [0, 0.31, 0.34], rotation: [0.1, 0, Math.PI / 4], scale: [0.46, 1.12, 0.34] }
    );
    const eyes = addMesh(
        headAnchor,
        'Wizard_EyeGlow',
        geometry('wizard-eye-glow', () => createPairedEyesGeometry(0.075, 0.035, 0.2)),
        material('wizard-eyes', 0x9dc6d1, { emissive: 0x73a9bf, emissiveIntensity: 0.22 }),
        { position: [0, 0.17, 0.31] }
    );
    eyes.userData.equipmentBodyBase = true;

    const offHand = addWizardArm(chest, 'Left', materials);
    const mainHand = addWizardArm(chest, 'Right', materials);
    addWizardFocus(offHand, materials);
    addWizardStaff(mainHand, materials);

    assertEquipmentAnchors(root);
    root.userData.proceduralHumanoid = true;
    root.userData.proceduralClass = 'Wizard';
    root.userData.equipmentLengthBySlot = Object.freeze({ chest: 1, legs: 0.96 });
    root.userData.artStyle = 'Stormcrown hexweaver';
    root.userData.sharedGeometry = true;
    root.userData.equipmentAnchors = Object.fromEntries(
        Object.entries(HUMANOID_EQUIPMENT_ANCHORS).map(([slot, names]) => [slot, [...names]])
    );
    root.userData.equipmentScaleBySlot = Object.freeze({
        head: 0.9,
        shoulders: 0.82,
        chest: 0.88,
        gloves: 0.86,
        belt: 0.88,
        legs: 0.88,
        feet: 0.84,
        neck: 0.9,
        ring1: 0.88,
        ring2: 0.88,
        trinket1: 0.9,
        trinket2: 0.9,
        mainHand: 0.92,
        offHand: 0.9
    });
    root.userData.animations = createWizardAnimationClips();
    root.userData.bounds = Object.freeze({ radius: 1.1, height: 4.55, origin: 'feet' });
    installRestPoseReset(root);
    return root;
}

/**
 * Creates Lanternhold's code-native dawnwarden: an open-faced sun-templar
 * framed by fitted reliquary plate, a split war skirt, radiant crown,
 * oathmace, and swinging spirit censer on the shared humanoid contract.
 */
export function createProceduralCleric() {
    const materials = {
        cloth: material('cleric-cloth', CLERIC_PALETTE.cloth, { roughness: 0.96, side: THREE.DoubleSide }),
        clothDark: material('cleric-cloth-dark', CLERIC_PALETTE.clothDark, { roughness: 0.99, side: THREE.DoubleSide }),
        ivory: material('cleric-ivory', CLERIC_PALETTE.ivory, { roughness: 0.92 }),
        bronze: material('cleric-bronze', CLERIC_PALETTE.bronze, { metalness: 0.66, roughness: 0.44 }),
        gold: material('cleric-gold', CLERIC_PALETTE.gold, { metalness: 0.72, roughness: 0.36 }),
        iron: material('cleric-iron', CLERIC_PALETTE.iron, { metalness: 0.68, roughness: 0.46 }),
        leather: material('cleric-leather', CLERIC_PALETTE.leather, { roughness: 0.9 }),
        skin: material('cleric-skin', CLERIC_PALETTE.skin, { roughness: 0.9 }),
        hair: material('cleric-hair', CLERIC_PALETTE.hair, { roughness: 0.92 }),
        hairLight: material('cleric-hair-light', CLERIC_PALETTE.hairLight, { roughness: 0.84 }),
        lips: material('cleric-lips', CLERIC_PALETTE.lips, { roughness: 0.74 }),
        holy: material('cleric-holy', CLERIC_PALETTE.holy, {
            emissive: CLERIC_PALETTE.holy,
            emissiveIntensity: 1.35,
            roughness: 0.22
        }),
        spirit: material('cleric-spirit', CLERIC_PALETTE.spirit, {
            emissive: CLERIC_PALETTE.spirit,
            emissiveIntensity: 1.25,
            roughness: 0.2
        })
    };

    const root = new THREE.Group();
    root.name = 'ProceduralCleric';
    const rigRoot = addPivot(root, 'RigRoot');
    const hips = addPivot(rigRoot, 'Rig_Hips', [0, 1.74, 0]);

    addMesh(
        hips,
        'Cleric_HipVestment',
        geometry('cleric-hip-vestment-v2', () => new THREE.CylinderGeometry(0.38, 0.58, 0.43, 8)),
        materials.clothDark,
        { position: [0, 0.09, 0], scale: [1, 1, 0.76] }
    );
    addMesh(
        hips,
        'Cleric_WarSash',
        geometry('cleric-war-sash', () => {
            const shape = new THREE.Shape();
            shape.moveTo(-0.14, 0.22);
            shape.lineTo(0.17, 0.22);
            shape.lineTo(0.1, -0.52);
            shape.lineTo(-0.06, -0.65);
            shape.lineTo(-0.16, -0.48);
            shape.closePath();
            return new THREE.ShapeGeometry(shape, 1);
        }),
        materials.cloth,
        { position: [0.13, -0.22, 0.46], rotation: [-0.04, 0, -0.08] }
    );
    addMesh(
        hips,
        'Cleric_SashSeal',
        geometry('cleric-sash-seal', () => new THREE.OctahedronGeometry(0.115, 0)),
        materials.holy,
        { position: [0.1, -0.33, 0.5], scale: [0.7, 1.18, 0.34] }
    );
    [-1, 1].forEach((side) => {
        addMesh(
            hips,
            side < 0 ? 'Cleric_HipFauldLeft' : 'Cleric_HipFauldRight',
            geometry('cleric-hip-fauld', () => new THREE.DodecahedronGeometry(0.25, 0)),
            materials.iron,
            {
                position: [side * 0.43, -0.05, 0.02],
                rotation: [0, 0, -side * 0.16],
                scale: [0.78, 1.28, 0.6]
            }
        );
    });

    const belt = addAnchor(hips, 'Equipment_Belt', [0, 0.22, 0]);
    addMesh(
        belt,
        'Cleric_ReliquaryBelt',
        geometry('cleric-reliquary-belt', () => new THREE.CylinderGeometry(0.445, 0.445, 0.16, 8)),
        materials.leather,
        { scale: [1, 1, 0.84] }
    );
    addMesh(
        belt,
        'Cleric_BeltIcon',
        geometry('cleric-belt-icon', () => new THREE.BoxGeometry(0.2, 0.2, 0.08)),
        materials.gold,
        { position: [0, 0, 0.45], rotation: [0, 0, Math.PI / 4] }
    );
    addAnchor(belt, 'Equipment_TrinketLeft', [0.36, -0.18, 0.26]);
    addAnchor(belt, 'Equipment_TrinketRight', [-0.36, -0.18, 0.26]);

    addClericLeg(hips, 'Left', materials);
    addClericLeg(hips, 'Right', materials);

    const chest = addPivot(hips, 'Rig_Chest', [0, 0.42, 0], [0.01, 0, 0]);
    const chestAnchor = addAnchor(chest, 'Equipment_Chest');
    addMesh(
        chestAnchor,
        'Cleric_ReliquaryCuirass',
        geometry('cleric-reliquary-cuirass-v2', () => createTailoredTorsoGeometry(0.34, 0.5, 1.08)),
        materials.iron,
        { position: [0, 0.48, 0], scale: [1.04, 1, 0.7] }
    );
    addMesh(
        chestAnchor,
        'Cleric_CuirassContour',
        geometry('cleric-cuirass-contour-v2', () => new THREE.DodecahedronGeometry(0.48, 0)),
        materials.bronze,
        { position: [0, 0.64, 0.32], scale: [0.78, 0.4, 0.22] }
    );
    [-1, 1].forEach((side) => {
        addMesh(
            chestAnchor,
            side < 0 ? 'Cleric_BreastplateLeft' : 'Cleric_BreastplateRight',
            geometry('cleric-breastplate-cup', () => new THREE.DodecahedronGeometry(0.29, 0)),
            materials.iron,
            {
                position: [side * 0.19, 0.67, 0.35],
                rotation: [0.06, 0, -side * 0.04],
                scale: [0.78, 0.68, 0.42]
            }
        );
    });
    addMesh(
        chestAnchor,
        'Cleric_CuirassBib',
        geometry('cleric-cuirass-bib', () => {
            const shape = new THREE.Shape();
            shape.moveTo(-0.19, 0.38);
            shape.lineTo(0.19, 0.38);
            shape.lineTo(0.15, -0.31);
            shape.lineTo(0, -0.5);
            shape.lineTo(-0.15, -0.31);
            shape.closePath();
            return new THREE.ShapeGeometry(shape, 1);
        }),
        materials.cloth,
        { position: [0, 0.42, 0.405] }
    );
    addMesh(
        chestAnchor,
        'Cleric_SunReliquary',
        geometry('cleric-sun-reliquary', () => new THREE.TorusGeometry(0.18, 0.035, 5, 10)),
        materials.gold,
        { position: [0, 0.58, 0.5], rotation: [Math.PI / 2, 0, 0] }
    );
    addMesh(
        chestAnchor,
        'Cleric_SunReliquaryCore',
        geometry('cleric-sun-reliquary-core', () => new THREE.OctahedronGeometry(0.09, 0)),
        materials.holy,
        { position: [0, 0.58, 0.52], scale: [0.82, 1.12, 0.46] }
    );
    [-1, 1].forEach((side) => {
        addMesh(
            chestAnchor,
            side < 0 ? 'Cleric_ReliquaryRayLeft' : 'Cleric_ReliquaryRayRight',
            geometry('cleric-reliquary-ray', () => new THREE.ConeGeometry(0.055, 0.3, 4)),
            materials.gold,
            { position: [side * 0.25, 0.58, 0.49], rotation: [0, 0, -side * Math.PI / 2] }
        );
    });

    const cloak = addPivot(chest, 'Rig_Cloak', [0, 0.83, -0.38], [0.08, 0, 0]);
    [-1, 1].forEach((side) => {
        addMesh(
            cloak,
            side < 0 ? 'Cleric_WarCapeLeft' : 'Cleric_WarCapeRight',
            geometry('cleric-split-war-cape', () => {
                const shape = new THREE.Shape();
                shape.moveTo(-0.34, 0.12);
                shape.lineTo(0.34, 0.12);
                shape.lineTo(0.26, -1.28);
                shape.lineTo(0.06, -1.17);
                shape.lineTo(-0.12, -1.42);
                shape.lineTo(-0.29, -1.25);
                shape.closePath();
                return new THREE.ShapeGeometry(shape, 1);
            }),
            side < 0 ? materials.cloth : materials.clothDark,
            {
                position: [side * 0.25, -0.02, 0],
                rotation: [0.08, Math.PI, side * 0.055],
                scale: [0.94, side < 0 ? 1 : 0.92, 1],
                receiveShadow: false
            }
        );
    });
    addMesh(
        cloak,
        'Cleric_CloakReliquary',
        geometry('cleric-cloak-reliquary', () => new THREE.OctahedronGeometry(0.14, 0)),
        materials.spirit,
        { position: [0, -0.55, -0.02], scale: [0.65, 1.3, 0.24] }
    );

    const neck = addAnchor(chest, 'Equipment_Neck', [0, 1.05, 0]);
    addMesh(
        neck,
        'Cleric_Neck',
        geometry('humanoid-neck', () => new THREE.CylinderGeometry(0.145, 0.17, 0.34, 8)),
        materials.skin,
        { position: [0, 0.12, -0.01], scale: [1, 1, 0.9] }
    ).userData.equipmentBodyBase = true;
    addMesh(
        neck,
        'Cleric_Gorget',
        geometry('cleric-gorget-v2', () => new THREE.CylinderGeometry(0.25, 0.31, 0.12, 8, 1, true)),
        materials.bronze,
        { position: [0, 0.01, -0.025], scale: [1, 1, 0.8] }
    );
    addMesh(
        neck,
        'Cleric_SunPendant',
        geometry('cleric-sun-pendant', () => new THREE.OctahedronGeometry(0.1, 0)),
        materials.holy,
        { position: [0, -0.08, 0.3], scale: [0.7, 1.05, 0.34] }
    );

    const head = addPivot(chest, 'Rig_Head', [0, 1.34, 0], [0.02, 0, 0]);
    const headAnchor = addAnchor(head, 'Equipment_Head');
    const face = addMesh(
        headAnchor,
        'Cleric_Head',
        geometry('cleric-head', () => new THREE.DodecahedronGeometry(0.3, 1)),
        materials.skin,
        { position: [0, 0.1, 0], scale: [0.78, 1.1, 0.81] }
    );
    face.userData.equipmentBodyBase = true;
    addMesh(
        headAnchor,
        'Cleric_HairBack',
        geometry('cleric-hair-back', () => new THREE.DodecahedronGeometry(0.34, 1)),
        materials.hair,
        { position: [0, 0.08, -0.18], scale: [0.9, 1.24, 0.62] }
    );
    addMesh(
        headAnchor,
        'Cleric_HairCap',
        geometry('cleric-hair-cap-v2', () => new THREE.SphereGeometry(0.325, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.64)),
        materials.hairLight,
        { position: [0, 0.215, -0.075], scale: [0.9, 1, 0.82] }
    );
    addMesh(
        headAnchor,
        'Cleric_HairBun',
        geometry('cleric-hair-bun', () => new THREE.DodecahedronGeometry(0.21, 0)),
        materials.hairLight,
        { position: [0.11, 0.31, -0.33], scale: [1.08, 1.16, 0.82] }
    );
    [-1, 1].forEach((side) => {
        const templeLock = addMesh(
            headAnchor,
            side < 0 ? 'Cleric_TempleLockLeft' : 'Cleric_TempleLockRight',
            geometry('cleric-temple-lock', () => new THREE.ConeGeometry(0.075, 0.48, 6)),
            side < 0 ? materials.hairLight : materials.hair,
            {
                position: [side * 0.225, -0.015, -0.015],
                rotation: [0.08, 0, side * 0.13],
                scale: [0.82, side < 0 ? 1.08 : 0.96, 0.72]
            }
        );
        templeLock.userData.equipmentBodyBase = true;
    });
    addMesh(
        headAnchor,
        'Cleric_SweptFringeLeft',
        geometry('cleric-swept-fringe', () => new THREE.ConeGeometry(0.09, 0.34, 5)),
        materials.hairLight,
        { position: [0.09, 0.255, 0.205], rotation: [0.08, 0, -0.74], scale: [0.72, 1, 0.56] }
    );
    addMesh(
        headAnchor,
        'Cleric_SweptFringeRight',
        geometry('cleric-swept-fringe', () => new THREE.ConeGeometry(0.09, 0.34, 5)),
        materials.hair,
        { position: [-0.1, 0.25, 0.2], rotation: [0.08, 0, 0.66], scale: [0.68, 0.9, 0.54] }
    );
    addMesh(
        headAnchor,
        'Cleric_BrowPlate',
        geometry('cleric-brow-plate-v2', () => new THREE.BoxGeometry(0.43, 0.035, 0.035)),
        materials.gold,
        { position: [0, 0.3, 0.235] }
    );
    addMesh(
        headAnchor,
        'Cleric_DiademGem',
        geometry('cleric-diadem-gem', () => new THREE.OctahedronGeometry(0.075, 0)),
        materials.holy,
        { position: [0, 0.325, 0.255], scale: [0.68, 1.05, 0.38] }
    );
    const eyes = addMesh(
        headAnchor,
        'Cleric_EyeGlow',
        geometry('cleric-eye', () => new THREE.OctahedronGeometry(0.066, 0)),
        material('cleric-eyes', 0xc6b57f, { emissive: 0x958044, emissiveIntensity: 0.18 }),
        { position: [0.098, 0.17, 0.25], scale: [1, 0.35, 0.28], rotation: [0, 0, -0.06] }
    );
    eyes.userData.equipmentBodyBase = true;
    const rightEye = addMesh(
        headAnchor,
        'Cleric_EyeGlowRight',
        geometry('cleric-eye', () => new THREE.OctahedronGeometry(0.066, 0)),
        material('cleric-eyes', 0xc6b57f, { emissive: 0x958044, emissiveIntensity: 0.18 }),
        { position: [-0.098, 0.17, 0.25], scale: [1, 0.35, 0.28], rotation: [0, 0, 0.06] }
    );
    rightEye.userData.equipmentBodyBase = true;
    [-1, 1].forEach((side) => {
        const brow = addMesh(
            headAnchor,
            side < 0 ? 'Cleric_BrowLeft' : 'Cleric_BrowRight',
            geometry('cleric-brow', () => new THREE.BoxGeometry(0.108, 0.018, 0.018)),
            materials.hair,
            { position: [side * 0.098, 0.225, 0.249], rotation: [0, 0, -side * 0.07] }
        );
        brow.userData.equipmentBodyBase = true;
        const braid = addPivot(
            headAnchor,
            side < 0 ? 'Cleric_BraidLeft' : 'Cleric_BraidRight',
            [side * 0.285, 0.03, -0.09],
            [0.08, 0, -side * 0.11]
        );
        // These sit outside the helmet volume and preserve the Cleric's
        // silhouette when a procedural head item replaces the hair cap.
        braid.userData.equipmentBodyBase = true;
        for (let index = 0; index < 5; index++) {
            addMesh(
                braid,
                `${side < 0 ? 'Cleric_BraidLeft' : 'Cleric_BraidRight'}Knot${index}`,
                geometry('cleric-braid-knot', () => new THREE.OctahedronGeometry(0.085, 0)),
                index % 2 === 0 ? materials.hairLight : materials.hair,
                { position: [side * index * 0.025, -index * 0.145, 0], scale: [0.82 - index * 0.065, 1, 0.68] }
            );
        }
        addMesh(
            braid,
            side < 0 ? 'Cleric_BraidSealLeft' : 'Cleric_BraidSealRight',
            geometry('cleric-braid-seal', () => new THREE.OctahedronGeometry(0.055, 0)),
            materials.gold,
            { position: [side * 0.1, -0.68, 0], scale: [0.7, 1.05, 0.62] }
        );
    });
    const nose = addMesh(
        headAnchor,
        'Cleric_Nose',
        geometry('cleric-nose', () => new THREE.TetrahedronGeometry(0.066, 0)),
        materials.skin,
        { position: [0, 0.105, 0.27], rotation: [0.16, Math.PI / 4, 0], scale: [0.52, 1, 0.55] }
    );
    nose.userData.equipmentBodyBase = true;
    const lips = addMesh(
        headAnchor,
        'Cleric_Lips',
        geometry('cleric-lips-v2', () => new THREE.BoxGeometry(0.135, 0.026, 0.018)),
        materials.lips,
        { position: [0, 0.005, 0.25] }
    );
    lips.userData.equipmentBodyBase = true;
    for (let index = 0; index < 7; index++) {
        const angle = -Math.PI * 0.68 + index * Math.PI * 0.226;
        addMesh(
            headAnchor,
            `Cleric_BrokenSunRay${index}`,
            geometry('cleric-broken-sun-ray-v2', () => new THREE.ConeGeometry(0.068, 0.44, 4)),
            materials.gold,
            {
                position: [Math.sin(angle) * 0.385, 0.56 + Math.cos(angle) * 0.3, -0.18],
                rotation: [0, 0, -angle],
                scale: [1, index === 3 ? 1.28 : 0.92, 0.76]
            }
        );
    }

    const offHand = addClericArm(chest, 'Left', materials);
    const mainHand = addClericArm(chest, 'Right', materials);
    addClericCenser(offHand, materials);
    addClericMace(mainHand, materials);

    assertEquipmentAnchors(root);
    root.userData.proceduralHumanoid = true;
    root.userData.proceduralClass = 'Cleric';
    root.userData.equipmentLengthBySlot = Object.freeze({ chest: 0.98, legs: 0.92 });
    root.userData.artStyle = 'Lanternhold dawnwarden';
    root.userData.genderPresentation = 'female';
    root.userData.sharedGeometry = true;
    root.userData.equipmentAnchors = Object.fromEntries(
        Object.entries(HUMANOID_EQUIPMENT_ANCHORS).map(([slot, names]) => [slot, [...names]])
    );
    root.userData.equipmentScaleBySlot = Object.freeze({
        head: 0.86,
        shoulders: 0.6,
        chest: 0.62,
        gloves: 0.8,
        belt: 0.82,
        legs: 0.82,
        feet: 0.8,
        neck: 0.76,
        ring1: 0.82,
        ring2: 0.82,
        trinket1: 0.84,
        trinket2: 0.84,
        mainHand: 0.9,
        offHand: 0.88
    });
    root.userData.animations = createClericAnimationClips();
    root.userData.bounds = Object.freeze({ radius: 1.25, height: 4.55, origin: 'feet' });
    installRestPoseReset(root);
    return root;
}

export function getProceduralHumanoidCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
