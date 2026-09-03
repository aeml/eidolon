import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_OVERWORLD_ENEMY_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS = Object.freeze({
    SandstormDjinn: Object.freeze({
        artStyle: 'Cinder Wastes ash-dune djinn', region: 'Cinder Wastes', faction: 'glasswind court',
        bounds: Object.freeze({ radius: 2.5, height: 5.4, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x251d1a, body: 0x806246, plate: 0x4f443b, accent: 0xc79555, glow: 0xffcb68, pale: 0xffe4aa })
    }),
    MagmaGolem: Object.freeze({
        artStyle: 'Cinder Wastes fault-heart golem', region: 'Cinder Wastes', faction: 'caldera bound',
        bounds: Object.freeze({ radius: 2.65, height: 5.3, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x1b1718, body: 0x3c3030, plate: 0x17191d, accent: 0x76382a, glow: 0xff4b1f, pale: 0xffbd54 })
    }),
    ScorchedWraith: Object.freeze({
        artStyle: 'Cinder Wastes cinder-shroud wraith', region: 'Cinder Wastes', faction: 'burnt procession',
        bounds: Object.freeze({ radius: 2.35, height: 5.8, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x181216, body: 0x33252b, plate: 0x594349, accent: 0x8c332c, glow: 0xff4f25, pale: 0xffca72 })
    }),
    InfernalBehemoth: Object.freeze({
        artStyle: 'Cinder Wastes horned kiln-behemoth', region: 'Cinder Wastes', faction: 'red furnace herd',
        bounds: Object.freeze({ radius: 3.4, height: 4.9, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x171315, body: 0x3e2825, plate: 0x211d20, accent: 0x7d3d2a, glow: 0xff3d1f, pale: 0xe3c28c })
    }),
    PhoenixSentinel: Object.freeze({
        artStyle: 'Cinder Wastes oathflame phoenix', region: 'Cinder Wastes', faction: 'last ember vigil',
        bounds: Object.freeze({ radius: 3.9, height: 5.9, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x21151a, body: 0x71362b, plate: 0xb15a2f, accent: 0xe9953f, glow: 0xffd05e, pale: 0xfff0b0 })
    }),
    StormHarpy: Object.freeze({
        artStyle: 'Stormcrown gale-talon harpy', region: 'Stormcrown Reach', faction: 'razor-wing eyrie',
        bounds: Object.freeze({ radius: 2.75, height: 5.35, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x161923, body: 0x38405a, plate: 0x66728c, accent: 0x7461a3, glow: 0x54dfff, pale: 0xe5f8ff })
    }),
    CloudElemental: Object.freeze({
        artStyle: 'Stormcrown captive-cloud elemental', region: 'Stormcrown Reach', faction: 'unbound weather',
        bounds: Object.freeze({ radius: 2.8, height: 5.4, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x1c2433, body: 0x728093, plate: 0xa8b2bf, accent: 0x625d91, glow: 0x66e7ff, pale: 0xf2fbff })
    }),
    ThunderRoc: Object.freeze({
        artStyle: 'Stormcrown conductor roc', region: 'Stormcrown Reach', faction: 'thunder brood',
        bounds: Object.freeze({ radius: 4.2, height: 5.75, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x161a29, body: 0x343d61, plate: 0x586887, accent: 0x765eb5, glow: 0x61eaff, pale: 0xe9faff })
    }),
    TempestGiant: Object.freeze({
        artStyle: 'Stormcrown thunder-cairn giant', region: 'Stormcrown Reach', faction: 'storm throne remnants',
        bounds: Object.freeze({ radius: 3.0, height: 7.1, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x151a26, body: 0x30384d, plate: 0x5f6e83, accent: 0x65539b, glow: 0x51dfff, pale: 0xecfaff })
    }),
    CycloneAvatar: Object.freeze({
        artStyle: 'Stormcrown hollow-cyclone avatar', region: 'Stormcrown Reach', faction: 'eye of the reach',
        bounds: Object.freeze({ radius: 3.25, height: 6.8, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ dark: 0x111722, body: 0x29354c, plate: 0x65758c, accent: 0x6955a7, glow: 0x4de9ff, pale: 0xf1fcff })
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

function createMaterials(type) {
    const palette = PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS[type].palette;
    return {
        dark: material(`${type}-dark`, palette.dark, { roughness: 0.95 }),
        body: material(`${type}-body`, palette.body, { roughness: 0.82 }),
        plate: material(`${type}-plate`, palette.plate, { roughness: 0.48, metalness: 0.55 }),
        accent: material(`${type}-accent`, palette.accent, { roughness: 0.7, metalness: 0.15 }),
        glow: material(`${type}-glow`, palette.glow, { roughness: 0.18, emissive: palette.glow, emissiveIntensity: 1.65 }),
        pale: material(`${type}-pale`, palette.pale, { roughness: 0.12, emissive: palette.pale, emissiveIntensity: 2.15 })
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
    const definition = PROCEDURAL_OVERWORLD_ENEMY_DEFINITIONS[type];
    root.updateMatrixWorld(true);
    const body = root.getObjectByName(`Rig_${type}Body`);
    const groundOffset = Math.max(0, -new THREE.Box3().setFromObject(root).min.y);
    if (groundOffset > 0 && body) {
        body.position.y += groundOffset;
        clips.flatMap((clip) => clip.tracks)
            .filter((entry) => entry.name === `Rig_${type}Body.position[y]`)
            .forEach((entry) => {
                for (let index = 0; index < entry.values.length; index += 1) entry.values[index] += groundOffset;
            });
        root.updateMatrixWorld(true);
    }
    Object.assign(root.userData, {
        proceduralEnemyFamily: true,
        proceduralOverworldFamily: definition.region === 'Cinder Wastes' ? 'cinder-wastes' : 'stormcrown-reach',
        proceduralActorType: type,
        artStyle: definition.artStyle,
        region: definition.region,
        faction: definition.faction,
        combatRadius: definition.combatRadius,
        interactionPadding: 0.75,
        sharedGeometry: true,
        bounds: definition.bounds,
        animations: clips
    });
    root.name = `Procedural${type}`;
    installRestPoseReset(root);
    return root;
}

function addRealmSeal(root, type, materials, radius, realm) {
    const segments = realm === 'fire' ? 9 : 12;
    mesh(root, `${type}_RealmSeal`, geometry(`${realm}-enemy-seal`, () => new THREE.RingGeometry(0.79, 0.88, segments)), materials.glow, {
        position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius], castShadow: false, receiveShadow: false
    });
    const markGeometry = geometry(`${realm}-enemy-seal-mark`, () => (
        realm === 'fire' ? new THREE.ConeGeometry(0.09, 0.48, 3) : new THREE.BoxGeometry(0.07, 0.08, 0.48)
    ));
    for (let index = 0; index < segments; index += 1) {
        const angle = index / segments * Math.PI * 2;
        mesh(root, `${type}_SealMark${index + 1}`, markGeometry, index % 3 === 0 ? materials.pale : materials.plate, {
            position: [Math.sin(angle) * radius * 0.67, 0.045, Math.cos(angle) * radius * 0.67],
            rotation: realm === 'fire' ? [-Math.PI / 2, 0, -angle] : [0, angle, 0],
            castShadow: false,
            receiveShadow: false
        });
    }
}

function addLimb(body, type, side, materials, options = {}) {
    const sign = side === 'Left' ? 1 : -1;
    const arm = options.arm === true;
    const width = options.width ?? 1;
    const limb = pivot(body, `Rig_${type}${arm ? 'Arm' : 'Leg'}${side}`, arm
        ? [sign * (options.shoulderX ?? 0.82) * width, options.shoulderY ?? 1.04, 0]
        : [sign * (options.hipX ?? 0.38) * width, options.hipY ?? -0.52, 0], [0, 0, arm ? sign * -0.08 : 0]);
    mesh(limb, `${type}_${arm ? 'UpperArm' : 'Thigh'}${side}`, geometry(`${type}-${arm ? 'arm' : 'leg'}-upper`, () => (
        new THREE.CylinderGeometry((arm ? 0.22 : 0.27) * width, (arm ? 0.18 : 0.23) * width, arm ? 0.9 : 0.82, 6)
    )), arm ? materials.body : materials.dark, { position: [0, arm ? -0.42 : -0.38, 0] });
    const joint = pivot(limb, `${type}_${arm ? 'Elbow' : 'Knee'}Pivot${side}`, [0, arm ? -0.84 : -0.76, 0]);
    mesh(joint, `${type}_${arm ? 'Elbow' : 'Knee'}${side}`, geometry(`${type}-${arm ? 'elbow' : 'knee'}`, () => new THREE.DodecahedronGeometry((arm ? 0.22 : 0.25) * width, 0)), materials.plate);
    mesh(joint, `${type}_${arm ? 'Forearm' : 'Shin'}${side}`, geometry(`${type}-${arm ? 'arm' : 'leg'}-lower`, () => (
        new THREE.CylinderGeometry((arm ? 0.19 : 0.22) * width, (arm ? 0.24 : 0.27) * width, arm ? 0.76 : 0.7, 6)
    )), materials.plate, { position: [0, arm ? -0.38 : -0.35, 0] });
    const end = pivot(joint, `${type}_${arm ? 'Hand' : 'Foot'}Pivot${side}`, [0, arm ? -0.76 : -0.7, arm ? 0 : 0.15]);
    mesh(end, `${type}_${arm ? 'Hand' : 'Foot'}${side}`, geometry(`${type}-${arm ? 'hand' : 'foot'}`, () => (
        new THREE.BoxGeometry((arm ? 0.4 : 0.52) * width, arm ? 0.34 : 0.22, (arm ? 0.35 : 0.72) * width)
    )), arm ? materials.dark : materials.plate, { position: [0, arm ? -0.1 : 0, arm ? 0 : 0.12] });
    return end;
}

function addBipedFrame(root, type, materials, options = {}) {
    const bodyY = options.bodyY ?? 2.05;
    const width = options.width ?? 1;
    const floating = options.floating === true;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    let leftLeg;
    let rightLeg;
    if (floating) {
        leftLeg = pivot(body, `Rig_${type}LegLeft`, [0.34 * width, -0.48, 0]);
        rightLeg = pivot(body, `Rig_${type}LegRight`, [-0.34 * width, -0.48, 0]);
        for (const [side, leg] of [['Left', leftLeg], ['Right', rightLeg]]) {
            mesh(leg, `${type}_Shroud${side}`, geometry(`${type}-shroud`, () => new THREE.ConeGeometry(0.38 * width, 1.7, 5)), materials.dark, {
                position: [0, -0.72, 0], scale: [1, 1, 0.7]
            });
            mesh(leg, `${type}_EmberTail${side}`, geometry(`${type}-tail`, () => new THREE.ConeGeometry(0.17 * width, 1.05, 5)), materials.glow, {
                position: [0, -1.55, 0], rotation: [0, 0, Math.PI]
            });
        }
    } else {
        leftLeg = addLimb(body, type, 'Left', materials, { width });
        rightLeg = addLimb(body, type, 'Right', materials, { width });
    }
    const leftHand = addLimb(body, type, 'Left', materials, { arm: true, width, shoulderX: 0.9, shoulderY: 1.02 });
    const rightHand = addLimb(body, type, 'Right', materials, { arm: true, width, shoulderX: 0.9, shoulderY: 1.02 });
    mesh(body, `${type}_Torso`, geometry(`${type}-torso`, () => new THREE.DodecahedronGeometry(0.82, 0)), materials.body, {
        position: [0, 0.52, 0], scale: [width, 1.18, 0.72]
    });
    mesh(body, `${type}_HeartCage`, geometry(`${type}-heart-cage`, () => new THREE.TorusGeometry(0.38, 0.07, 6, 10)), materials.plate, {
        position: [0, 0.56, 0.64], rotation: [Math.PI / 2, 0, 0], scale: [width, 1, 0.45]
    });
    mesh(body, `${type}_Heart`, geometry(`${type}-heart`, () => new THREE.IcosahedronGeometry(0.2, 0)), materials.glow, {
        position: [0, 0.56, 0.68], scale: [width, 1.15, 0.5]
    });
    const head = pivot(body, `Rig_${type}Head`, [0, 1.72, 0.04]);
    mesh(head, `${type}_Head`, geometry(`${type}-head`, () => new THREE.OctahedronGeometry(0.45, 0)), materials.dark, {
        scale: [width, 1.1, 0.84]
    });
    mesh(head, `${type}_Eyes`, geometry(`${type}-eyes`, () => new THREE.BoxGeometry(0.28 * width, 0.07, 0.06)), materials.pale, {
        position: [0, 0.04, 0.4]
    });
    const weapon = pivot(rightHand, `Rig_${type}Weapon`, [0, -0.12, 0], [0, 0, -0.15]);
    const accent = pivot(body, `Rig_${type}Accent`, [0, 0.52, -0.42]);
    return { bodyY, body, head, leftLeg, rightLeg, leftHand, rightHand, weapon, accent };
}

function createClips(type, bodyY, options = {}) {
    const stride = options.stride ?? 0.45;
    const reach = options.reach ?? 1;
    const fall = options.fall ?? 0.8;
    const body = `Rig_${type}Body`;
    const head = `Rig_${type}Head`;
    const leftLeg = `Rig_${type}LegLeft`;
    const rightLeg = `Rig_${type}LegRight`;
    const leftArm = `Rig_${type}ArmLeft`;
    const rightArm = `Rig_${type}ArmRight`;
    const weapon = `Rig_${type}Weapon`;
    const accent = `Rig_${type}Accent`;
    const idle = [0, 0.6, 1.2, 1.8, 2.4];
    const walk = [0, 0.36, 0.72, 1.08, 1.44];
    const run = [0, 0.23, 0.46, 0.69, 0.92];
    const attack = [0, 0.2, 0.44, 0.72, 1.06];
    const death = [0, 0.36, 0.76, 1.2, 1.72];
    return [
        new THREE.AnimationClip('Idle', 2.4, [
            track(body, 'position[y]', idle, [bodyY, bodyY + 0.07, bodyY, bodyY - 0.035, bodyY]),
            track(body, 'rotation[y]', idle, [0, 0.03, 0, -0.03, 0]),
            track(head, 'rotation[y]', idle, [0, 0.11, 0, -0.11, 0]),
            track(leftArm, 'rotation[z]', idle, [-0.08, -0.16, -0.08, 0, -0.08]),
            track(rightArm, 'rotation[z]', idle, [0.08, 0.16, 0.08, 0, 0.08]),
            track(leftLeg, 'rotation[z]', idle, [0, 0.025, 0, -0.025, 0]),
            track(weapon, 'rotation[z]', idle, [-0.15, -0.08, -0.15, -0.24, -0.15]),
            track(accent, 'rotation[y]', idle, [0, 0.5, 1, 1.5, 2]),
            track(accent, 'position[y]', idle, [0.52, 0.61, 0.52, 0.43, 0.52])
        ]),
        new THREE.AnimationClip('Walk', 1.44, [
            track(body, 'position[y]', walk, [bodyY, bodyY + 0.1, bodyY, bodyY + 0.1, bodyY]),
            track(body, 'rotation[z]', walk, [0, 0.045, 0, -0.045, 0]),
            track(leftLeg, 'rotation[x]', walk, [stride, 0, -stride, 0, stride]),
            track(rightLeg, 'rotation[x]', walk, [-stride, 0, stride, 0, -stride]),
            track(leftArm, 'rotation[x]', walk, [-stride * 0.7, 0, stride * 0.7, 0, -stride * 0.7]),
            track(rightArm, 'rotation[x]', walk, [stride * 0.7, 0, -stride * 0.7, 0, stride * 0.7]),
            track(head, 'rotation[y]', walk, [0, -0.05, 0, 0.05, 0]),
            track(weapon, 'rotation[z]', walk, [-0.15, 0.02, -0.15, -0.34, -0.15]),
            track(accent, 'rotation[z]', walk, [0, 0.24, 0, -0.24, 0])
        ]),
        new THREE.AnimationClip('Run', 0.92, [
            track(body, 'position[y]', run, [bodyY, bodyY + 0.17, bodyY, bodyY + 0.17, bodyY]),
            track(body, 'rotation[x]', run, [0.1, 0.18, 0.1, 0.18, 0.1]),
            track(leftLeg, 'rotation[x]', run, [stride * 1.55, 0, -stride * 1.55, 0, stride * 1.55]),
            track(rightLeg, 'rotation[x]', run, [-stride * 1.55, 0, stride * 1.55, 0, -stride * 1.55]),
            track(leftArm, 'rotation[x]', run, [-stride, 0, stride, 0, -stride]),
            track(rightArm, 'rotation[x]', run, [stride, 0, -stride, 0, stride]),
            track(head, 'rotation[x]', run, [-0.04, 0.05, -0.04, 0.05, -0.04]),
            track(weapon, 'rotation[z]', run, [-0.15, 0.18, -0.15, -0.5, -0.15]),
            track(accent, 'rotation[z]', run, [0, 0.38, 0, -0.38, 0])
        ]),
        new THREE.AnimationClip('Attack', 1.06, [
            track(body, 'position[y]', attack, [bodyY, bodyY + 0.05, bodyY + 0.16, bodyY - 0.05, bodyY]),
            track(body, 'rotation[y]', attack, [0, -0.22, -0.52, 0.4, 0]),
            track(head, 'rotation[y]', attack, [0, 0.13, 0.25, -0.17, 0]),
            track(leftLeg, 'rotation[x]', attack, [0, 0.14, 0.26, -0.12, 0]),
            track(rightLeg, 'rotation[x]', attack, [0, -0.18, -0.32, 0.15, 0]),
            track(leftArm, 'rotation[x]', attack, [0, -0.32, -0.54, 0.29, 0]),
            track(rightArm, 'rotation[x]', attack, [0, -0.68 * reach, -1.22 * reach, 1.02 * reach, 0]),
            track(weapon, 'rotation[z]', attack, [-0.15, -0.9 * reach, -1.5 * reach, 1.06 * reach, -0.15]),
            track(accent, 'rotation[y]', attack, [0, -0.4, -0.88, 1, 0])
        ]),
        new THREE.AnimationClip('Death', 1.72, [
            track(body, 'position[y]', death, [bodyY, bodyY + 0.04, bodyY - 0.18, bodyY - fall * 0.7, bodyY - fall]),
            track(body, 'rotation[x]', death, [0, -0.1, 0.34, 0.96, 1.4]),
            track(body, 'rotation[z]', death, [0, 0.07, -0.23, -0.61, -0.86]),
            track(head, 'rotation[x]', death, [0, -0.14, 0.3, 0.67, 0.96]),
            track(leftLeg, 'rotation[x]', death, [0, 0.1, -0.25, -0.68, -0.95]),
            track(rightLeg, 'rotation[x]', death, [0, -0.12, 0.31, 0.76, 1.04]),
            track(leftArm, 'rotation[z]', death, [-0.08, -0.34, -0.72, -1.05, -1.22]),
            track(rightArm, 'rotation[z]', death, [0.08, 0.38, 0.76, 1.1, 1.28]),
            track(weapon, 'rotation[z]', death, [-0.15, 0.1, 0.58, 1.14, 1.48]),
            track(accent, 'rotation[z]', death, [0, -0.24, 0.5, 1.04, 1.38])
        ])
    ];
}

function addOrbit(parent, type, materials, count, radius, shape = 'shard') {
    const orbitGeometry = geometry(`${type}-${shape}`, () => (
        shape === 'orb' ? new THREE.IcosahedronGeometry(0.13, 0) : new THREE.ConeGeometry(0.09, 0.65, 4)
    ));
    for (let index = 0; index < count; index += 1) {
        const angle = index / count * Math.PI * 2;
        mesh(parent, `${type}_${shape}${index + 1}`, orbitGeometry, index % 4 === 0 ? materials.pale : materials.glow, {
            position: [Math.sin(angle) * radius, Math.sin(angle * 2) * 0.24, Math.cos(angle) * radius],
            rotation: [0, angle, shape === 'orb' ? 0 : angle]
        });
    }
}

function addCrown(parent, type, materials, count, radius, height) {
    const crownGeometry = geometry(`${type}-crown`, () => new THREE.ConeGeometry(0.1, height, 5));
    for (let index = 0; index < count; index += 1) {
        const angle = index / count * Math.PI * 2;
        mesh(parent, `${type}_Crown${index + 1}`, crownGeometry, index % 3 === 0 ? materials.pale : materials.accent, {
            position: [Math.sin(angle) * radius, 0.42 + (index % 2) * 0.08, Math.cos(angle) * radius],
            rotation: [Math.sin(angle) * 0.2, 0, -Math.cos(angle) * 0.2]
        });
    }
}

function addWing(parent, type, side, materials, options = {}) {
    const sign = side === 'Left' ? 1 : -1;
    const count = options.count ?? 10;
    const length = options.length ?? 1.8;
    const wing = pivot(parent, `Rig_${type}Arm${side}`, [sign * (options.rootX ?? 0.52), options.rootY ?? 0.45, -0.08], [0, sign * -0.12, sign * -0.18]);
    const featherGeometry = geometry(`${type}-wing-feather`, () => new THREE.ConeGeometry(options.width ?? 0.16, length, 5));
    for (let index = 0; index < count; index += 1) {
        const sweep = index / Math.max(1, count - 1);
        mesh(wing, `${type}_${side}Feather${index + 1}`, featherGeometry, index % 4 === 0 ? materials.glow : (index % 2 ? materials.body : materials.plate), {
            position: [sign * (0.22 + index * 0.18), -0.15 - sweep * 0.55, -sweep * 0.24],
            rotation: [0.12 + sweep * 0.12, 0, sign * (Math.PI / 2 + 0.08 + sweep * 0.1)],
            scale: [1, 0.7 + sweep * 0.45, 0.6]
        });
    }
    return wing;
}

function createBird(type, options = {}) {
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, options.sealRadius ?? 1.35, options.realm || 'air');
    const bodyY = options.bodyY ?? 2.2;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0], [0.08, 0, 0]);
    const leftLeg = pivot(body, `Rig_${type}LegLeft`, [0.28, -0.65, 0.12]);
    const rightLeg = pivot(body, `Rig_${type}LegRight`, [-0.28, -0.65, 0.12]);
    for (const [side, leg, sign] of [['Left', leftLeg, 1], ['Right', rightLeg, -1]]) {
        mesh(leg, `${type}_TalonLeg${side}`, geometry(`${type}-talon-leg`, () => new THREE.CylinderGeometry(0.08, 0.11, 0.72, 6)), materials.plate, { position: [0, -0.34, 0] });
        for (let claw = 0; claw < 3; claw += 1) {
            mesh(leg, `${type}_Talon${side}${claw + 1}`, geometry(`${type}-talon`, () => new THREE.ConeGeometry(0.055, 0.42, 5)), materials.pale, {
                position: [(claw - 1) * 0.13, -0.77, 0.17 + Math.abs(claw - 1) * 0.06],
                rotation: [Math.PI / 2 + 0.25, 0, sign * (claw - 1) * 0.12]
            });
        }
    }
    mesh(body, `${type}_Breast`, geometry(`${type}-bird-body`, () => new THREE.DodecahedronGeometry(options.bodyRadius ?? 0.72, 0)), materials.body, {
        scale: [1, 1.22, 0.78]
    });
    mesh(body, `${type}_BreastKeel`, geometry(`${type}-bird-keel`, () => new THREE.ConeGeometry(0.18, 1.25, 5)), materials.glow, {
        position: [0, -0.05, 0.63], rotation: [0, 0, Math.PI], scale: [1, 1, 0.55]
    });
    const head = pivot(body, `Rig_${type}Head`, [0, 0.96, 0.3], [-0.12, 0, 0]);
    mesh(head, `${type}_Head`, geometry(`${type}-bird-head`, () => new THREE.DodecahedronGeometry(0.42, 0)), materials.dark, { scale: [1, 0.92, 1.05] });
    mesh(head, `${type}_Beak`, geometry(`${type}-beak`, () => new THREE.ConeGeometry(0.17, 0.72, 5)), materials.pale, { position: [0, -0.04, 0.58], rotation: [Math.PI / 2, 0, 0] });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        mesh(head, `${type}_Eye${side}`, geometry(`${type}-bird-eye`, () => new THREE.OctahedronGeometry(0.065, 0)), materials.glow, { position: [sign * 0.17, 0.1, 0.36] });
    }
    addWing(body, type, 'Left', materials, options.wing);
    addWing(body, type, 'Right', materials, options.wing);
    const weapon = pivot(head, `Rig_${type}Weapon`, [0, -0.04, 0.56], [0, 0, -0.15]);
    const accent = pivot(body, `Rig_${type}Accent`, [0, -0.24, -0.55]);
    const tailGeometry = geometry(`${type}-tail-feather`, () => new THREE.ConeGeometry(0.14, options.tailLength ?? 1.6, 5));
    const tailCount = options.tailCount ?? 9;
    for (let index = 0; index < tailCount; index += 1) {
        const x = (index - (tailCount - 1) / 2) * 0.18;
        mesh(accent, `${type}_TailFeather${index + 1}`, tailGeometry, index % 3 === 0 ? materials.glow : materials.accent, {
            position: [x, -0.55 - Math.abs(x) * 0.2, -0.35],
            rotation: [Math.PI * 0.72, 0, -x * 0.18],
            scale: [1, 0.8 + (tailCount - Math.abs(index - (tailCount - 1) / 2)) * 0.035, 0.65]
        });
    }
    addCrown(head, type, materials, options.crownCount ?? 7, 0.38, options.crownHeight ?? 0.78);
    addOrbit(accent, type, materials, options.orbitCount ?? 8, options.orbitRadius ?? 1.25, 'orb');
    return finalize(root, type, createClips(type, bodyY, { stride: options.stride ?? 0.72, reach: options.reach ?? 1.12, fall: 0.7 }));
}

