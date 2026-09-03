import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_MOLTEN_BOSS_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const PROCEDURAL_MOLTEN_BOSS_DEFINITIONS = Object.freeze({
    Cindermaw: Object.freeze({
        artStyle: 'Furnace Below cinder-hound',
        region: 'Molten Core — The Furnace Below',
        faction: 'caldera menagerie',
        bounds: Object.freeze({ radius: 3.92, height: 4.9, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x17171a, iron: 0x403a39, brass: 0x8b6439, ember: 0xff531c, whitefire: 0xffd08a, ash: 0x6f625b })
    }),
    ScorchedTwins: Object.freeze({
        artStyle: 'Furnace Below twin-flame covenant',
        region: 'Molten Core — The Furnace Below',
        faction: 'the divided brand',
        bounds: Object.freeze({ radius: 3.3, height: 7.1, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x1c191d, iron: 0x4c3535, brass: 0xa2703f, ember: 0xff6230, whitefire: 0xffdf9f, ash: 0x765b62 })
    }),
    ForgemasterPyrax: Object.freeze({
        artStyle: 'Furnace Below oath-anvil forgemaster',
        region: 'Molten Core — The Furnace Below',
        faction: 'black-anvil synod',
        bounds: Object.freeze({ radius: 3.3, height: 6.85, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x18181b, iron: 0x51443d, brass: 0xa8783f, ember: 0xff481c, whitefire: 0xffe0a0, ash: 0x75645b })
    }),
    ObsidianGuardian: Object.freeze({
        artStyle: 'Furnace Below black-glass bulwark',
        region: 'Molten Core — The Furnace Below',
        faction: 'sealed caldera',
        bounds: Object.freeze({ radius: 3.65, height: 7.55, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x0e1014, iron: 0x292c32, brass: 0x765434, ember: 0xf2361b, whitefire: 0xffb060, ash: 0x484a50 })
    }),
    LordInfernax: Object.freeze({
        artStyle: 'Furnace Below crowned furnace-lord',
        region: 'Molten Core — The Furnace Below',
        faction: 'ashen throne',
        bounds: Object.freeze({ radius: 4.25, height: 7.8, origin: 'feet' }),
        combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x121116, iron: 0x45302d, brass: 0xb17a3d, ember: 0xff3518, whitefire: 0xffe8ac, ash: 0x6a4b48 })
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

function createMaterials(type, palette) {
    return {
        basalt: material(`${type}-basalt`, palette.basalt, { roughness: 0.92 }),
        iron: material(`${type}-iron`, palette.iron, { roughness: 0.58, metalness: 0.62 }),
        brass: material(`${type}-brass`, palette.brass, { roughness: 0.46, metalness: 0.78 }),
        ash: material(`${type}-ash`, palette.ash, { roughness: 0.96 }),
        ember: material(`${type}-ember`, palette.ember, { roughness: 0.26, emissive: palette.ember, emissiveIntensity: 1.8 }),
        whitefire: material(`${type}-whitefire`, palette.whitefire, { roughness: 0.2, emissive: palette.whitefire, emissiveIntensity: 2.5 })
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
    const definition = PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type];
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
    root.userData.proceduralBossFamily = 'molten-core';
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

function addCalderaSeal(root, type, radius, materials, teeth = 12) {
    mesh(root, `${type}_CalderaSeal`, geometry('molten-caldera-ring', () => new THREE.RingGeometry(0.82, 0.91, 16)), materials.ember, {
        position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius], castShadow: false, receiveShadow: false
    });
    const tooth = geometry('molten-caldera-tooth', () => new THREE.ConeGeometry(0.085, 0.5, 4));
    for (let index = 0; index < teeth; index += 1) {
        const angle = index / teeth * Math.PI * 2;
        mesh(root, `${type}_SealTooth${index + 1}`, tooth, index % 3 === 0 ? materials.whitefire : materials.brass, {
            position: [Math.sin(angle) * radius * 0.74, 0.12, Math.cos(angle) * radius * 0.74],
            rotation: [Math.PI / 2, angle, 0],
            castShadow: false,
            receiveShadow: false
        });
    }
}

function addEmberCracks(parent, type, materials, count, radius, startY = 0) {
    const crack = geometry('molten-crack', () => new THREE.BoxGeometry(0.07, 0.46, 0.055));
    for (let index = 0; index < count; index += 1) {
        const angle = index / count * Math.PI * 2;
        mesh(parent, `${type}_EmberCrack${index + 1}`, crack, index % 4 === 0 ? materials.whitefire : materials.ember, {
            position: [Math.sin(angle) * radius, startY + (index % 3) * 0.33, Math.cos(angle) * radius],
            rotation: [Math.sin(angle) * 0.15, angle, Math.cos(angle) * 0.24],
            scale: [1, 1 + (index % 2) * 0.5, 1]
        });
    }
}

function addFurnaceCage(parent, type, materials, radius = 0.62, height = 1.22) {
    const bar = geometry(`${type}-furnace-bar`, () => new THREE.CylinderGeometry(0.055, 0.075, height, 5));
    for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        mesh(parent, `${type}_FurnaceBar${index + 1}`, bar, materials.brass, {
            position: [Math.sin(angle) * radius, 0.74, Math.cos(angle) * radius]
        });
    }
    mesh(parent, `${type}_FurnaceHeart`, geometry(`${type}-furnace-heart`, () => new THREE.IcosahedronGeometry(0.34, 0)), materials.whitefire, { position: [0, 0.74, 0] });
    mesh(parent, `${type}_FurnaceRimTop`, geometry(`${type}-furnace-rim`, () => new THREE.TorusGeometry(radius, 0.09, 5, 12)), materials.iron, { position: [0, 0.74 + height / 2, 0], rotation: [Math.PI / 2, 0, 0] });
    mesh(parent, `${type}_FurnaceRimBottom`, geometry(`${type}-furnace-rim`, () => new THREE.TorusGeometry(radius, 0.09, 5, 12)), materials.iron, { position: [0, 0.74 - height / 2, 0], rotation: [Math.PI / 2, 0, 0] });
}

function addCrown(parent, type, materials, count, radius, height) {
    const spike = geometry(`${type}-crown`, () => new THREE.ConeGeometry(0.12, height, 5));
    for (let index = 0; index < count; index += 1) {
        const angle = index / count * Math.PI * 2;
        mesh(parent, `${type}_CrownSpire${index + 1}`, spike, index % 3 === 0 ? materials.whitefire : materials.brass, {
            position: [Math.sin(angle) * radius, 0.42 + (index % 2) * 0.12, Math.cos(angle) * radius],
            rotation: [Math.sin(angle) * 0.2, 0, -Math.cos(angle) * 0.2]
        });
    }
}

function addBipedFrame(root, type, materials, profile = {}) {
    const bodyY = profile.bodyY ?? 2.22;
    const width = profile.width ?? 1;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    const legGeo = geometry(`${type}-leg`, () => new THREE.CylinderGeometry(0.27 * width, 0.34 * width, 1.12, 6));
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const leg = pivot(body, `Rig_${type}Leg${side}`, [sign * 0.48 * width, -1.05, 0]);
        mesh(leg, `${type}_Thigh${side}`, legGeo, materials.basalt, { position: [0, 0.4, 0], scale: [1.16, 1, 1.16] });
        mesh(leg, `${type}_Greave${side}`, legGeo, materials.iron, { position: [0, -0.55, 0.03] });
        mesh(leg, `${type}_KilnFoot${side}`, geometry(`${type}-foot`, () => new THREE.BoxGeometry(0.62 * width, 0.25, 0.92)), materials.basalt, { position: [0, -1.12, 0.2] });
        mesh(body, `${type}_KneeBrand${side}`, geometry('molten-knee-brand', () => new THREE.OctahedronGeometry(0.13, 0)), materials.ember, { position: [sign * 0.48 * width, -1.05, 0.34] });
    }
    mesh(body, `${type}_BasaltPelvis`, geometry(`${type}-pelvis`, () => new THREE.CylinderGeometry(0.68 * width, 0.77 * width, 0.65, 7)), materials.basalt, { position: [0, -0.22, 0] });
    mesh(body, `${type}_AnvilTorso`, geometry(`${type}-torso`, () => new THREE.DodecahedronGeometry(0.92, 0)), materials.iron, { position: [0, 0.78, 0], scale: [width, 1.18, 0.78] });
    const head = pivot(body, `Rig_${type}Head`, [0, 2.05, 0.02]);
    mesh(head, `${type}_BlackIronMask`, geometry(`${type}-head`, () => new THREE.DodecahedronGeometry(0.51, 0)), materials.basalt, { scale: [width, 1.05, 0.88] });
    mesh(head, `${type}_FaceBrand`, geometry(`${type}-face-brand`, () => new THREE.BoxGeometry(0.26, 0.09, 0.08)), materials.whitefire, { position: [0, 0.03, 0.47] });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const arm = pivot(body, `Rig_${type}Arm${side}`, [sign * 1.02 * width, 1.25, 0], [0, 0, sign * -0.08]);
        mesh(arm, `${type}_UpperArm${side}`, geometry(`${type}-upper-arm`, () => new THREE.CylinderGeometry(0.31 * width, 0.25 * width, 1.05, 6)), materials.basalt, { position: [0, -0.48, 0] });
        mesh(arm, `${type}_Bracer${side}`, geometry(`${type}-bracer`, () => new THREE.CylinderGeometry(0.27 * width, 0.22 * width, 0.9, 6)), materials.iron, { position: [0, -1.35, 0.03] });
        mesh(body, `${type}_CrucibleShoulder${side}`, geometry(`${type}-shoulder`, () => new THREE.ConeGeometry(0.48 * width, 0.86, 5)), materials.brass, {
            position: [sign * 1.04 * width, 1.34, -0.02], rotation: [0, 0, sign * -Math.PI / 2]
        });
        mesh(arm, `${type}_PalmCoal${side}`, geometry('molten-palm-coal', () => new THREE.IcosahedronGeometry(0.2, 0)), materials.ember, { position: [0, -1.84, 0.08] });
    }
    const weapon = pivot(body.getObjectByName(`Rig_${type}ArmRight`), `Rig_${type}Weapon`, [0, -1.75, 0.02], [0, 0, -0.14]);
    const accent = pivot(body, `Rig_${type}Accent`, [0, 0.85, -0.45]);
    return { body, head, weapon, accent, leftArm: body.getObjectByName(`Rig_${type}ArmLeft`), rightArm: body.getObjectByName(`Rig_${type}ArmRight`) };
}

