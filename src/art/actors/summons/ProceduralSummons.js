import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_SUMMON_DEFINITIONS = Object.freeze({
    AvengingSeraph: Object.freeze({
        artStyle: 'Lanternhold reliquary seraph',
        bounds: Object.freeze({ radius: 2.8, height: 5.2, origin: 'feet' }),
        combatRadius: 1.5,
        palette: Object.freeze({
            ash: 0x17151b,
            cloth: 0x342c39,
            bone: 0xd8cba8,
            bronze: 0x7d5930,
            gold: 0xc8943f,
            spirit: 0xa6ffd2,
            flame: 0xffcf67
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
            roughness: options.roughness ?? 0.72,
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

function createMaterials(palette) {
    return {
        ash: material('seraph-ash', palette.ash, { roughness: 0.94 }),
        cloth: material('seraph-cloth', palette.cloth, { roughness: 0.9 }),
        bone: material('seraph-bone', palette.bone, { roughness: 0.68 }),
        bronze: material('seraph-bronze', palette.bronze, { metalness: 0.7, roughness: 0.38 }),
        gold: material('seraph-gold', palette.gold, { metalness: 0.74, roughness: 0.32 }),
        spirit: material('seraph-spirit', palette.spirit, {
            emissive: palette.spirit,
            emissiveIntensity: 1.25,
            roughness: 0.24
        }),
        flame: material('seraph-flame', palette.flame, {
            emissive: palette.flame,
            emissiveIntensity: 1.65,
            roughness: 0.18
        }),
        veil: material('seraph-veil', palette.spirit, {
            emissive: palette.spirit,
            emissiveIntensity: 0.75,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            side: THREE.DoubleSide,
            roughness: 0.3
        })
    };
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

function addGroundSeal(root, materials) {
    addMesh(
        root,
        'AvengingSeraph_BindingCircle',
        geometry('seraph-ground-ring', () => new THREE.TorusGeometry(1.2, 0.035, 5, 24)),
        materials.veil,
        {
            position: [0, 0.035, 0],
            rotation: [Math.PI / 2, 0, 0],
            castShadow: false,
            receiveShadow: false
        }
    );
    addMesh(
        root,
        'AvengingSeraph_BindingCore',
        geometry('seraph-ground-core', () => new THREE.RingGeometry(0.25, 0.31, 12)),
        materials.veil,
        {
            position: [0, 0.04, 0],
            rotation: [-Math.PI / 2, 0, 0],
            castShadow: false,
            receiveShadow: false
        }
    );

    const rayGeometry = geometry('seraph-ground-ray', () => new THREE.BoxGeometry(0.04, 0.012, 0.62));
    for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        addMesh(root, `AvengingSeraph_BindingRay${index + 1}`, rayGeometry, materials.veil, {
            position: [Math.sin(angle) * 0.66, 0.045, Math.cos(angle) * 0.66],
            rotation: [0, angle, 0],
            castShadow: false,
            receiveShadow: false
        });
    }
}

function addSpectralVestments(body, materials) {
    addMesh(
        body,
        'AvengingSeraph_ReliquarySkirt',
        geometry('seraph-skirt', () => new THREE.CylinderGeometry(0.48, 0.74, 1.45, 8, 1, true)),
        materials.cloth,
        { position: [0, 0.86, 0] }
    );
    addMesh(
        body,
        'AvengingSeraph_SkirtHem',
        geometry('seraph-skirt-hem', () => new THREE.TorusGeometry(0.7, 0.055, 5, 8)),
        materials.bronze,
        { position: [0, 0.14, 0], rotation: [Math.PI / 2, 0, 0] }
    );

    const tailGeometry = geometry('seraph-soul-tail', () => new THREE.ConeGeometry(0.17, 0.82, 5));
    [
        [-0.47, -0.35, 0.05, -0.2],
        [-0.18, -0.4, -0.04, -0.08],
        [0.18, -0.4, -0.04, 0.08],
        [0.47, -0.35, 0.05, 0.2]
    ].forEach(([x, y, z, tilt], index) => {
        addMesh(body, `AvengingSeraph_SoulTail${index + 1}`, tailGeometry, materials.veil, {
            position: [x, y, z],
            rotation: [0, 0, tilt],
            castShadow: false,
            receiveShadow: false
        });
    });

    addMesh(
        body,
        'AvengingSeraph_ChestReliquary',
        geometry('seraph-torso', () => new THREE.CylinderGeometry(0.58, 0.47, 1.2, 7)),
        materials.ash,
        { position: [0, 1.76, 0] }
    );
    addMesh(
        body,
        'AvengingSeraph_Breastplate',
        geometry('seraph-breastplate', () => new THREE.OctahedronGeometry(0.57, 0)),
        materials.bronze,
        { position: [0, 1.91, 0.16], scale: [1.05, 1.03, 0.42] }
    );
    addMesh(
        body,
        'AvengingSeraph_HeartLamp',
        geometry('seraph-heart', () => new THREE.OctahedronGeometry(0.16, 0)),
        materials.spirit,
        { position: [0, 1.94, 0.42], rotation: [0, 0, Math.PI / 4], castShadow: false }
    );

    const ribGeometry = geometry('seraph-rib', () => new THREE.TorusGeometry(0.42, 0.035, 4, 9, Math.PI));
    [-0.24, 0, 0.24].forEach((offset, index) => {
        addMesh(body, `AvengingSeraph_ReliquaryRib${index + 1}`, ribGeometry, materials.gold, {
            position: [0, 1.77 + offset, 0.24],
            rotation: [Math.PI / 2, 0, 0]
        });
    });
}

function addHead(body, materials) {
    const head = addPivot(body, 'Rig_SeraphHead', [0, 2.66, 0]);
    addMesh(
        head,
        'AvengingSeraph_Hood',
        geometry('seraph-hood', () => new THREE.ConeGeometry(0.46, 0.92, 7)),
        materials.cloth,
        { position: [0, 0.04, -0.02], rotation: [0.08, 0, 0] }
    );
    addMesh(
        head,
        'AvengingSeraph_BurialMask',
        geometry('seraph-mask', () => new THREE.CylinderGeometry(0.31, 0.25, 0.62, 6)),
        materials.bone,
        { position: [0, -0.02, 0.23], rotation: [Math.PI / 2, 0, 0], scale: [1, 1, 0.58] }
    );
    addMesh(
        head,
        'AvengingSeraph_MaskCrown',
        geometry('seraph-mask-crown', () => new THREE.ConeGeometry(0.17, 0.42, 5)),
        materials.gold,
        { position: [0, 0.42, 0.2] }
    );

    const eyeGeometry = geometry('seraph-eye', () => new THREE.OctahedronGeometry(0.052, 0));
    for (const [side, x] of [['Left', 0.105], ['Right', -0.105]]) {
        addMesh(head, `AvengingSeraph_Eye${side}`, eyeGeometry, materials.spirit, {
            position: [x, 0.07, 0.48],
            scale: [1.3, 0.65, 0.45],
            castShadow: false
        });
    }
    return head;
}

function addHalo(body, materials) {
    const halo = addPivot(body, 'Rig_SeraphHalo', [0, 2.95, -0.2], [0.12, 0, 0]);
    addMesh(
        halo,
        'AvengingSeraph_BrokenSunHalo',
        geometry('seraph-halo', () => new THREE.TorusGeometry(0.67, 0.055, 5, 16, Math.PI * 1.72)),
        materials.gold,
        { rotation: [0, 0, -Math.PI * 0.36] }
    );
    addMesh(
        halo,
        'AvengingSeraph_HaloGlow',
        geometry('seraph-halo-glow', () => new THREE.TorusGeometry(0.69, 0.018, 4, 16, Math.PI * 1.72)),
        materials.spirit,
        { rotation: [0, 0, -Math.PI * 0.36], castShadow: false, receiveShadow: false }
    );

    const rayGeometry = geometry('seraph-halo-ray', () => new THREE.ConeGeometry(0.065, 0.38, 4));
    [-1.1, -0.55, 0, 0.55, 1.1].forEach((angle, index) => {
        addMesh(halo, `AvengingSeraph_HaloRay${index + 1}`, rayGeometry, materials.gold, {
            position: [Math.sin(angle) * 0.88, Math.cos(angle) * 0.88, 0],
            rotation: [0, 0, -angle + Math.PI]
        });
    });
    return halo;
}

function addWing(body, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const wing = addPivot(body, `Rig_SeraphWing${side}`, [sign * 0.45, 2.3, -0.12], [0.08, 0, -sign * 0.18]);
    addMesh(
        wing,
        `AvengingSeraph_WingClasp${side}`,
        geometry('seraph-wing-clasp', () => new THREE.OctahedronGeometry(0.24, 0)),
        materials.gold,
        { scale: [1.1, 0.7, 0.75] }
    );

    const featherGeometry = geometry('seraph-feather', () => new THREE.ConeGeometry(0.16, 1.18, 4));
    const innerGeometry = geometry('seraph-inner-feather', () => new THREE.ConeGeometry(0.12, 0.84, 4));
    const featherData = [
        [0.43, 0.56, 0.03, 0.68, 1.18],
        [0.82, 0.43, 0.02, 0.88, 1.3],
        [1.19, 0.22, 0.01, 1.08, 1.34],
        [1.52, -0.06, 0, 1.27, 1.22],
        [1.76, -0.38, -0.02, 1.43, 1.05]
    ];
    featherData.forEach(([x, y, z, angle, length], index) => {
        addMesh(wing, `AvengingSeraph_Primary${side}${index + 1}`, featherGeometry, index % 2 ? materials.bone : materials.gold, {
            position: [sign * x, y, z],
            rotation: [0.06, 0, sign * angle],
            scale: [1, length, 0.62]
        });
    });
    [
        [0.38, 0.06, 0.08, 0.58],
        [0.68, -0.12, 0.06, 0.77],
        [0.94, -0.34, 0.04, 0.96]
    ].forEach(([x, y, z, angle], index) => {
        addMesh(wing, `AvengingSeraph_Secondary${side}${index + 1}`, innerGeometry, materials.spirit, {
            position: [sign * x, y, z],
            rotation: [0, 0, sign * angle],
            scale: [0.8, 0.86 + index * 0.12, 0.52],
            castShadow: false
        });
    });
    return wing;
}

function addArm(body, side, materials) {
    const sign = side === 'Left' ? 1 : -1;
    const shoulder = addPivot(body, `Rig_SeraphShoulder${side}`, [sign * 0.55, 2.08, 0], [0, 0, sign * -0.08]);
    addMesh(
        shoulder,
        `AvengingSeraph_Pauldron${side}`,
        geometry('seraph-pauldron', () => new THREE.ConeGeometry(0.32, 0.52, 5)),
        materials.bronze,
        { position: [sign * 0.12, 0, 0], rotation: [0, 0, sign * Math.PI / 2] }
    );
    addMesh(
        shoulder,
        `AvengingSeraph_UpperArm${side}`,
        geometry('seraph-upper-arm', () => new THREE.CylinderGeometry(0.13, 0.16, 0.67, 6)),
        materials.ash,
        { position: [sign * 0.18, -0.34, 0], rotation: [0, 0, sign * 0.18] }
    );
    const hand = addPivot(shoulder, `Rig_SeraphHand${side}`, [sign * 0.31, -0.7, 0.02]);
    addMesh(
        hand,
        `AvengingSeraph_Gauntlet${side}`,
        geometry('seraph-gauntlet', () => new THREE.OctahedronGeometry(0.18, 0)),
        materials.bone,
        { scale: [0.8, 1.2, 0.72] }
    );
    return hand;
}

function addSpear(hand, materials) {
    const weapon = addPivot(hand, 'Rig_SeraphWeapon', [0, -0.04, 0.02], [0.12, 0, -0.16]);
    addMesh(
        weapon,
        'AvengingSeraph_OathSpearShaft',
        geometry('seraph-spear-shaft', () => new THREE.CylinderGeometry(0.045, 0.055, 2.75, 6)),
        materials.bronze,
        { position: [0, -0.72, 0] }
    );
    addMesh(
        weapon,
        'AvengingSeraph_OathSpearBlade',
        geometry('seraph-spear-blade', () => new THREE.ConeGeometry(0.18, 0.62, 4)),
        materials.gold,
        { position: [0, 0.96, 0], rotation: [0, Math.PI / 4, 0] }
    );
    addMesh(
        weapon,
        'AvengingSeraph_OathSpearRune',
        geometry('seraph-spear-rune', () => new THREE.OctahedronGeometry(0.1, 0)),
        materials.spirit,
        { position: [0, 0.64, 0], rotation: [0, 0, Math.PI / 4], castShadow: false }
    );
    addMesh(
        weapon,
        'AvengingSeraph_OathSpearPommel',
        geometry('seraph-spear-pommel', () => new THREE.ConeGeometry(0.1, 0.3, 4)),
        materials.gold,
        { position: [0, -2.12, 0], rotation: [Math.PI, 0, 0] }
    );
}

function addCenser(hand, materials) {
    const censer = addPivot(hand, 'Rig_SeraphCenser', [0, -0.14, 0.02], [0, 0, 0.1]);
    const linkGeometry = geometry('seraph-chain-link', () => new THREE.TorusGeometry(0.06, 0.012, 4, 7));
    for (let index = 0; index < 4; index += 1) {
        addMesh(censer, `AvengingSeraph_CenserLink${index + 1}`, linkGeometry, materials.gold, {
            position: [0, -0.14 - index * 0.13, 0],
            rotation: [Math.PI / 2, index % 2 ? Math.PI / 2 : 0, 0]
        });
    }
    addMesh(
        censer,
        'AvengingSeraph_CenserBowl',
        geometry('seraph-censer-bowl', () => new THREE.OctahedronGeometry(0.2, 0)),
        materials.bronze,
        { position: [0, -0.72, 0], scale: [1, 0.72, 1] }
    );
    addMesh(
        censer,
        'AvengingSeraph_CenserFlame',
        geometry('seraph-censer-flame', () => new THREE.ConeGeometry(0.1, 0.32, 5)),
        materials.flame,
        { position: [0, -0.49, 0], castShadow: false }
    );
}

function numberTrack(objectName, property, times, values) {
    return new THREE.NumberKeyframeTrack(`${objectName}.${property}`, times, values);
}

function createAnimationClips() {
    const idleTimes = [0, 0.5, 1, 1.5, 2];
    const idle = [
        numberTrack('Rig_SeraphBody', 'position[y]', idleTimes, [1, 1.1, 1, 0.94, 1]),
        numberTrack('Rig_SeraphBody', 'rotation[y]', idleTimes, [0, 0.035, 0, -0.035, 0]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[z]', idleTimes, [-0.18, -0.28, -0.18, -0.1, -0.18]),
        numberTrack('Rig_SeraphWingRight', 'rotation[z]', idleTimes, [0.18, 0.28, 0.18, 0.1, 0.18]),
        numberTrack('Rig_SeraphHalo', 'rotation[z]', idleTimes, [0, 0.08, 0.16, 0.24, 0.32]),
        numberTrack('Rig_SeraphHead', 'rotation[x]', idleTimes, [0, -0.04, 0, 0.035, 0]),
        numberTrack('Rig_SeraphCenser', 'rotation[z]', idleTimes, [0.1, -0.08, 0.1, 0.25, 0.1]),
        numberTrack('Rig_SeraphWeapon', 'rotation[z]', idleTimes, [-0.16, -0.12, -0.16, -0.2, -0.16])
    ];

    const walkTimes = [0, 0.3, 0.6, 0.9, 1.2];
    const walk = [
        numberTrack('Rig_SeraphBody', 'position[y]', walkTimes, [1, 1.06, 1, 1.06, 1]),
        numberTrack('Rig_SeraphBody', 'rotation[x]', walkTimes, [0.02, 0.06, 0.02, 0.06, 0.02]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[z]', walkTimes, [-0.18, -0.42, -0.18, 0.02, -0.18]),
        numberTrack('Rig_SeraphWingRight', 'rotation[z]', walkTimes, [0.18, 0.42, 0.18, -0.02, 0.18]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[x]', walkTimes, [0.08, -0.08, 0.08, 0.2, 0.08]),
        numberTrack('Rig_SeraphWingRight', 'rotation[x]', walkTimes, [0.08, -0.08, 0.08, 0.2, 0.08]),
        numberTrack('Rig_SeraphCenser', 'rotation[z]', walkTimes, [0.1, -0.28, 0.1, 0.42, 0.1]),
        numberTrack('Rig_SeraphHalo', 'rotation[z]', walkTimes, [0, 0.15, 0.3, 0.45, 0.6])
    ];

    const runTimes = [0, 0.18, 0.36, 0.54, 0.72];
    const run = [
        numberTrack('Rig_SeraphBody', 'position[y]', runTimes, [1, 1.12, 1, 1.12, 1]),
        numberTrack('Rig_SeraphBody', 'rotation[x]', runTimes, [0.16, 0.24, 0.16, 0.24, 0.16]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[z]', runTimes, [-0.34, -0.68, -0.34, 0.12, -0.34]),
        numberTrack('Rig_SeraphWingRight', 'rotation[z]', runTimes, [0.34, 0.68, 0.34, -0.12, 0.34]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[x]', runTimes, [-0.05, -0.28, -0.05, 0.25, -0.05]),
        numberTrack('Rig_SeraphWingRight', 'rotation[x]', runTimes, [-0.05, -0.28, -0.05, 0.25, -0.05]),
        numberTrack('Rig_SeraphWeapon', 'rotation[x]', runTimes, [0.12, -0.03, 0.12, 0.27, 0.12]),
        numberTrack('Rig_SeraphCenser', 'rotation[z]', runTimes, [0.1, -0.5, 0.1, 0.62, 0.1]),
        numberTrack('Rig_SeraphHalo', 'rotation[z]', runTimes, [0, 0.25, 0.5, 0.75, 1])
    ];

    const attackTimes = [0, 0.22, 0.42, 0.68, 0.92];
    const attack = [
        numberTrack('Rig_SeraphBody', 'position[y]', attackTimes, [1, 1.12, 1.22, 0.94, 1]),
        numberTrack('Rig_SeraphBody', 'rotation[y]', attackTimes, [0, -0.3, -0.46, 0.28, 0]),
        numberTrack('Rig_SeraphShoulderRight', 'rotation[x]', attackTimes, [0, -0.6, -1.05, 0.78, 0]),
        numberTrack('Rig_SeraphShoulderRight', 'rotation[z]', attackTimes, [0.08, -0.55, -0.72, 0.32, 0.08]),
        numberTrack('Rig_SeraphWeapon', 'rotation[x]', attackTimes, [0.12, -0.62, -0.95, 0.75, 0.12]),
        numberTrack('Rig_SeraphWeapon', 'rotation[z]', attackTimes, [-0.16, -0.82, -1.12, 0.48, -0.16]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[z]', attackTimes, [-0.18, -0.62, -0.75, 0.08, -0.18]),
        numberTrack('Rig_SeraphWingRight', 'rotation[z]', attackTimes, [0.18, 0.62, 0.75, -0.08, 0.18]),
        numberTrack('Rig_SeraphCenser', 'rotation[z]', attackTimes, [0.1, -0.35, -0.62, 0.46, 0.1]),
        numberTrack('Rig_SeraphHalo', 'rotation[z]', attackTimes, [0, -0.3, -0.5, 0.75, 1.05])
    ];

    const deathTimes = [0, 0.35, 0.72, 1.15, 1.55];
    const death = [
        numberTrack('Rig_SeraphBody', 'position[y]', deathTimes, [1, 1.08, 0.72, 0.3, 0.08]),
        numberTrack('Rig_SeraphBody', 'rotation[x]', deathTimes, [0, -0.12, 0.38, 0.86, 1.22]),
        numberTrack('Rig_SeraphBody', 'rotation[z]', deathTimes, [0, 0.04, -0.16, -0.48, -0.72]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[z]', deathTimes, [-0.18, -0.55, -0.06, 0.52, 0.86]),
        numberTrack('Rig_SeraphWingRight', 'rotation[z]', deathTimes, [0.18, 0.55, 0.06, -0.52, -0.86]),
        numberTrack('Rig_SeraphWingLeft', 'rotation[x]', deathTimes, [0.08, -0.3, 0.25, 0.68, 1.1]),
        numberTrack('Rig_SeraphWingRight', 'rotation[x]', deathTimes, [0.08, -0.3, 0.25, 0.68, 1.1]),
        numberTrack('Rig_SeraphHead', 'rotation[x]', deathTimes, [0, -0.15, 0.28, 0.55, 0.72]),
        numberTrack('Rig_SeraphWeapon', 'rotation[z]', deathTimes, [-0.16, -0.1, 0.42, 1.05, 1.42]),
        numberTrack('Rig_SeraphCenser', 'rotation[z]', deathTimes, [0.1, -0.28, 0.52, 0.9, 1.2]),
        numberTrack('Rig_SeraphHalo', 'rotation[z]', deathTimes, [0, 0.35, 0.9, 1.8, 2.8])
    ];

    return [
        new THREE.AnimationClip('Idle', 2, idle),
        new THREE.AnimationClip('Walk', 1.2, walk),
        new THREE.AnimationClip('Run', 0.72, run),
        new THREE.AnimationClip('Attack', 0.92, attack),
        new THREE.AnimationClip('Death', 1.55, death)
    ];
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

export function createProceduralAvengingSeraph() {
    const definition = PROCEDURAL_SUMMON_DEFINITIONS.AvengingSeraph;
    const materials = createMaterials(definition.palette);
    const root = new THREE.Group();
    root.name = 'ProceduralAvengingSeraph';
    addGroundSeal(root, materials);

    const body = addPivot(root, 'Rig_SeraphBody', [0, 1, 0]);
    addSpectralVestments(body, materials);
    addHead(body, materials);
    addHalo(body, materials);
    addWing(body, 'Left', materials);
    addWing(body, 'Right', materials);
    const leftHand = addArm(body, 'Left', materials);
    const rightHand = addArm(body, 'Right', materials);
    addCenser(leftHand, materials);
    addSpear(rightHand, materials);

    root.userData.proceduralSummon = true;
    root.userData.proceduralActorType = 'AvengingSeraph';
    root.userData.artStyle = definition.artStyle;
    root.userData.combatRadius = definition.combatRadius;
    root.userData.sharedGeometry = true;
    root.userData.bounds = definition.bounds;
    root.userData.animations = createAnimationClips();
    installRestPoseReset(root);
    return root;
}

export function getProceduralSummonCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