export function createProceduralSandstormDjinn() {
    const type = 'SandstormDjinn';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.35, 'fire');
    const frame = addBipedFrame(root, type, materials, { floating: true, width: 0.9, bodyY: 2.15 });
    for (let index = 0; index < 9; index += 1) {
        mesh(frame.body, `${type}_GlasswindVeil${index + 1}`, geometry(`${type}-veil`, () => new THREE.ConeGeometry(0.13, 1.3, 4)), index % 3 === 0 ? materials.glow : materials.accent, {
            position: [(index - 4) * 0.18, 0.35 + Math.abs(index - 4) * 0.03, -0.35],
            rotation: [0.25, 0, (index - 4) * 0.06]
        });
    }
    for (let index = 0; index < 7; index += 1) {
        mesh(frame.body, `${type}_SandRing${index + 1}`, geometry(`${type}-sand-ring-${index}`, () => new THREE.TorusGeometry(0.58 + index * 0.12, 0.045, 5, 14)), index % 2 ? materials.accent : materials.glow, {
            position: [0, -1.25 + index * 0.23, 0], rotation: [Math.PI / 2 + index * 0.11, index * 0.08, index * 0.28]
        });
    }
    addCrown(frame.head, type, materials, 7, 0.43, 0.92);
    addOrbit(frame.accent, type, materials, 12, 1.45);
    mesh(frame.weapon, `${type}_GlassScimitar`, geometry(`${type}-scimitar`, () => new THREE.TorusGeometry(0.72, 0.1, 6, 16, Math.PI * 1.25)), materials.pale, {
        position: [0, -0.72, 0], rotation: [Math.PI / 2, 0, 0.4]
    });
    return finalize(root, type, createClips(type, frame.bodyY, { stride: 0.58, reach: 1.14, fall: 0.65 }));
}