function createBipedClips(type, bodyY, options = {}) {
    const stride = options.stride ?? 0.38;
    const reach = options.reach ?? 1;
    const fall = options.fall ?? 0.9;
    const body = `Rig_${type}Body`;
    const head = `Rig_${type}Head`;
    const leftLeg = `Rig_${type}LegLeft`;
    const rightLeg = `Rig_${type}LegRight`;
    const leftArm = `Rig_${type}ArmLeft`;
    const rightArm = `Rig_${type}ArmRight`;
    const weapon = `Rig_${type}Weapon`;
    const accent = `Rig_${type}Accent`;
    const idle = [0, 0.65, 1.3, 1.95, 2.6];
    const walk = [0, 0.4, 0.8, 1.2, 1.6];
    const run = [0, 0.25, 0.5, 0.75, 1];
    const attack = [0, 0.24, 0.5, 0.78, 1.18];
    const death = [0, 0.38, 0.82, 1.3, 1.9];
    return [
        new THREE.AnimationClip('Idle', 2.6, [
            track(body, 'position[y]', idle, [bodyY, bodyY + 0.06, bodyY, bodyY - 0.035, bodyY]),
            track(body, 'rotation[y]', idle, [0, 0.025, 0, -0.025, 0]),
            track(head, 'rotation[y]', idle, [0, 0.1, 0, -0.1, 0]),
            track(leftArm, 'rotation[z]', idle, [-0.08, -0.15, -0.08, -0.01, -0.08]),
            track(rightArm, 'rotation[z]', idle, [0.08, 0.15, 0.08, 0.01, 0.08]),
            track(leftLeg, 'rotation[z]', idle, [0, 0.018, 0, -0.018, 0]),
            track(weapon, 'rotation[z]', idle, [-0.14, -0.08, -0.14, -0.22, -0.14]),
            track(accent, 'rotation[y]', idle, [0, 0.4, 0.8, 1.2, 1.6]),
            track(accent, 'position[y]', idle, [0.85, 0.93, 0.85, 0.78, 0.85])
        ]),
        new THREE.AnimationClip('Walk', 1.6, [
            track(body, 'position[y]', walk, [bodyY, bodyY + 0.1, bodyY, bodyY + 0.1, bodyY]),
            track(body, 'rotation[z]', walk, [0, 0.045, 0, -0.045, 0]),
            track(leftLeg, 'rotation[x]', walk, [stride, 0, -stride, 0, stride]),
            track(rightLeg, 'rotation[x]', walk, [-stride, 0, stride, 0, -stride]),
            track(leftArm, 'rotation[x]', walk, [-stride * 0.7, 0, stride * 0.7, 0, -stride * 0.7]),
            track(rightArm, 'rotation[x]', walk, [stride * 0.7, 0, -stride * 0.7, 0, stride * 0.7]),
            track(head, 'rotation[y]', walk, [0, -0.05, 0, 0.05, 0]),
            track(weapon, 'rotation[z]', walk, [-0.14, 0.02, -0.14, -0.32, -0.14]),
            track(accent, 'rotation[z]', walk, [0, 0.22, 0, -0.22, 0])
        ]),
        new THREE.AnimationClip('Run', 1, [
            track(body, 'position[y]', run, [bodyY, bodyY + 0.16, bodyY, bodyY + 0.16, bodyY]),
            track(body, 'rotation[x]', run, [0.1, 0.18, 0.1, 0.18, 0.1]),
            track(leftLeg, 'rotation[x]', run, [stride * 1.55, 0, -stride * 1.55, 0, stride * 1.55]),
            track(rightLeg, 'rotation[x]', run, [-stride * 1.55, 0, stride * 1.55, 0, -stride * 1.55]),
            track(leftArm, 'rotation[x]', run, [-stride, 0, stride, 0, -stride]),
            track(rightArm, 'rotation[x]', run, [stride, 0, -stride, 0, stride]),
            track(head, 'rotation[x]', run, [-0.04, 0.04, -0.04, 0.04, -0.04]),
            track(weapon, 'rotation[z]', run, [-0.14, 0.18, -0.14, -0.5, -0.14]),
            track(accent, 'rotation[z]', run, [0, 0.34, 0, -0.34, 0])
        ]),
        new THREE.AnimationClip('Attack', 1.18, [
            track(body, 'position[y]', attack, [bodyY, bodyY + 0.05, bodyY + 0.16, bodyY - 0.06, bodyY]),
            track(body, 'rotation[y]', attack, [0, -0.22, -0.55, 0.4, 0]),
            track(head, 'rotation[y]', attack, [0, 0.14, 0.26, -0.18, 0]),
            track(leftLeg, 'rotation[x]', attack, [0, 0.13, 0.26, -0.12, 0]),
            track(rightLeg, 'rotation[x]', attack, [0, -0.18, -0.32, 0.16, 0]),
            track(leftArm, 'rotation[x]', attack, [0, -0.32, -0.54, 0.3, 0]),
            track(rightArm, 'rotation[x]', attack, [0, -0.7 * reach, -1.25 * reach, 1.02 * reach, 0]),
            track(weapon, 'rotation[z]', attack, [-0.14, -0.9 * reach, -1.52 * reach, 1.08 * reach, -0.14]),
            track(accent, 'rotation[y]', attack, [0, -0.4, -0.9, 1, 0])
        ]),
        new THREE.AnimationClip('Death', 1.9, [
            track(body, 'position[y]', death, [bodyY, bodyY + 0.04, bodyY - 0.2, bodyY - fall * 0.74, bodyY - fall]),
            track(body, 'rotation[x]', death, [0, -0.1, 0.35, 0.98, 1.42]),
            track(body, 'rotation[z]', death, [0, 0.08, -0.24, -0.62, -0.86]),
            track(head, 'rotation[x]', death, [0, -0.14, 0.3, 0.68, 0.96]),
            track(leftLeg, 'rotation[x]', death, [0, 0.12, -0.25, -0.68, -0.96]),
            track(rightLeg, 'rotation[x]', death, [0, -0.13, 0.32, 0.78, 1.06]),
            track(leftArm, 'rotation[z]', death, [-0.08, -0.36, -0.74, -1.06, -1.25]),
            track(rightArm, 'rotation[z]', death, [0.08, 0.4, 0.8, 1.14, 1.3]),
            track(weapon, 'rotation[z]', death, [-0.14, 0.12, 0.62, 1.18, 1.52]),
            track(accent, 'rotation[z]', death, [0, -0.25, 0.55, 1.08, 1.4])
        ])
    ];
}

