import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const TOWN_ACTOR_TYPES = Object.freeze([
    'DwarfSalesman',
    'QuestNPC',
    'DungeonNPC',
    'RespecNPC'
]);

export const TOWN_ACTOR_DEFINITIONS = Object.freeze({
    DwarfSalesman: Object.freeze({
        artStyle: 'Lanternhold ironmonger',
        palette: Object.freeze({
            cloth: 0x44251c,
            clothDark: 0x1d1211,
            leather: 0x513420,
            metal: 0x5d6261,
            trim: 0xbd8136,
            skin: 0x9c7056,
            hair: 0x6f321d,
            glow: 0xffa53d
        }),
        hipsY: 1.28,
        chestY: 0.22,
        headY: 1.04,
        shoulderX: 0.78,
        torsoWidth: 1.22,
        torsoHeight: 1.18,
        focusSwing: 0.1,
        bounds: Object.freeze({ radius: 1.35, height: 3.55, origin: 'feet' })
    }),
    QuestNPC: Object.freeze({
        artStyle: 'Lanternhold oathscribe',
        palette: Object.freeze({
            cloth: 0x55302c,
            clothDark: 0x211317,
            leather: 0x483122,
            metal: 0x77756b,
            trim: 0xd1a04b,
            skin: 0x9c7460,
            hair: 0x342522,
            glow: 0xffd46a
        }),
        hipsY: 1.7,
        chestY: 0.38,
        headY: 1.27,
        shoulderX: 0.67,
        torsoWidth: 0.94,
        torsoHeight: 1.42,
        focusSwing: 0.07,
        bounds: Object.freeze({ radius: 1.3, height: 4.45, origin: 'feet' })
    }),
    DungeonNPC: Object.freeze({
        artStyle: 'Lanternhold waywarden',
        palette: Object.freeze({
            cloth: 0x26383a,
            clothDark: 0x111b20,
            leather: 0x3d3125,
            metal: 0x687477,
            trim: 0x9b8252,
            skin: 0x82685b,
            hair: 0x25272a,
            glow: 0x70d7c5
        }),
        hipsY: 1.68,
        chestY: 0.35,
        headY: 1.26,
        shoulderX: 0.7,
        torsoWidth: 0.96,
        torsoHeight: 1.4,
        focusSwing: 0.24,
        bounds: Object.freeze({ radius: 1.25, height: 4.4, origin: 'feet' })
    }),
    RespecNPC: Object.freeze({
        artStyle: 'Lanternhold ash confessor',
        palette: Object.freeze({
            cloth: 0x3b2945,
            clothDark: 0x17131d,
            leather: 0x3c2930,
            metal: 0x5f5966,
            trim: 0xa9875b,
            skin: 0x87706b,
            hair: 0x312a32,
            glow: 0xb987f3
        }),
        hipsY: 1.72,
        chestY: 0.4,
        headY: 1.28,
        shoulderX: 0.69,
        torsoWidth: 0.98,
        torsoHeight: 1.46,
        focusSwing: 0.14,
        bounds: Object.freeze({ radius: 1.25, height: 4.6, origin: 'feet' })
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
            roughness: options.roughness ?? 0.78,
            metalness: options.metalness ?? 0,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 0,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            depthWrite: options.depthWrite ?? true,
            flatShading: true,
            side: options.side ?? THREE.FrontSide
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

function createMaterials(type, palette) {
    const prefix = `town-${type.toLowerCase()}`;
    return {
        cloth: material(`${prefix}-cloth`, palette.cloth, { roughness: 0.96 }),
        clothDark: material(`${prefix}-cloth-dark`, palette.clothDark, { roughness: 0.98 }),
        leather: material(`${prefix}-leather`, palette.leather, { roughness: 0.9 }),
        metal: material(`${prefix}-metal`, palette.metal, { metalness: 0.68, roughness: 0.4 }),
        trim: material(`${prefix}-trim`, palette.trim, { metalness: 0.58, roughness: 0.42 }),
        skin: material(`${prefix}-skin`, palette.skin, { roughness: 0.86 }),
        hair: material(`${prefix}-hair`, palette.hair, { roughness: 0.94 }),
        glow: material(`${prefix}-glow`, palette.glow, {
            emissive: palette.glow,
            emissiveIntensity: 1.45,
            roughness: 0.3
        }),
        aura: material(`${prefix}-aura`, palette.glow, {
            emissive: palette.glow,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
            side: THREE.DoubleSide,
            roughness: 0.4
        })
    };
}

function addGroundSigil(root, type, materials, radius) {
    addMesh(
        root,
        `${type}_ServicePlinth`,
        geometry('town-service-plinth', () => new THREE.CylinderGeometry(1, 1.06, 0.06, 12)),
        materials.clothDark,
        { position: [0, 0.03, 0], scale: [radius * 0.74, 1, radius * 0.74] }
    );
    addMesh(
        root,
        `${type}_ServiceSigil`,
        geometry('town-service-sigil', () => new THREE.TorusGeometry(0.83, 0.035, 4, 12)),
        materials.aura,
        {
            position: [0, 0.07, 0],
            rotation: [Math.PI / 2, 0, 0],
            scale: [radius * 0.8, radius * 0.8, radius * 0.8],
            castShadow: false,
            receiveShadow: false
        }
    );
}

function addLeg(hips, type, side, materials, hipsY, widthScale) {
    const sign = side === 'Left' ? 1 : -1;
    const availableLength = hipsY - 0.23;
    const upperLength = availableLength * 0.52;
    const lowerLength = availableLength * 0.48;
    const thigh = addPivot(hips, `Rig_Thigh${side}`, [sign * 0.3 * widthScale, -0.05, 0]);
    addMesh(
        thigh,
        `${type}_Thigh${side}`,
        geometry('town-thigh', () => new THREE.CylinderGeometry(0.22, 0.19, 1, 7)),
        materials.cloth,
        { position: [0, -upperLength / 2, 0], scale: [widthScale, upperLength, widthScale] }
    );
    const shin = addPivot(thigh, `Rig_Shin${side}`, [0, -upperLength, 0]);
    addMesh(
        shin,
        `${type}_Shin${side}`,
        geometry('town-shin', () => new THREE.CylinderGeometry(0.19, 0.145, 1, 7)),
        materials.leather,
        { position: [0, -lowerLength / 2, 0], scale: [widthScale, lowerLength, widthScale] }
    );
    addMesh(
        shin,
        `${type}_ShinPlate${side}`,
        geometry('town-shin-plate', () => new THREE.ConeGeometry(0.2, 0.58, 5)),
        materials.metal,
        {
            position: [0, -lowerLength * 0.48, 0.11],
            rotation: [Math.PI, 0, 0],
            scale: [widthScale, Math.min(1, lowerLength / 0.58), 0.55 * widthScale]
        }
    );
    addMesh(
        shin,
        `${type}_Boot${side}`,
        geometry('town-boot', () => new THREE.BoxGeometry(0.38, 0.22, 0.58)),
        materials.leather,
        { position: [0, -lowerLength + 0.03, 0.13], scale: [widthScale, 1, widthScale] }
    );
}

function addArm(chest, type, side, materials, shoulderX, armScale) {
    const sign = side === 'Left' ? 1 : -1;
    const upperArm = addPivot(
        chest,
        `Rig_UpperArm${side}`,
        [sign * shoulderX, 0.48, 0],
        [0.04, 0, -sign * 0.11]
    );
    addMesh(
        upperArm,
        `${type}_UpperArm${side}`,
        geometry('town-upper-arm', () => new THREE.CylinderGeometry(0.19, 0.155, 0.72, 7)),
        materials.cloth,
        { position: [0, -0.35, 0], scale: [armScale, armScale, armScale] }
    );
    addMesh(
        upperArm,
        `${type}_Pauldron${side}`,
        geometry('town-pauldron', () => new THREE.DodecahedronGeometry(0.33, 0)),
        materials.metal,
        { position: [sign * 0.025, -0.02, 0], scale: [1.12 * armScale, 0.55, 0.85] }
    );
    const forearm = addPivot(upperArm, `Rig_Forearm${side}`, [0, -0.67 * armScale, 0]);
    addMesh(
        forearm,
        `${type}_Forearm${side}`,
        geometry('town-forearm', () => new THREE.CylinderGeometry(0.16, 0.12, 0.62, 7)),
        materials.leather,
        { position: [0, -0.3, 0], scale: [armScale, armScale, armScale] }
    );
    addMesh(
        forearm,
        `${type}_Hand${side}`,
        geometry('town-hand', () => new THREE.DodecahedronGeometry(0.15, 0)),
        materials.skin,
        { position: [0, -0.6 * armScale, 0], scale: [armScale, 1.08 * armScale, armScale] }
    );
    return forearm;
}

function addBaseActor(root, type, definition, materials) {
    const widthScale = type === 'DwarfSalesman' ? 1.3 : 1;
    const armScale = type === 'DwarfSalesman' ? 0.86 : 1;
    addGroundSigil(root, type, materials, definition.bounds.radius);

    const rigRoot = addPivot(root, 'RigRoot', [0, type === 'DwarfSalesman' ? 0.1 : 0, 0]);
    const hips = addPivot(rigRoot, 'Rig_Hips', [0, definition.hipsY, 0]);
    addMesh(
        hips,
        `${type}_HipGuard`,
        geometry('town-hip-guard', () => new THREE.CylinderGeometry(0.53, 0.47, 0.46, 8)),
        materials.metal,
        { position: [0, 0.08, 0], scale: [widthScale, 1, 0.9] }
    );
    addMesh(
        hips,
        `${type}_Belt`,
        geometry('town-belt', () => new THREE.TorusGeometry(0.5, 0.07, 5, 9)),
        materials.leather,
        { position: [0, 0.27, 0], rotation: [Math.PI / 2, 0, 0], scale: [widthScale, 0.9, widthScale] }
    );
    addMesh(
        hips,
        `${type}_BeltSeal`,
        geometry('town-belt-seal', () => new THREE.OctahedronGeometry(0.13, 0)),
        materials.trim,
        { position: [0, 0.27, 0.49] }
    );
    addLeg(hips, type, 'Left', materials, definition.hipsY, widthScale);
    addLeg(hips, type, 'Right', materials, definition.hipsY, widthScale);

    const chest = addPivot(hips, 'Rig_Chest', [0, definition.chestY, 0]);
    addMesh(
        chest,
        `${type}_Torso`,
        geometry('town-torso', () => new THREE.CylinderGeometry(0.42, 0.52, 1, 8)),
        materials.cloth,
        {
            position: [0, 0.54, 0],
            scale: [definition.torsoWidth, definition.torsoHeight, definition.torsoWidth * 0.76]
        }
    );
    addMesh(
        chest,
        `${type}_Breastplate`,
        geometry('town-breastplate', () => new THREE.DodecahedronGeometry(0.52, 0)),
        materials.metal,
        { position: [0, 0.65, 0.19], scale: [definition.torsoWidth, 0.8, 0.48] }
    );
    addMesh(
        chest,
        `${type}_Tabard`,
        geometry('town-tabard', () => new THREE.BoxGeometry(0.42, 1.16, 0.065)),
        materials.clothDark,
        { position: [0, -0.08, 0.43], rotation: [-0.08, 0, 0], scale: [widthScale, 1, 1] }
    );
    addMesh(
        chest,
        `${type}_Collar`,
        geometry('town-collar', () => new THREE.TorusGeometry(0.38, 0.09, 5, 9)),
        materials.trim,
        { position: [0, 1.02, 0], rotation: [Math.PI / 2, 0, 0], scale: [widthScale, 0.85, widthScale] }
    );

    const cloak = addPivot(chest, 'Rig_Cloak', [0, 0.82, -0.39], [0.08, 0, 0]);
    addMesh(
        cloak,
        `${type}_Cloak`,
        geometry('town-cloak', () => new THREE.ConeGeometry(0.73, 2.0, 7, 1, true, 0.35, 5.55)),
        materials.clothDark,
        { position: [0, -0.75, 0], scale: [widthScale, 1, 0.55], rotation: [0, Math.PI, 0] }
    );
    addMesh(
        cloak,
        `${type}_CloakClasp`,
        geometry('town-cloak-clasp', () => new THREE.OctahedronGeometry(0.12, 0)),
        materials.trim,
        { position: [0, 0.18, 0.05], scale: [1.2, 1, 0.5] }
    );

    const leftForearm = addArm(chest, type, 'Left', materials, definition.shoulderX, armScale);
    const rightForearm = addArm(chest, type, 'Right', materials, definition.shoulderX, armScale);

    const head = addPivot(chest, 'Rig_Head', [0, definition.headY, 0], [0.015, 0, 0]);
    addMesh(
        head,
        `${type}_Head`,
        geometry('town-head', () => new THREE.DodecahedronGeometry(0.34, 1)),
        materials.skin,
        { position: [0, 0.09, 0], scale: [0.86 * widthScale, 1.08, 0.86] }
    );
    addMesh(
        head,
        `${type}_Cowl`,
        geometry('town-cowl', () => new THREE.CylinderGeometry(0.42, 0.37, 0.66, 8, 1, true)),
        materials.clothDark,
        { position: [0, 0.16, -0.02], scale: [widthScale, 1, 0.9] }
    );
    addMesh(
        head,
        `${type}_Brow`,
        geometry('town-brow', () => new THREE.BoxGeometry(0.5, 0.075, 0.07)),
        materials.hair,
        { position: [0, 0.2, 0.3], scale: [widthScale, 1, 1] }
    );
    addMesh(
        head,
        `${type}_Eyes`,
        geometry('town-eyes', () => new THREE.BoxGeometry(0.31, 0.035, 0.02)),
        materials.glow,
        { position: [0, 0.13, 0.335], scale: [widthScale, 1, 1], castShadow: false, receiveShadow: false }
    );

    return { hips, chest, head, cloak, leftForearm, rightForearm };
}

function addMerchantDetails(root, rig, materials) {
    for (let index = -2; index <= 2; index++) {
        addMesh(
            rig.head,
            `DwarfSalesman_BeardBraid${index + 2}`,
            geometry('town-beard-braid', () => new THREE.ConeGeometry(0.105, 0.72, 6)),
            materials.hair,
            {
                position: [index * 0.115, -0.27 - Math.abs(index) * 0.035, 0.27],
                rotation: [0.05, 0, index * -0.04],
                scale: [1, index === 0 ? 1.18 : 0.9, 0.8]
            }
        );
    }
    addMesh(
        rig.chest,
        'DwarfSalesman_ForgeApron',
        geometry('town-forge-apron', () => new THREE.BoxGeometry(0.94, 1.35, 0.075)),
        materials.leather,
        { position: [0, 0.02, 0.48], rotation: [-0.06, 0, 0] }
    );
    for (const [index, x] of [-0.31, 0, 0.31].entries()) {
        addMesh(
            rig.chest,
            `DwarfSalesman_Coin${index}`,
            geometry('town-coin', () => new THREE.CylinderGeometry(0.1, 0.1, 0.035, 8)),
            materials.trim,
            { position: [x, 0.38, 0.54], rotation: [Math.PI / 2, 0, 0] }
        );
    }
    const focus = addPivot(rig.rightForearm, 'Rig_ServiceFocus', [0, -0.62, 0.02]);
    addMesh(
        focus,
        'DwarfSalesman_HammerHaft',
        geometry('town-hammer-haft', () => new THREE.CylinderGeometry(0.055, 0.065, 1.2, 7)),
        materials.leather,
        { position: [0, -0.28, 0], rotation: [0, 0, -0.2] }
    );
    addMesh(
        focus,
        'DwarfSalesman_HammerHead',
        geometry('town-hammer-head', () => new THREE.BoxGeometry(0.62, 0.25, 0.26)),
        materials.metal,
        { position: [0.12, 0.26, 0], rotation: [0, 0, -0.2] }
    );
    addMesh(
        focus,
        'DwarfSalesman_HammerRune',
        geometry('town-hammer-rune', () => new THREE.OctahedronGeometry(0.085, 0)),
        materials.glow,
        { position: [0.12, 0.26, 0.145], castShadow: false, receiveShadow: false }
    );
    const pack = addPivot(rig.chest, 'DwarfSalesman_MerchantPack', [0, 0.55, -0.56]);
    addMesh(
        pack,
        'DwarfSalesman_Pack',
        geometry('town-merchant-pack', () => new THREE.BoxGeometry(0.86, 0.96, 0.42)),
        materials.leather,
        { rotation: [0.05, 0, 0] }
    );
    addMesh(
        pack,
        'DwarfSalesman_PackLatch',
        geometry('town-pack-latch', () => new THREE.BoxGeometry(0.22, 0.2, 0.05)),
        materials.trim,
        { position: [0, 0.08, -0.235] }
    );
}

function addQuestDetails(root, rig, materials) {
    const focus = addPivot(rig.leftForearm, 'Rig_ServiceFocus', [0, -0.6, 0.06]);
    addMesh(
        focus,
        'QuestNPC_Scroll',
        geometry('town-scroll', () => new THREE.BoxGeometry(0.82, 0.7, 0.055)),
        materials.skin,
        { position: [-0.06, -0.16, 0.2], rotation: [-0.18, 0.08, 0.08] }
    );
    for (const x of [-0.47, 0.35]) {
        addMesh(
            focus,
            `QuestNPC_ScrollRod${x < 0 ? 'Left' : 'Right'}`,
            geometry('town-scroll-rod', () => new THREE.CylinderGeometry(0.055, 0.055, 0.82, 7)),
            materials.trim,
            { position: [x, -0.16, 0.2], rotation: [0, 0, Math.PI / 2] }
        );
    }
    addMesh(
        focus,
        'QuestNPC_OathMark',
        geometry('town-oath-mark', () => new THREE.OctahedronGeometry(0.11, 0)),
        materials.glow,
        { position: [-0.06, -0.16, 0.245], scale: [0.7, 1.45, 0.3], castShadow: false, receiveShadow: false }
    );
    addMesh(
        rig.rightForearm,
        'QuestNPC_Quill',
        geometry('town-quill', () => new THREE.ConeGeometry(0.06, 0.76, 5)),
        materials.trim,
        { position: [0.05, -0.68, 0.15], rotation: [0.2, 0, -0.48] }
    );
    const halo = addPivot(rig.head, 'QuestNPC_OathSun', [0, 0.18, -0.18]);
    addMesh(
        halo,
        'QuestNPC_OathSunRing',
        geometry('town-oath-sun-ring', () => new THREE.TorusGeometry(0.48, 0.045, 5, 12)),
        materials.trim,
        { rotation: [0, 0, 0], scale: [1, 1, 0.7] }
    );
    for (let index = 0; index < 6; index++) {
        const angle = index * Math.PI / 3;
        addMesh(
            halo,
            `QuestNPC_OathSunRay${index}`,
            geometry('town-oath-sun-ray', () => new THREE.ConeGeometry(0.055, 0.3, 4)),
            materials.trim,
            {
                position: [Math.sin(angle) * 0.59, Math.cos(angle) * 0.59, 0],
                rotation: [0, 0, -angle]
            }
        );
    }
}

function addDungeonDetails(root, rig, materials) {
    const focus = addPivot(rig.leftForearm, 'Rig_ServiceFocus', [0, -0.58, 0.03]);
    addMesh(
        focus,
        'DungeonNPC_LanternFrame',
        geometry('town-lantern-frame', () => new THREE.CylinderGeometry(0.24, 0.3, 0.58, 6, 1, true)),
        materials.metal,
        { position: [0, -0.44, 0] }
    );
    addMesh(
        focus,
        'DungeonNPC_LanternFlame',
        geometry('town-lantern-flame', () => new THREE.OctahedronGeometry(0.15, 0)),
        materials.glow,
        { position: [0, -0.43, 0], scale: [0.7, 1.45, 0.7], castShadow: false, receiveShadow: false }
    );
    addMesh(
        focus,
        'DungeonNPC_LanternCap',
        geometry('town-lantern-cap', () => new THREE.ConeGeometry(0.3, 0.25, 6)),
        materials.trim,
        { position: [0, -0.08, 0] }
    );
    addMesh(
        focus,
        'DungeonNPC_LanternBase',
        geometry('town-lantern-base', () => new THREE.CylinderGeometry(0.3, 0.25, 0.13, 6)),
        materials.trim,
        { position: [0, -0.76, 0] }
    );
    for (const x of [-0.2, 0.2]) {
        addMesh(
            focus,
            `DungeonNPC_LanternBar${x < 0 ? 'Left' : 'Right'}`,
            geometry('town-lantern-bar', () => new THREE.BoxGeometry(0.035, 0.58, 0.035)),
            materials.trim,
            { position: [x, -0.43, 0.04] }
        );
    }
    const keys = addPivot(rig.chest, 'DungeonNPC_Keyring', [0.48, -0.08, 0.42], [0, 0, -0.16]);
    addMesh(
        keys,
        'DungeonNPC_KeyRing',
        geometry('town-key-ring', () => new THREE.TorusGeometry(0.14, 0.025, 4, 9)),
        materials.trim
    );
    for (let index = 0; index < 3; index++) {
        addMesh(
            keys,
            `DungeonNPC_Key${index}`,
            geometry('town-key', () => new THREE.BoxGeometry(0.045, 0.42, 0.045)),
            materials.metal,
            { position: [(index - 1) * 0.09, -0.22 - index * 0.035, 0], rotation: [0, 0, (index - 1) * 0.12] }
        );
    }
    addMesh(
        rig.rightForearm,
        'DungeonNPC_MapCase',
        geometry('town-map-case', () => new THREE.CylinderGeometry(0.12, 0.12, 0.9, 7)),
        materials.leather,
        { position: [0.02, -0.52, -0.15], rotation: [0.08, 0, 0.3] }
    );
}

function addRespecDetails(root, rig, materials) {
    addMesh(
        rig.head,
        'RespecNPC_AshMask',
        geometry('town-ash-mask', () => new THREE.ConeGeometry(0.32, 0.7, 5)),
        materials.metal,
        { position: [0, 0.08, 0.25], rotation: [Math.PI / 2, 0, 0], scale: [0.72, 1, 1] }
    );
    for (const side of [-1, 1]) {
        const antler = addPivot(rig.head, `RespecNPC_Antler${side < 0 ? 'Right' : 'Left'}`, [side * 0.26, 0.43, -0.04], [0, 0, -side * 0.24]);
        addMesh(
            antler,
            `RespecNPC_AntlerStem${side}`,
            geometry('town-antler-stem', () => new THREE.CylinderGeometry(0.045, 0.075, 0.82, 6)),
            materials.trim,
            { position: [side * 0.08, 0.34, 0], rotation: [0, 0, -side * 0.22] }
        );
        for (let index = 0; index < 2; index++) {
            addMesh(
                antler,
                `RespecNPC_AntlerTine${side}_${index}`,
                geometry('town-antler-tine', () => new THREE.ConeGeometry(0.045, 0.36, 5)),
                materials.trim,
                {
                    position: [side * (0.17 + index * 0.07), 0.38 + index * 0.22, 0],
                    rotation: [0, 0, -side * (0.78 - index * 0.12)]
                }
            );
        }
    }
    const focus = addPivot(rig.rightForearm, 'Rig_ServiceFocus', [0, -0.62, 0.08]);
    addMesh(
        focus,
        'RespecNPC_SoulOrb',
        geometry('town-soul-orb', () => new THREE.IcosahedronGeometry(0.25, 1)),
        materials.glow,
        { position: [0, -0.17, 0.1], scale: [0.85, 1.12, 0.85], castShadow: false, receiveShadow: false }
    );
    addMesh(
        focus,
        'RespecNPC_SoulRing',
        geometry('town-soul-ring', () => new THREE.TorusGeometry(0.36, 0.035, 5, 10)),
        materials.trim,
        { position: [0, -0.17, 0.1], rotation: [1.05, 0.2, 0] }
    );
    for (let index = 0; index < 4; index++) {
        const angle = index * Math.PI / 2;
        addMesh(
            focus,
            `RespecNPC_MemoryShard${index}`,
            geometry('town-memory-shard', () => new THREE.OctahedronGeometry(0.09, 0)),
            materials.aura,
            {
                position: [Math.cos(angle) * 0.43, -0.17 + Math.sin(angle) * 0.17, Math.sin(angle) * 0.23],
                scale: [0.55, 1.4, 0.55],
                castShadow: false,
                receiveShadow: false
            }
        );
    }
    addMesh(
        rig.leftForearm,
        'RespecNPC_Ledger',
        geometry('town-ledger', () => new THREE.BoxGeometry(0.58, 0.72, 0.12)),
        materials.leather,
        { position: [0, -0.56, 0.17], rotation: [-0.22, 0.08, -0.16] }
    );
    addMesh(
        rig.leftForearm,
        'RespecNPC_LedgerRune',
        geometry('town-ledger-rune', () => new THREE.OctahedronGeometry(0.09, 0)),
        materials.glow,
        { position: [0, -0.56, 0.245], scale: [0.65, 1.3, 0.3], castShadow: false, receiveShadow: false }
    );
}

function numberTrack(name, property, times, values) {
    return new THREE.NumberKeyframeTrack(`${name}.${property}`, times, values);
}

function createIdleClip(definition) {
    const times = [0, 0.65, 1.3, 1.95, 2.6];
    return new THREE.AnimationClip('Idle', 2.6, [
        numberTrack('Rig_Hips', 'position[y]', times, [
            definition.hipsY,
            definition.hipsY + 0.025,
            definition.hipsY,
            definition.hipsY + 0.02,
            definition.hipsY
        ]),
        numberTrack('Rig_Chest', 'rotation[x]', times, [0, -0.018, 0, 0.015, 0]),
        numberTrack('Rig_Chest', 'rotation[y]', times, [0, 0.025, 0, -0.025, 0]),
        numberTrack('Rig_Head', 'rotation[y]', times, [0, 0.09, 0.02, -0.075, 0]),
        numberTrack('Rig_UpperArmLeft', 'rotation[z]', times, [-0.11, -0.14, -0.11, -0.085, -0.11]),
        numberTrack('Rig_UpperArmRight', 'rotation[z]', times, [0.11, 0.085, 0.11, 0.14, 0.11]),
        numberTrack('Rig_Cloak', 'rotation[x]', times, [0.08, 0.105, 0.08, 0.115, 0.08]),
        numberTrack('Rig_ServiceFocus', 'rotation[y]', times, [0, 0.12, 0, -0.12, 0]),
        numberTrack('Rig_ServiceFocus', 'rotation[z]', times, [
            0,
            definition.focusSwing,
            0,
            -definition.focusSwing,
            0
        ])
    ]);
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

export function createProceduralTownActor(type) {
    const definition = TOWN_ACTOR_DEFINITIONS[type];
    if (!definition) throw new Error(`Unknown procedural town actor type: ${type}`);

    const materials = createMaterials(type, definition.palette);
    const root = new THREE.Group();
    root.name = `Procedural${type}`;
    const rig = addBaseActor(root, type, definition, materials);

    if (type === 'DwarfSalesman') addMerchantDetails(root, rig, materials);
    else if (type === 'QuestNPC') addQuestDetails(root, rig, materials);
    else if (type === 'DungeonNPC') addDungeonDetails(root, rig, materials);
    else addRespecDetails(root, rig, materials);

    root.userData.proceduralTownActor = true;
    root.userData.proceduralActorType = type;
    root.userData.artStyle = definition.artStyle;
    root.userData.sharedGeometry = true;
    root.userData.bounds = definition.bounds;
    root.userData.animations = [createIdleClip(definition)];
    installRestPoseReset(root);
    return root;
}

export function createProceduralDwarfSalesman() {
    return createProceduralTownActor('DwarfSalesman');
}

export function createProceduralQuestNPC() {
    return createProceduralTownActor('QuestNPC');
}

export function createProceduralDungeonNPC() {
    return createProceduralTownActor('DungeonNPC');
}

export function createProceduralRespecNPC() {
    return createProceduralTownActor('RespecNPC');
}

export function getProceduralTownActorCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