export function createProceduralMagmaGolem() {
    const type = 'MagmaGolem';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.55, 'fire');
    const frame = addBipedFrame(root, type, materials, { width: 1.42, bodyY: 2.2 });
    const slabGeometry = geometry(`${type}-fault-slab`, () => new THREE.BoxGeometry(0.58, 0.62, 0.26));
    for (let index = 0; index < 18; index += 1) {
        const angle = index / 18 * Math.PI * 2;
        mesh(frame.body, `${type}_FaultSlab${index + 1}`, slabGeometry, index % 5 === 0 ? materials.accent : materials.dark, {
            position: [Math.sin(angle) * 1.02, -0.05 + (index % 6) * 0.36, Math.cos(angle) * 0.62],
            rotation: [0, angle, Math.sin(angle) * 0.12]
        });
    }
    for (const [side, hand] of [['Left', frame.leftHand], ['Right', frame.rightHand]]) {
        mesh(hand, `${type}_MagmaFist${side}`, geometry(`${type}-magma-fist`, () => new THREE.DodecahedronGeometry(0.52, 0)), materials.plate, { position: [0, -0.35, 0], scale: [1.15, 0.9, 1] });
        addOrbit(hand, `${type}${side}Fist`, materials, 5, 0.58, 'orb');
    }
    addCrown(frame.head, type, materials, 8, 0.5, 1.02);
    addOrbit(frame.accent, type, materials, 10, 1.55, 'orb');
    mesh(frame.weapon, `${type}_FaultHammer`, geometry(`${type}-hammer`, () => new THREE.BoxGeometry(1.15, 0.72, 0.7)), materials.dark, { position: [0, -0.92, 0] });
    return finalize(root, type, createClips(type, frame.bodyY, { stride: 0.31, reach: 1.12, fall: 0.98 }));
}