function createCindermawClips(bodyY) {
    const type = 'Cindermaw';
    const body = `Rig_${type}Body`;
    const head = `Rig_${type}Head`;
    const jaw = `Rig_${type}Weapon`;
    const tail = `Rig_${type}Accent`;
    const fl = `Rig_${type}LegFrontLeft`;
    const fr = `Rig_${type}LegFrontRight`;
    const bl = `Rig_${type}LegBackLeft`;
    const br = `Rig_${type}LegBackRight`;
    const t = [0, 0.5, 1, 1.5, 2];
    const attack = [0, 0.18, 0.42, 0.7, 1.05];
    const death = [0, 0.35, 0.72, 1.18, 1.7];
    const gait = (name, duration, stride, rise) => new THREE.AnimationClip(name, duration, [
        track(body, 'position[y]', t.map((value) => value * duration / 2), [bodyY, bodyY + rise, bodyY, bodyY + rise, bodyY]),
        track(body, 'rotation[z]', t.map((value) => value * duration / 2), [0, 0.045, 0, -0.045, 0]),
        track(fl, 'rotation[x]', t.map((value) => value * duration / 2), [stride, 0, -stride, 0, stride]),
        track(br, 'rotation[x]', t.map((value) => value * duration / 2), [stride, 0, -stride, 0, stride]),
        track(fr, 'rotation[x]', t.map((value) => value * duration / 2), [-stride, 0, stride, 0, -stride]),
        track(bl, 'rotation[x]', t.map((value) => value * duration / 2), [-stride, 0, stride, 0, -stride]),
        track(head, 'rotation[x]', t.map((value) => value * duration / 2), [0.08, -0.05, 0.08, -0.05, 0.08]),
        track(jaw, 'rotation[x]', t.map((value) => value * duration / 2), [0.12, 0.28, 0.12, 0.22, 0.12]),
        track(tail, 'rotation[y]', t.map((value) => value * duration / 2), [0.32, -0.32, 0.32, -0.32, 0.32])
    ]);
    return [
        new THREE.AnimationClip('Idle', 2, [
            track(body, 'position[y]', t, [bodyY, bodyY + 0.07, bodyY, bodyY - 0.035, bodyY]),
            track(body, 'rotation[y]', t, [0, 0.025, 0, -0.025, 0]),
            track(head, 'rotation[y]', t, [0, 0.12, 0, -0.12, 0]),
            track(fl, 'rotation[z]', t, [0, 0.025, 0, -0.025, 0]),
            track(fr, 'rotation[z]', t, [0, -0.025, 0, 0.025, 0]),
            track(jaw, 'rotation[x]', t, [0.12, 0.26, 0.12, 0.2, 0.12]),
            track(tail, 'rotation[y]', t, [0.2, -0.26, 0.2, -0.18, 0.2]),
            track(tail, 'rotation[z]', t, [0.1, 0.18, 0.1, 0.02, 0.1]),
            track(head, 'rotation[z]', t, [0, 0.04, 0, -0.04, 0])
        ]),
        gait('Walk', 1.5, 0.42, 0.1),
        gait('Run', 0.92, 0.72, 0.18),
        new THREE.AnimationClip('Attack', 1.05, [
            track(body, 'position[y]', attack, [bodyY, bodyY - 0.08, bodyY + 0.2, bodyY - 0.05, bodyY]),
            track(body, 'rotation[x]', attack, [0, -0.18, -0.3, 0.28, 0]),
            track(head, 'rotation[x]', attack, [0, -0.35, -0.52, 0.6, 0]),
            track(jaw, 'rotation[x]', attack, [0.12, 0.48, 0.72, -0.18, 0.12]),
            track(fl, 'rotation[x]', attack, [0, 0.22, 0.48, -0.25, 0]),
            track(fr, 'rotation[x]', attack, [0, 0.22, 0.48, -0.25, 0]),
            track(bl, 'rotation[x]', attack, [0, -0.12, -0.28, 0.2, 0]),
            track(br, 'rotation[x]', attack, [0, -0.12, -0.28, 0.2, 0]),
            track(tail, 'rotation[y]', attack, [0.2, -0.5, -0.8, 0.62, 0.2])
        ]),
        new THREE.AnimationClip('Death', 1.7, [
            track(body, 'position[y]', death, [bodyY, bodyY + 0.05, bodyY - 0.3, bodyY - 0.9, bodyY - 1.2]),
            track(body, 'rotation[z]', death, [0, 0.08, 0.35, 0.98, 1.35]),
            track(head, 'rotation[x]', death, [0, -0.1, 0.28, 0.72, 1.08]),
            track(jaw, 'rotation[x]', death, [0.12, 0.4, 0.62, 0.48, 0.3]),
            track(fl, 'rotation[x]', death, [0, 0.1, -0.4, -0.85, -1.1]),
            track(fr, 'rotation[x]', death, [0, -0.1, 0.42, 0.9, 1.1]),
            track(bl, 'rotation[x]', death, [0, 0.12, -0.35, -0.78, -1]),
            track(br, 'rotation[x]', death, [0, -0.12, 0.38, 0.82, 1.04]),
            track(tail, 'rotation[y]', death, [0.2, -0.25, 0.42, 0.8, 1.1])
        ])
    ];
}

export function createProceduralCindermaw() {
    const type = 'Cindermaw';
    const materials = createMaterials(type, PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addCalderaSeal(root, type, 1.75, materials, 14);
    const bodyY = 2.05;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    mesh(body, `${type}_RibKiln`, geometry('cindermaw-body', () => new THREE.DodecahedronGeometry(0.95, 0)), materials.basalt, { scale: [1.35, 1, 1.85] });
    addFurnaceCage(body, type, materials, 0.72, 1.25);
    const head = pivot(body, `Rig_${type}Head`, [0, 0.35, 1.55], [-0.08, 0, 0]);
    mesh(head, `${type}_MawSkull`, geometry('cindermaw-head', () => new THREE.DodecahedronGeometry(0.68, 0)), materials.iron, { scale: [1.15, 0.82, 1.25] });
    const jaw = pivot(head, `Rig_${type}Weapon`, [0, -0.25, 0.58], [0.12, 0, 0]);
    mesh(jaw, `${type}_LowerMaw`, geometry('cindermaw-jaw', () => new THREE.BoxGeometry(0.95, 0.22, 0.9)), materials.basalt, { position: [0, 0, 0.15] });
    const fang = geometry('cindermaw-fang', () => new THREE.ConeGeometry(0.085, 0.45, 5));
    for (let index = 0; index < 10; index += 1) {
        const upper = index < 5;
        mesh(upper ? head : jaw, `${type}_Fang${index + 1}`, fang, index % 3 === 0 ? materials.whitefire : materials.brass, {
            position: [((index % 5) - 2) * 0.18, upper ? -0.26 : 0.12, 0.76], rotation: [upper ? Math.PI : 0, 0, 0]
        });
    }
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        mesh(head, `${type}_Eye${side}`, geometry('cindermaw-eye', () => new THREE.OctahedronGeometry(0.11, 0)), materials.whitefire, { position: [sign * 0.31, 0.16, 0.62] });
        mesh(head, `${type}_Horn${side}`, geometry('cindermaw-horn', () => new THREE.ConeGeometry(0.14, 1.15, 5)), materials.brass, { position: [sign * 0.43, 0.32, -0.05], rotation: [-0.45, 0, sign * -0.45] });
    }
    const legGeo = geometry('cindermaw-leg', () => new THREE.CylinderGeometry(0.23, 0.31, 1.32, 6));
    for (const [positionName, x, z, phase] of [
        ['FrontLeft', 0.72, 0.92, 1], ['FrontRight', -0.72, 0.92, -1], ['BackLeft', 0.78, -0.95, -1], ['BackRight', -0.78, -0.95, 1]
    ]) {
        const leg = pivot(body, `Rig_${type}Leg${positionName}`, [x, -0.45, z], [phase * 0.04, 0, phase * 0.08]);
        mesh(leg, `${type}_${positionName}Upper`, legGeo, materials.iron, { position: [0, -0.48, 0] });
        mesh(leg, `${type}_${positionName}Lower`, legGeo, materials.basalt, { position: [0, -1.45, 0.08], scale: [0.82, 0.82, 0.82] });
        mesh(leg, `${type}_${positionName}Claw`, geometry('cindermaw-claw-foot', () => new THREE.BoxGeometry(0.5, 0.2, 0.72)), materials.brass, { position: [0, -2.05, 0.2] });
    }
    const tail = pivot(body, `Rig_${type}Accent`, [0, 0.1, -1.55], [0.1, 0.2, 0.1]);
    for (let index = 0; index < 7; index += 1) {
        mesh(tail, `${type}_ChainTail${index + 1}`, geometry(`cindermaw-tail-${index}`, () => new THREE.ConeGeometry(0.31 - index * 0.025, 0.78, 6)), index % 3 === 0 ? materials.ember : materials.basalt, {
            position: [0, 0.08 + index * 0.05, -index * 0.35], rotation: [Math.PI / 2 + 0.1, 0, 0], scale: [0.9, 0.8, 0.9]
        });
    }
    const spine = geometry('cindermaw-spine', () => new THREE.ConeGeometry(0.14, 0.68, 5));
    for (let index = 0; index < 9; index += 1) mesh(body, `${type}_CalderaSpine${index + 1}`, spine, index % 3 === 0 ? materials.ember : materials.iron, { position: [0, 0.72 + Math.sin(index) * 0.12, 1.1 - index * 0.3], rotation: [0.28, 0, 0] });
    addEmberCracks(body, type, materials, 12, 0.96, -0.45);
    return finalize(root, type, createCindermawClips(bodyY));
}