export function createProceduralScorchedWraith() {
    const type = 'ScorchedWraith';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.4, 'fire');
    const frame = addBipedFrame(root, type, materials, { floating: true, width: 1.05, bodyY: 2.45 });
    const ribGeometry = geometry(`${type}-rib`, () => new THREE.TorusGeometry(0.55, 0.055, 5, 10, Math.PI));
    for (let index = 0; index < 8; index += 1) {
        mesh(frame.body, `${type}_BurntRib${index + 1}`, ribGeometry, index % 2 ? materials.plate : materials.accent, {
            position: [0, 0.05 + index * 0.16, 0.3], rotation: [Math.PI / 2, 0, index % 2 ? Math.PI : 0], scale: [1 - index * 0.025, 1, 1]
        });
    }
    addCrown(frame.head, type, materials, 9, 0.48, 1.2);
    addOrbit(frame.accent, type, materials, 11, 1.42);
    mesh(frame.weapon, `${type}_CinderScythe`, geometry(`${type}-scythe`, () => new THREE.TorusGeometry(0.8, 0.11, 6, 18, Math.PI * 1.35)), materials.pale, {
        position: [0, -0.95, 0], rotation: [Math.PI / 2, 0, 0.34]
    });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        mesh(frame.body, `${type}_CenserChain${side}`, geometry(`${type}-censer-chain`, () => new THREE.CylinderGeometry(0.035, 0.035, 1.65, 5)), materials.plate, {
            position: [sign * 0.72, -0.28, -0.3], rotation: [0, 0, sign * 0.22]
        });
        mesh(frame.body, `${type}_CinderCenser${side}`, geometry(`${type}-censer`, () => new THREE.OctahedronGeometry(0.24, 0)), materials.glow, { position: [sign * 0.9, -1.1, -0.3] });
    }
    return finalize(root, type, createClips(type, frame.bodyY, { stride: 0.52, reach: 1.18, fall: 0.7 }));
}

export function createProceduralInfernalBehemoth() {
    const type = 'InfernalBehemoth';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.85, 'fire');
    const bodyY = 1.7;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0], [0.03, 0, 0]);
    mesh(body, `${type}_KilnBody`, geometry(`${type}-body`, () => new THREE.DodecahedronGeometry(1.18, 0)), materials.body, { scale: [1.35, 0.88, 1.55] });
    mesh(body, `${type}_FurnaceRibs`, geometry(`${type}-ribs`, () => new THREE.TorusGeometry(0.72, 0.13, 7, 12)), materials.plate, { position: [0, 0.08, 1.08], rotation: [Math.PI / 2, 0, 0], scale: [1.4, 1, 0.55] });
    mesh(body, `${type}_KilnHeart`, geometry(`${type}-heart`, () => new THREE.IcosahedronGeometry(0.36, 0)), materials.glow, { position: [0, 0.08, 1.12], scale: [1.25, 1, 0.5] });
    const head = pivot(body, `Rig_${type}Head`, [0, 0.45, 1.55], [-0.08, 0, 0]);
    mesh(head, `${type}_BullSkull`, geometry(`${type}-skull`, () => new THREE.DodecahedronGeometry(0.72, 0)), materials.dark, { scale: [1.25, 0.88, 1.15] });
    const hornGeometry = geometry(`${type}-horn`, () => new THREE.ConeGeometry(0.16, 1.35, 6));
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        mesh(head, `${type}_KilnHorn${side}`, hornGeometry, materials.pale, { position: [sign * 0.72, 0.35, 0.02], rotation: [0, 0, sign * -1.08] });
        mesh(head, `${type}_Eye${side}`, geometry(`${type}-eye`, () => new THREE.OctahedronGeometry(0.09, 0)), materials.glow, { position: [sign * 0.28, 0.12, 0.62] });
        mesh(head, `${type}_Tusk${side}`, geometry(`${type}-tusk`, () => new THREE.ConeGeometry(0.1, 0.7, 5)), materials.pale, { position: [sign * 0.4, -0.32, 0.64], rotation: [0.35, 0, sign * -0.1] });
    }
    const legs = [];
    for (const [name, x, z] of [['Left', 0.72, 0.62], ['Right', -0.72, 0.62], ['HindLeft', 0.72, -0.68], ['HindRight', -0.72, -0.68]]) {
        const leg = pivot(body, `Rig_${type}${name.startsWith('Hind') ? name : `Leg${name}`}`, [x, -0.45, z]);
        mesh(leg, `${type}_${name}UpperLeg`, geometry(`${type}-quadruped-leg`, () => new THREE.CylinderGeometry(0.32, 0.4, 1.12, 7)), materials.dark, { position: [0, -0.5, 0] });
        mesh(leg, `${type}_${name}ClovenHoof`, geometry(`${type}-hoof`, () => new THREE.BoxGeometry(0.58, 0.28, 0.86)), materials.plate, { position: [0, -1.18, 0.16] });
        legs.push(leg);
    }
    const leftArm = pivot(body, `Rig_${type}ArmLeft`, [0.72, 0.3, 0.75]);
    const rightArm = pivot(body, `Rig_${type}ArmRight`, [-0.72, 0.3, 0.75]);
    mesh(leftArm, `${type}_ShoulderBrandLeft`, geometry(`${type}-shoulder-brand`, () => new THREE.OctahedronGeometry(0.28, 0)), materials.glow);
    mesh(rightArm, `${type}_ShoulderBrandRight`, geometry(`${type}-shoulder-brand`, () => new THREE.OctahedronGeometry(0.28, 0)), materials.glow);
    const weapon = pivot(head, `Rig_${type}Weapon`, [0, -0.18, 0.62], [0, 0, -0.15]);
    const accent = pivot(body, `Rig_${type}Accent`, [0, 0.65, -0.82]);
    const spineGeometry = geometry(`${type}-spine`, () => new THREE.ConeGeometry(0.14, 0.85, 5));
    for (let index = 0; index < 11; index += 1) {
        mesh(accent, `${type}_CalderaSpine${index + 1}`, spineGeometry, index % 3 === 0 ? materials.glow : materials.accent, {
            position: [0, 0.3 + Math.sin(index / 10 * Math.PI) * 0.35, 0.75 - index * 0.16], rotation: [-0.35, 0, 0]
        });
    }
    addOrbit(accent, type, materials, 8, 1.28, 'orb');
    return finalize(root, type, createClips(type, bodyY, { stride: 0.3, reach: 1.18, fall: 0.82 }));
}