export function createProceduralScorchedTwins() {
    const type = 'ScorchedTwins';
    const materials = createMaterials(type, PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addCalderaSeal(root, type, 1.72, materials, 16);
    const frame = addBipedFrame(root, type, materials, { width: 1.08 });
    // One authoritative encounter actor, shown as two oathbound upper bodies orbiting a shared brand.
    frame.head.visible = false;
    for (const [name, sign] of [['Ember', 1], ['Cinder', -1]]) {
        const twin = pivot(frame.body, `${type}_${name}Twin`, [sign * 0.88, 1.48, -0.02], [0, sign * 0.1, sign * -0.06]);
        mesh(twin, `${type}_${name}Cuirass`, geometry('scorched-twin-cuirass', () => new THREE.DodecahedronGeometry(0.66, 0)), name === 'Ember' ? materials.iron : materials.ash, { scale: [0.92, 1.16, 0.72] });
        mesh(twin, `${type}_${name}Mask`, geometry('scorched-twin-mask', () => new THREE.OctahedronGeometry(0.43, 0)), name === 'Ember' ? materials.brass : materials.basalt, { position: [0, 1.02, 0.1], scale: [0.9, 1.12, 0.74] });
        mesh(twin, `${type}_${name}Eye`, geometry('scorched-twin-eye', () => new THREE.BoxGeometry(0.3, 0.085, 0.07)), name === 'Ember' ? materials.whitefire : materials.ember, { position: [0, 1.04, 0.45] });
        const innerArm = pivot(twin, `${type}_${name}InnerArm`, [sign * -0.52, 0.36, 0.02], [0, 0, sign * -0.26]);
        mesh(innerArm, `${type}_${name}InnerArmPlate`, geometry('scorched-inner-arm', () => new THREE.CylinderGeometry(0.14, 0.19, 0.9, 6)), name === 'Ember' ? materials.iron : materials.basalt, { position: [0, -0.42, 0] });
        mesh(twin, `${type}_${name}CrownFlame`, geometry('scorched-crown-flame', () => new THREE.ConeGeometry(0.16, 0.78, 5)), name === 'Ember' ? materials.whitefire : materials.ember, { position: [0, 1.63, -0.02] });
        for (let index = 0; index < 7; index += 1) mesh(twin, `${type}_${name}HaloBrand${index + 1}`, geometry('scorched-halo-brand', () => new THREE.ConeGeometry(0.085, 0.54, 4)), name === 'Ember' ? materials.whitefire : materials.ember, { position: [Math.sin(index * 0.9) * 0.58, 1.25 + Math.cos(index * 0.9) * 0.58, -0.08], rotation: [0, 0, -index * 0.9] });
    }
    mesh(frame.body, `${type}_CovenantBrand`, geometry('scorched-covenant-brand', () => new THREE.IcosahedronGeometry(0.34, 0)), materials.whitefire, { position: [0, 1.58, 0.68] });
    mesh(frame.weapon, `${type}_SplitGlaiveShaft`, geometry('scorched-glaive-shaft', () => new THREE.CylinderGeometry(0.075, 0.11, 2.85, 6)), materials.brass, { position: [0, -0.95, 0] });
    for (const [side, sign] of [['Ember', 1], ['Cinder', -1]]) mesh(frame.weapon, `${type}_${side}Glaive`, geometry('scorched-glaive', () => new THREE.ConeGeometry(0.38, 1.18, 4)), sign > 0 ? materials.whitefire : materials.ember, { position: [sign * 0.28, -2.28, 0], rotation: [0, 0, sign * 0.42] });
    addFurnaceCage(frame.body, type, materials, 0.58, 1.2);
    addEmberCracks(frame.body, type, materials, 14, 0.92, -0.55);
    return finalize(root, type, createBipedClips(type, 2.22, { stride: 0.38, reach: 1.08, fall: 0.82 }));
}

export function createProceduralForgemasterPyrax() {
    const type = 'ForgemasterPyrax';
    const materials = createMaterials(type, PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addCalderaSeal(root, type, 1.85, materials, 12);
    const frame = addBipedFrame(root, type, materials, { width: 1.34, bodyY: 2.34 });
    addFurnaceCage(frame.body, type, materials, 0.7, 1.46);
    addCrown(frame.head, type, materials, 7, 0.48, 0.92);
    const apron = geometry('pyrax-apron', () => new THREE.ConeGeometry(0.62, 1.8, 4));
    for (let index = 0; index < 5; index += 1) mesh(frame.body, `${type}_ChainApron${index + 1}`, apron, index % 2 ? materials.iron : materials.ash, { position: [(index - 2) * 0.34, -0.55, 0.38], rotation: [0.12, 0, (index - 2) * 0.06], scale: [0.75, 1 + index * 0.04, 0.42] });
    const chimney = geometry('pyrax-chimney', () => new THREE.CylinderGeometry(0.18, 0.25, 1.35, 6));
    for (let index = 0; index < 6; index += 1) {
        const sign = index % 2 ? 1 : -1;
        mesh(frame.accent, `${type}_BackChimney${index + 1}`, chimney, materials.iron, { position: [sign * (0.48 + Math.floor(index / 2) * 0.3), 0.52 + Math.floor(index / 2) * 0.36, -0.08], rotation: [-0.15, 0, sign * 0.11] });
        mesh(frame.accent, `${type}_ChimneyFlame${index + 1}`, geometry('pyrax-flame', () => new THREE.ConeGeometry(0.16, 0.62, 5)), index % 3 === 0 ? materials.whitefire : materials.ember, { position: [sign * (0.48 + Math.floor(index / 2) * 0.3), 1.48 + Math.floor(index / 2) * 0.36, -0.08] });
    }
    mesh(frame.weapon, `${type}_AnvilHammerShaft`, geometry('pyrax-hammer-shaft', () => new THREE.CylinderGeometry(0.13, 0.17, 3.1, 7)), materials.brass, { position: [0, -1.02, 0] });
    mesh(frame.weapon, `${type}_OathAnvilHammer`, geometry('pyrax-hammer', () => new THREE.BoxGeometry(1.75, 0.82, 0.95)), materials.iron, { position: [0, -2.48, 0] });
    mesh(frame.weapon, `${type}_HammerMouth`, geometry('pyrax-hammer-mouth', () => new THREE.BoxGeometry(0.72, 0.3, 1.02)), materials.whitefire, { position: [0, -2.48, 0.02] });
    addEmberCracks(frame.body, type, materials, 18, 1.12, -0.7);
    return finalize(root, type, createBipedClips(type, 2.34, { stride: 0.3, reach: 1.16, fall: 0.98 }));
}

export function createProceduralObsidianGuardian() {
    const type = 'ObsidianGuardian';
    const materials = createMaterials(type, PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addCalderaSeal(root, type, 2.05, materials, 14);
    const frame = addBipedFrame(root, type, materials, { width: 1.52, bodyY: 2.42 });
    addFurnaceCage(frame.body, type, materials, 0.62, 1.36);
    const shard = geometry('guardian-glass-shard', () => new THREE.ConeGeometry(0.27, 1.42, 5));
    for (let index = 0; index < 18; index += 1) {
        const angle = index / 18 * Math.PI * 2;
        mesh(frame.body, `${type}_BlackGlassShard${index + 1}`, shard, index % 5 === 0 ? materials.ember : materials.basalt, {
            position: [Math.sin(angle) * (1.08 + (index % 3) * 0.16), 0.42 + (index % 4) * 0.48, Math.cos(angle) * 0.75],
            rotation: [Math.sin(angle) * 0.34, angle, -Math.cos(angle) * 0.34],
            scale: [1, 0.85 + (index % 3) * 0.16, 0.8]
        });
    }
    for (let index = 0; index < 7; index += 1) mesh(frame.head, `${type}_CrestShard${index + 1}`, shard, index === 3 ? materials.whitefire : materials.basalt, { position: [(index - 3) * 0.2, 0.5 + Math.abs(index - 3) * -0.04, -0.05], rotation: [0, 0, (index - 3) * -0.13], scale: [0.72, 0.75 + (3 - Math.abs(index - 3)) * 0.12, 0.72] });
    mesh(frame.weapon, `${type}_BulwarkGrip`, geometry('guardian-grip', () => new THREE.CylinderGeometry(0.12, 0.16, 2.7, 6)), materials.brass, { position: [0, -0.92, 0] });
    mesh(frame.weapon, `${type}_BlackGlassBulwark`, geometry('guardian-bulwark', () => new THREE.CylinderGeometry(1.25, 1.42, 0.34, 8)), materials.basalt, { position: [0, -2.15, 0], rotation: [Math.PI / 2, 0, 0] });
    for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI / 4;
        mesh(frame.weapon, `${type}_BulwarkBrand${index + 1}`, geometry('guardian-brand', () => new THREE.BoxGeometry(0.09, 0.5, 0.08)), index % 2 ? materials.brass : materials.ember, { position: [Math.sin(angle) * 0.72, -2.15 + Math.cos(angle) * 0.72, 0.2], rotation: [0, 0, -angle] });
    }
    addEmberCracks(frame.body, type, materials, 16, 1.28, -0.62);
    return finalize(root, type, createBipedClips(type, 2.42, { stride: 0.27, reach: 1.04, fall: 1.02 }));
}

export function createProceduralLordInfernax() {
    const type = 'LordInfernax';
    const materials = createMaterials(type, PROCEDURAL_MOLTEN_BOSS_DEFINITIONS[type].palette);
    const root = new THREE.Group();
    addCalderaSeal(root, type, 2.35, materials, 18);
    const frame = addBipedFrame(root, type, materials, { width: 1.62, bodyY: 2.62 });
    addFurnaceCage(frame.body, type, materials, 0.88, 1.7);
    addCrown(frame.head, type, materials, 11, 0.65, 1.58);
    const mantle = geometry('infernax-mantle', () => new THREE.ConeGeometry(0.5, 1.75, 5));
    for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2;
        mesh(frame.body, `${type}_ThroneMantle${index + 1}`, mantle, index % 4 === 0 ? materials.brass : materials.basalt, { position: [Math.sin(angle) * 1.35, 1.08, Math.cos(angle) * 0.82], rotation: [Math.sin(angle) * 0.42, angle, -Math.cos(angle) * 0.42], scale: [1, 1 + (index % 3) * 0.16, 0.72] });
    }
    const censer = geometry('infernax-censer', () => new THREE.OctahedronGeometry(0.24, 0));
    for (let index = 0; index < 9; index += 1) {
        const angle = index / 9 * Math.PI * 2;
        mesh(frame.accent, `${type}_AshenCenser${index + 1}`, censer, index % 3 === 0 ? materials.whitefire : materials.ember, { position: [Math.sin(angle) * 1.7, 0.72 + Math.sin(angle * 2) * 0.32, Math.cos(angle) * 1.7], rotation: [angle, angle * 0.5, angle] });
    }
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) mesh(frame.head, `${type}_CrownHorn${side}`, geometry('infernax-horn', () => new THREE.ConeGeometry(0.19, 1.8, 6)), materials.basalt, { position: [sign * 0.52, 0.35, -0.08], rotation: [-0.32, 0, sign * -0.48] });
    mesh(frame.weapon, `${type}_ScepterShaft`, geometry('infernax-scepter', () => new THREE.CylinderGeometry(0.12, 0.17, 3.5, 7)), materials.brass, { position: [0, -1.18, 0] });
    mesh(frame.weapon, `${type}_CalderaScepter`, geometry('infernax-scepter-crown', () => new THREE.TorusKnotGeometry(0.46, 0.13, 32, 6, 2, 3)), materials.iron, { position: [0, -2.85, 0], rotation: [Math.PI / 2, 0, 0] });
    mesh(frame.weapon, `${type}_ScepterSun`, geometry('infernax-scepter-sun', () => new THREE.IcosahedronGeometry(0.3, 0)), materials.whitefire, { position: [0, -2.85, 0] });
    addEmberCracks(frame.body, type, materials, 22, 1.38, -0.72);
    return finalize(root, type, createBipedClips(type, 2.62, { stride: 0.25, reach: 1.22, fall: 1.12 }));
}

export function createProceduralMoltenBoss(type) {
    switch (type) {
        case 'Cindermaw': return createProceduralCindermaw();
        case 'ScorchedTwins': return createProceduralScorchedTwins();
        case 'ForgemasterPyrax': return createProceduralForgemasterPyrax();
        case 'ObsidianGuardian': return createProceduralObsidianGuardian();
        case 'LordInfernax': return createProceduralLordInfernax();
        default: throw new Error(`Unknown procedural Molten Core boss: ${type}`);
    }
}

export function getProceduralMoltenBossCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