export function createProceduralPhoenixSentinel() {
    return createBird('PhoenixSentinel', {
        realm: 'fire', bodyY: 2.35, bodyRadius: 0.76, sealRadius: 1.45,
        wing: { count: 12, length: 2.05, width: 0.18, rootX: 0.54, rootY: 0.42 },
        tailCount: 11, tailLength: 2.05, crownCount: 9, crownHeight: 1.05, orbitCount: 10, orbitRadius: 1.42, stride: 0.78
    });
}

export function createProceduralStormHarpy() {
    const type = 'StormHarpy';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.25, 'air');
    const bodyY = 2.15;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    const leftLeg = pivot(body, `Rig_${type}LegLeft`, [0.28, -0.55, 0.05]);
    const rightLeg = pivot(body, `Rig_${type}LegRight`, [-0.28, -0.55, 0.05]);
    for (const [side, leg] of [['Left', leftLeg], ['Right', rightLeg]]) {
        mesh(leg, `${type}_TalonLeg${side}`, geometry(`${type}-leg`, () => new THREE.CylinderGeometry(0.09, 0.13, 0.95, 6)), materials.plate, { position: [0, -0.45, 0] });
        for (let claw = 0; claw < 3; claw += 1) {
            mesh(leg, `${type}_Talon${side}${claw + 1}`, geometry(`${type}-claw`, () => new THREE.ConeGeometry(0.05, 0.38, 5)), materials.pale, { position: [(claw - 1) * 0.12, -1, 0.16], rotation: [Math.PI / 2, 0, 0] });
        }
    }
    mesh(body, `${type}_ArmoredTorso`, geometry(`${type}-torso`, () => new THREE.DodecahedronGeometry(0.64, 0)), materials.body, { position: [0, 0.35, 0], scale: [0.86, 1.25, 0.7] });
    mesh(body, `${type}_StormKeel`, geometry(`${type}-keel`, () => new THREE.ConeGeometry(0.14, 1.05, 5)), materials.glow, { position: [0, 0.26, 0.57], rotation: [0, 0, Math.PI] });
    const head = pivot(body, `Rig_${type}Head`, [0, 1.22, 0.05]);
    mesh(head, `${type}_GaleMask`, geometry(`${type}-mask`, () => new THREE.OctahedronGeometry(0.39, 0)), materials.dark, { scale: [0.86, 1.1, 0.8] });
    mesh(head, `${type}_EyeSlit`, geometry(`${type}-eyes`, () => new THREE.BoxGeometry(0.28, 0.06, 0.05)), materials.pale, { position: [0, 0.04, 0.35] });
    const leftWing = addWing(body, type, 'Left', materials, { count: 9, length: 1.45, width: 0.13, rootX: 0.38, rootY: 0.58 });
    const rightWing = addWing(body, type, 'Right', materials, { count: 9, length: 1.45, width: 0.13, rootX: 0.38, rootY: 0.58 });
    const weapon = pivot(rightWing, `Rig_${type}Weapon`, [-0.25, -0.2, 0], [0, 0, -0.15]);
    mesh(weapon, `${type}_LightningJavelin`, geometry(`${type}-javelin`, () => new THREE.CylinderGeometry(0.05, 0.08, 2.35, 6)), materials.pale, { position: [0, -0.85, 0] });
    const accent = pivot(leftWing, `Rig_${type}Accent`, [0.2, 0, -0.25]);
    addOrbit(accent, type, materials, 9, 1.18);
    addCrown(head, type, materials, 7, 0.36, 0.82);
    return finalize(root, type, createClips(type, bodyY, { stride: 0.72, reach: 1.16, fall: 0.65 }));
}

export function createProceduralCloudElemental() {
    const type = 'CloudElemental';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.5, 'air');
    const frame = addBipedFrame(root, type, materials, { floating: true, width: 1.22, bodyY: 2.35 });
    for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2;
        mesh(frame.body, `${type}_CloudCairn${index + 1}`, geometry(`${type}-cloud`, () => new THREE.DodecahedronGeometry(0.42, 0)), index % 4 === 0 ? materials.pale : materials.body, {
            position: [Math.sin(angle) * (0.72 + (index % 3) * 0.16), -0.25 + (index % 5) * 0.42, Math.cos(angle) * 0.58],
            scale: [1.3, 0.72, 0.86]
        });
    }
    for (let index = 0; index < 8; index += 1) {
        mesh(frame.body, `${type}_PressureRing${index + 1}`, geometry(`${type}-ring-${index}`, () => new THREE.TorusGeometry(0.64 + index * 0.13, 0.045, 5, 16)), index % 3 === 0 ? materials.pale : materials.glow, {
            position: [0, -1.15 + index * 0.23, 0], rotation: [Math.PI / 2 + index * 0.12, index * 0.09, index * 0.25]
        });
    }
    addOrbit(frame.accent, type, materials, 12, 1.55, 'orb');
    addCrown(frame.head, type, materials, 6, 0.48, 0.86);
    mesh(frame.weapon, `${type}_StormCore`, geometry(`${type}-weapon-core`, () => new THREE.IcosahedronGeometry(0.42, 0)), materials.pale, { position: [0, -0.75, 0] });
    return finalize(root, type, createClips(type, frame.bodyY, { stride: 0.6, reach: 1.08, fall: 0.58 }));
}

export function createProceduralThunderRoc() {
    return createBird('ThunderRoc', {
        realm: 'air', bodyY: 2.3, bodyRadius: 0.8, sealRadius: 1.5,
        wing: { count: 13, length: 2.2, width: 0.18, rootX: 0.56, rootY: 0.43 },
        tailCount: 9, tailLength: 1.75, crownCount: 8, crownHeight: 0.92, orbitCount: 12, orbitRadius: 1.52, stride: 0.8
    });
}

export function createProceduralTempestGiant() {
    const type = 'TempestGiant';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.75, 'air');
    const frame = addBipedFrame(root, type, materials, { width: 1.55, bodyY: 2.55 });
    const slabGeometry = geometry(`${type}-cairn`, () => new THREE.BoxGeometry(0.72, 0.88, 0.28));
    for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        mesh(frame.body, `${type}_ThunderCairn${index + 1}`, slabGeometry, index % 4 === 0 ? materials.accent : materials.dark, {
            position: [Math.sin(angle) * 1.18, 0.15 + (index % 5) * 0.47, Math.cos(angle) * 0.72], rotation: [0, angle, Math.sin(angle) * 0.12]
        });
    }
    const rodGeometry = geometry(`${type}-rod`, () => new THREE.CylinderGeometry(0.055, 0.08, 1.6, 6));
    for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2;
        mesh(frame.body, `${type}_Conductor${index + 1}`, rodGeometry, index % 3 === 0 ? materials.pale : materials.plate, {
            position: [Math.sin(angle) * 1.12, 1.82 + (index % 2) * 0.22, Math.cos(angle) * 0.58], rotation: [Math.sin(angle) * 0.22, 0, -Math.cos(angle) * 0.22]
        });
    }
    addCrown(frame.head, type, materials, 9, 0.58, 1.18);
    addOrbit(frame.accent, type, materials, 12, 1.75, 'orb');
    mesh(frame.weapon, `${type}_ThunderMaulShaft`, geometry(`${type}-maul-shaft`, () => new THREE.CylinderGeometry(0.1, 0.14, 2.8, 7)), materials.plate, { position: [0, -0.98, 0] });
    mesh(frame.weapon, `${type}_ThunderMaul`, geometry(`${type}-maul`, () => new THREE.CylinderGeometry(0.58, 0.68, 1.22, 8)), materials.dark, { position: [0, -2.42, 0], rotation: [0, 0, Math.PI / 2] });
    return finalize(root, type, createClips(type, frame.bodyY, { stride: 0.3, reach: 1.2, fall: 1.02 }));
}

export function createProceduralCycloneAvatar() {
    const type = 'CycloneAvatar';
    const materials = createMaterials(type);
    const root = new THREE.Group();
    addRealmSeal(root, type, materials, 1.8, 'air');
    const frame = addBipedFrame(root, type, materials, { floating: true, width: 1.25, bodyY: 2.45 });
    for (let index = 0; index < 11; index += 1) {
        mesh(frame.body, `${type}_CycloneRing${index + 1}`, geometry(`${type}-cyclone-ring-${index}`, () => new THREE.TorusGeometry(0.62 + index * 0.13, 0.05, 5, 18)), index % 3 === 0 ? materials.pale : materials.glow, {
            position: [0, -1.25 + index * 0.24, 0], rotation: [Math.PI / 2 + index * 0.12, index * 0.1, index * 0.29]
        });
    }
    const bladeGeometry = geometry(`${type}-horizon-blade`, () => new THREE.ConeGeometry(0.1, 1.15, 4));
    for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        mesh(frame.accent, `${type}_HorizonBlade${index + 1}`, bladeGeometry, index % 4 === 0 ? materials.pale : materials.plate, {
            position: [Math.sin(angle) * 1.55, Math.sin(angle * 2) * 0.28, Math.cos(angle) * 1.55],
            rotation: [0, angle, angle]
        });
    }
    addCrown(frame.head, type, materials, 10, 0.58, 1.25);
    addOrbit(frame.accent, type, materials, 14, 1.82, 'orb');
    mesh(frame.weapon, `${type}_EyeBlade`, geometry(`${type}-eye-blade`, () => new THREE.ConeGeometry(0.22, 2.1, 5)), materials.pale, { position: [0, -1.05, 0], rotation: [0, 0, Math.PI] });
    return finalize(root, type, createClips(type, frame.bodyY, { stride: 0.66, reach: 1.22, fall: 0.66 }));
}

const CREATORS = Object.freeze({
    SandstormDjinn: createProceduralSandstormDjinn,
    MagmaGolem: createProceduralMagmaGolem,
    ScorchedWraith: createProceduralScorchedWraith,
    InfernalBehemoth: createProceduralInfernalBehemoth,
    PhoenixSentinel: createProceduralPhoenixSentinel,
    StormHarpy: createProceduralStormHarpy,
    CloudElemental: createProceduralCloudElemental,
    ThunderRoc: createProceduralThunderRoc,
    TempestGiant: createProceduralTempestGiant,
    CycloneAvatar: createProceduralCycloneAvatar
});

export function createProceduralOverworldEnemy(type) {
    const create = CREATORS[type];
    if (!create) throw new Error(`Unknown procedural overworld enemy: ${type}`);
    return create();
}

export function getProceduralOverworldEnemyCacheMetrics() {
    return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size });
}
