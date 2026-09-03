import * as THREE from 'three';

const GEOMETRIES = new Map();
const MATERIALS = new Map();

export const PROCEDURAL_ABYSSAL_BOSS_STATES = Object.freeze(['Idle', 'Walk', 'Run', 'Attack', 'Death']);

export const PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS = Object.freeze({
    TiderendLeviathan: Object.freeze({
        artStyle: 'Drowned Sanctum tide-rend leviathan', region: 'Abyssal Well — The Drowned Sanctum', faction: 'black-tide brood',
        bounds: Object.freeze({ radius: 4.5, height: 5.4, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x101c24, deep: 0x17384a, iron: 0x526570, coral: 0x6d5b58, tide: 0x35cad9, pearl: 0xd9fbf5 })
    }),
    DrownedChoir: Object.freeze({
        artStyle: 'Drowned Sanctum many-voiced reliquary', region: 'Abyssal Well — The Drowned Sanctum', faction: 'choir beneath',
        bounds: Object.freeze({ radius: 3.6, height: 7.1, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x111b25, deep: 0x1d4052, iron: 0x63727a, coral: 0x705a65, tide: 0x48d4d8, pearl: 0xe2fff7 })
    }),
    AbyssalGoliath: Object.freeze({
        artStyle: 'Drowned Sanctum anchor-cairn goliath', region: 'Abyssal Well — The Drowned Sanctum', faction: 'sunken procession',
        bounds: Object.freeze({ radius: 3.8, height: 7.3, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x0d1921, deep: 0x183747, iron: 0x56696c, coral: 0x745d50, tide: 0x2cbfc8, pearl: 0xd6fff5 })
    }),
    MaelstromWarden: Object.freeze({
        artStyle: 'Drowned Sanctum maelstrom bulwark', region: 'Abyssal Well — The Drowned Sanctum', faction: 'last drowned vigil',
        bounds: Object.freeze({ radius: 4.1, height: 7.8, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x0b1722, deep: 0x163850, iron: 0x60757e, coral: 0x6a5360, tide: 0x35d4df, pearl: 0xe0fff8 })
    }),
    Thalorath: Object.freeze({
        artStyle: 'Drowned Sanctum moonless tide-king', region: 'Abyssal Well — The Drowned Sanctum', faction: 'throne below all tides',
        bounds: Object.freeze({ radius: 4.8, height: 8.6, origin: 'feet' }), combatRadius: 1.25,
        palette: Object.freeze({ basalt: 0x08131e, deep: 0x112f48, iron: 0x637983, coral: 0x79525f, tide: 0x2cdae2, pearl: 0xe8fff9 })
    })
});

function geometry(key, create) { if (!GEOMETRIES.has(key)) GEOMETRIES.set(key, create()); return GEOMETRIES.get(key); }
function material(key, color, options = {}) {
    if (!MATERIALS.has(key)) MATERIALS.set(key, new THREE.MeshStandardMaterial({
        color, roughness: options.roughness ?? 0.8, metalness: options.metalness ?? 0,
        emissive: options.emissive ?? 0, emissiveIntensity: options.emissiveIntensity ?? 0,
        transparent: options.transparent ?? false, opacity: options.opacity ?? 1,
        depthWrite: options.depthWrite ?? true, side: options.side ?? THREE.FrontSide, flatShading: true
    }));
    return MATERIALS.get(key);
}
function createMaterials(type, palette) {
    return {
        basalt: material(`${type}-basalt`, palette.basalt, { roughness: 0.94 }), deep: material(`${type}-deep`, palette.deep, { roughness: 0.78 }),
        iron: material(`${type}-iron`, palette.iron, { roughness: 0.48, metalness: 0.66 }), coral: material(`${type}-coral`, palette.coral, { roughness: 0.9 }),
        tide: material(`${type}-tide`, palette.tide, { roughness: 0.22, emissive: palette.tide, emissiveIntensity: 1.7 }),
        pearl: material(`${type}-pearl`, palette.pearl, { roughness: 0.16, emissive: palette.pearl, emissiveIntensity: 2.2 })
    };
}
function pivot(parent, name, position = [0, 0, 0], rotation = [0, 0, 0]) { const result = new THREE.Group(); result.name = name; result.position.set(...position); result.rotation.set(...rotation); parent.add(result); return result; }
function mesh(parent, name, geometryValue, materialValue, options = {}) {
    const result = new THREE.Mesh(geometryValue, materialValue); result.name = name; result.position.set(...(options.position || [0, 0, 0]));
    result.rotation.set(...(options.rotation || [0, 0, 0])); result.scale.set(...(options.scale || [1, 1, 1]));
    result.castShadow = options.castShadow ?? true; result.receiveShadow = options.receiveShadow ?? true; parent.add(result); return result;
}
function track(objectName, property, times, values) { return new THREE.NumberKeyframeTrack(`${objectName}.${property}`, times, values); }
function installRestPoseReset(root) {
    const restPose = []; root.traverse((object) => restPose.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), visible: object.visible }));
    root.userData.resetPose = () => { restPose.forEach(({ object, position, quaternion, scale, visible }) => { object.position.copy(position); object.quaternion.copy(quaternion); object.scale.copy(scale); object.visible = visible; }); root.updateMatrixWorld(true); };
}
function finalize(root, type, clips) {
    const definition = PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type]; root.updateMatrixWorld(true);
    const groundOffset = Math.max(0, -new THREE.Box3().setFromObject(root).min.y);
    if (groundOffset > 0) {
        const body = root.getObjectByName(`Rig_${type}Body`); body.position.y += groundOffset;
        clips.flatMap((clip) => clip.tracks).filter((entry) => entry.name === `Rig_${type}Body.position[y]`).forEach((entry) => { for (let index = 0; index < entry.values.length; index += 1) entry.values[index] += groundOffset; });
        root.updateMatrixWorld(true);
    }
    Object.assign(root.userData, {
        proceduralEnemyFamily: true, proceduralBossFamily: 'abyssal-well', proceduralActorType: type,
        artStyle: definition.artStyle, region: definition.region, faction: definition.faction,
        combatRadius: definition.combatRadius, interactionPadding: 0.75, sharedGeometry: true, bounds: definition.bounds, animations: clips
    });
    root.name = `Procedural${type}`; installRestPoseReset(root); return root;
}

function addTideSeal(root, type, radius, materials, marks = 14) {
    mesh(root, `${type}_BlackTideSeal`, geometry('abyssal-seal', () => new THREE.RingGeometry(0.79, 0.89, 20)), materials.tide, { position: [0, 0.012, 0], rotation: [-Math.PI / 2, 0, 0], scale: [radius, radius, radius], castShadow: false, receiveShadow: false });
    for (let index = 0; index < marks; index += 1) {
        const angle = index / marks * Math.PI * 2;
        mesh(root, `${type}_TideMark${index + 1}`, geometry('abyssal-tide-mark', () => new THREE.BoxGeometry(0.08, 0.12, 0.45)), index % 4 === 0 ? materials.pearl : materials.iron, { position: [Math.sin(angle) * radius * 0.67, 0.08, Math.cos(angle) * radius * 0.67], rotation: [0, angle, 0], castShadow: false, receiveShadow: false });
    }
}
function addPearlOrbit(parent, type, materials, count, radius, prefix = 'MoonPearl') {
    const pearl = geometry(`${prefix}-pearl`, () => new THREE.IcosahedronGeometry(0.13, 0));
    for (let index = 0; index < count; index += 1) { const angle = index / count * Math.PI * 2; mesh(parent, `${type}_${prefix}${index + 1}`, pearl, index % 3 === 0 ? materials.pearl : materials.tide, { position: [Math.sin(angle) * radius, Math.sin(angle * 2) * 0.28, Math.cos(angle) * radius] }); }
}
function addCoralCrown(parent, type, materials, count, radius, height) {
    const antler = geometry(`${type}-coral-antler`, () => new THREE.ConeGeometry(0.11, height, 5));
    for (let index = 0; index < count; index += 1) { const angle = index / count * Math.PI * 2; mesh(parent, `${type}_CoralCrown${index + 1}`, antler, index % 4 === 0 ? materials.pearl : materials.coral, { position: [Math.sin(angle) * radius, 0.42 + (index % 2) * 0.12, Math.cos(angle) * radius], rotation: [Math.sin(angle) * 0.22, 0, -Math.cos(angle) * 0.22] }); }
}
function addDrownedFrame(root, type, materials, profile = {}) {
    const bodyY = profile.bodyY ?? 2.3, width = profile.width ?? 1, floating = profile.floating ?? false;
    const body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const leg = pivot(body, `Rig_${type}Leg${side}`, [sign * 0.46 * width, -1.02, 0]);
        mesh(leg, `${type}_${floating ? 'DrownedTatter' : 'BasaltLeg'}${side}`, floating ? geometry(`${type}-tatter`, () => new THREE.ConeGeometry(0.38 * width, 1.68, 4)) : geometry(`${type}-leg`, () => new THREE.CylinderGeometry(0.27 * width, 0.34 * width, 1.15, 6)), floating ? materials.deep : materials.basalt, { position: [0, -0.52, 0], scale: [1, 1, 0.72] });
        mesh(leg, `${type}_${floating ? 'TideTip' : 'AnchorBoot'}${side}`, floating ? geometry(`${type}-tip`, () => new THREE.ConeGeometry(0.2, 1.05, 5)) : geometry(`${type}-boot`, () => new THREE.BoxGeometry(0.62 * width, 0.25, 0.9)), floating ? materials.tide : materials.iron, { position: [0, -1.4, floating ? 0 : 0.2], rotation: floating ? [0, 0, Math.PI] : [0, 0, 0] });
    }
    mesh(body, `${type}_SunkenPelvis`, geometry(`${type}-pelvis`, () => new THREE.CylinderGeometry(0.65 * width, 0.76 * width, 0.64, 7)), materials.basalt, { position: [0, -0.24, 0] });
    mesh(body, `${type}_DrownedTorso`, geometry(`${type}-torso`, () => new THREE.DodecahedronGeometry(0.9, 0)), materials.deep, { position: [0, 0.74, 0], scale: [width, 1.18, 0.76] });
    mesh(body, `${type}_TideHeart`, geometry(`${type}-heart`, () => new THREE.IcosahedronGeometry(0.28, 0)), materials.pearl, { position: [0, 0.78, 0.75] });
    const head = pivot(body, `Rig_${type}Head`, [0, 1.98, 0.02]);
    mesh(head, `${type}_DrownedMask`, geometry(`${type}-head`, () => new THREE.OctahedronGeometry(0.51, 0)), materials.basalt, { scale: [width, 1.1, 0.86] });
    mesh(head, `${type}_TideEye`, geometry(`${type}-eye`, () => new THREE.BoxGeometry(0.3, 0.08, 0.07)), materials.pearl, { position: [0, 0.04, 0.47] });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const arm = pivot(body, `Rig_${type}Arm${side}`, [sign * 0.98 * width, 1.12, 0], [0, 0, sign * -0.08]);
        mesh(arm, `${type}_UpperArm${side}`, geometry(`${type}-arm`, () => new THREE.CylinderGeometry(0.28 * width, 0.21 * width, 1, 6)), materials.basalt, { position: [0, -0.45, 0] });
        mesh(arm, `${type}_BarnacleBracer${side}`, geometry(`${type}-bracer`, () => new THREE.CylinderGeometry(0.23 * width, 0.18 * width, 0.85, 6)), materials.iron, { position: [0, -1.25, 0.02] });
        mesh(body, `${type}_CoralShoulder${side}`, geometry(`${type}-shoulder`, () => new THREE.ConeGeometry(0.42 * width, 0.82, 5)), materials.coral, { position: [sign * 1.01 * width, 1.2, 0], rotation: [0, 0, sign * -Math.PI / 2] });
    }
    return { body, head, leftArm: body.getObjectByName(`Rig_${type}ArmLeft`), rightArm: body.getObjectByName(`Rig_${type}ArmRight`), weapon: pivot(body.getObjectByName(`Rig_${type}ArmRight`), `Rig_${type}Weapon`, [0, -1.58, 0.03], [0, 0, -0.14]), accent: pivot(body, `Rig_${type}Accent`, [0, 0.74, -0.44]), bodyY };
}

function createClips(type, bodyY, options = {}) {
    const stride = options.stride ?? 0.4, reach = options.reach ?? 1, fall = options.fall ?? 0.86;
    const body = `Rig_${type}Body`, head = `Rig_${type}Head`, ll = `Rig_${type}LegLeft`, rl = `Rig_${type}LegRight`, la = `Rig_${type}ArmLeft`, ra = `Rig_${type}ArmRight`, weapon = `Rig_${type}Weapon`, accent = `Rig_${type}Accent`;
    const idle = [0, .65, 1.3, 1.95, 2.6], walk = [0, .4, .8, 1.2, 1.6], run = [0, .25, .5, .75, 1], attack = [0, .22, .48, .76, 1.14], death = [0, .38, .82, 1.28, 1.86];
    return [
        new THREE.AnimationClip('Idle', 2.6, [track(body, 'position[y]', idle, [bodyY, bodyY + .08, bodyY, bodyY - .04, bodyY]), track(body, 'rotation[y]', idle, [0, .03, 0, -.03, 0]), track(head, 'rotation[y]', idle, [0, .12, 0, -.12, 0]), track(la, 'rotation[z]', idle, [-.08, -.16, -.08, 0, -.08]), track(ra, 'rotation[z]', idle, [.08, .16, .08, 0, .08]), track(ll, 'rotation[z]', idle, [0, .025, 0, -.025, 0]), track(weapon, 'rotation[z]', idle, [-.14, -.06, -.14, -.24, -.14]), track(accent, 'rotation[y]', idle, [0, .48, .96, 1.44, 1.92]), track(accent, 'position[y]', idle, [.74, .83, .74, .65, .74])]),
        new THREE.AnimationClip('Walk', 1.6, [track(body, 'position[y]', walk, [bodyY, bodyY + .11, bodyY, bodyY + .11, bodyY]), track(body, 'rotation[z]', walk, [0, .05, 0, -.05, 0]), track(ll, 'rotation[x]', walk, [stride, 0, -stride, 0, stride]), track(rl, 'rotation[x]', walk, [-stride, 0, stride, 0, -stride]), track(la, 'rotation[x]', walk, [-stride * .7, 0, stride * .7, 0, -stride * .7]), track(ra, 'rotation[x]', walk, [stride * .7, 0, -stride * .7, 0, stride * .7]), track(head, 'rotation[y]', walk, [0, -.05, 0, .05, 0]), track(weapon, 'rotation[z]', walk, [-.14, .04, -.14, -.34, -.14]), track(accent, 'rotation[z]', walk, [0, .24, 0, -.24, 0])]),
        new THREE.AnimationClip('Run', 1, [track(body, 'position[y]', run, [bodyY, bodyY + .18, bodyY, bodyY + .18, bodyY]), track(body, 'rotation[x]', run, [.1, .19, .1, .19, .1]), track(ll, 'rotation[x]', run, [stride * 1.6, 0, -stride * 1.6, 0, stride * 1.6]), track(rl, 'rotation[x]', run, [-stride * 1.6, 0, stride * 1.6, 0, -stride * 1.6]), track(la, 'rotation[x]', run, [-stride, 0, stride, 0, -stride]), track(ra, 'rotation[x]', run, [stride, 0, -stride, 0, stride]), track(head, 'rotation[x]', run, [-.04, .05, -.04, .05, -.04]), track(weapon, 'rotation[z]', run, [-.14, .18, -.14, -.5, -.14]), track(accent, 'rotation[z]', run, [0, .38, 0, -.38, 0])]),
        new THREE.AnimationClip('Attack', 1.14, [track(body, 'position[y]', attack, [bodyY, bodyY + .06, bodyY + .18, bodyY - .06, bodyY]), track(body, 'rotation[y]', attack, [0, -.24, -.56, .42, 0]), track(head, 'rotation[y]', attack, [0, .14, .27, -.19, 0]), track(ll, 'rotation[x]', attack, [0, .15, .28, -.13, 0]), track(rl, 'rotation[x]', attack, [0, -.19, -.34, .17, 0]), track(la, 'rotation[x]', attack, [0, -.34, -.56, .31, 0]), track(ra, 'rotation[x]', attack, [0, -.7 * reach, -1.26 * reach, 1.04 * reach, 0]), track(weapon, 'rotation[z]', attack, [-.14, -.94 * reach, -1.54 * reach, 1.08 * reach, -.14]), track(accent, 'rotation[y]', attack, [0, -.42, -.94, 1.04, 0])]),
        new THREE.AnimationClip('Death', 1.86, [track(body, 'position[y]', death, [bodyY, bodyY + .04, bodyY - .2, bodyY - fall * .72, bodyY - fall]), track(body, 'rotation[x]', death, [0, -.11, .36, .98, 1.42]), track(body, 'rotation[z]', death, [0, .08, -.25, -.64, -.88]), track(head, 'rotation[x]', death, [0, -.15, .31, .69, .98]), track(ll, 'rotation[x]', death, [0, .11, -.27, -.7, -.98]), track(rl, 'rotation[x]', death, [0, -.13, .33, .8, 1.08]), track(la, 'rotation[z]', death, [-.08, -.37, -.76, -1.08, -1.26]), track(ra, 'rotation[z]', death, [.08, .4, .8, 1.16, 1.32]), track(weapon, 'rotation[z]', death, [-.14, .13, .63, 1.2, 1.54]), track(accent, 'rotation[z]', death, [0, -.27, .56, 1.1, 1.42])])
    ];
}

export function createProceduralTiderendLeviathan() {
    const type = 'TiderendLeviathan', materials = createMaterials(type, PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type].palette), root = new THREE.Group(); addTideSeal(root, type, 2.15, materials, 16);
    const bodyY = 2.15, body = pivot(root, `Rig_${type}Body`, [0, bodyY, 0]);
    const segment = geometry('leviathan-segment', () => new THREE.DodecahedronGeometry(.62, 0));
    for (let index = 0; index < 12; index += 1) { const angle = index * .34; mesh(body, `${type}_TideScale${index + 1}`, segment, index % 4 === 0 ? materials.deep : materials.basalt, { position: [Math.sin(angle) * (1 + index * .08), -.12 + Math.sin(index * .7) * .22, .8 - index * .36], rotation: [0, angle, 0], scale: [1 - index * .035, .82 - index * .02, 1.15] }); }
    const head = pivot(body, `Rig_${type}Head`, [0, .35, 1.4]); mesh(head, `${type}_LeviathanSkull`, geometry('leviathan-head', () => new THREE.DodecahedronGeometry(.78, 0)), materials.deep, { scale: [1.28, .9, 1.3] });
    const jaw = pivot(head, `Rig_${type}Weapon`, [0, -.28, .66], [.12, 0, 0]); mesh(jaw, `${type}_TideJaw`, geometry('leviathan-jaw', () => new THREE.BoxGeometry(1.15, .24, .92)), materials.basalt, { position: [0, 0, .18] });
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) { mesh(head, `${type}_PearlEye${side}`, geometry('leviathan-eye', () => new THREE.OctahedronGeometry(.1, 0)), materials.pearl, { position: [sign * .34, .16, .58] }); const fin = pivot(body, `Rig_${type}Arm${side}`, [sign * .72, .08, .4], [0, 0, sign * -.12]); for (let index = 0; index < 8; index += 1) mesh(fin, `${type}_${side}TideFin${index + 1}`, geometry(`leviathan-fin-${index}`, () => new THREE.ConeGeometry(.14, .85 + index * .12, 4)), index % 3 === 0 ? materials.tide : materials.coral, { position: [sign * (.25 + index * .18), 0, -index * .08], rotation: [0, 0, sign * (Math.PI / 2 + .08)], scale: [1, 1, .5] }); }
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) { const leg = pivot(body, `Rig_${type}Leg${side}`, [sign * .45, -.5, .75]); for (let index = 0; index < 5; index += 1) mesh(leg, `${type}_${side}MawTendril${index + 1}`, geometry(`leviathan-tendril-${index}`, () => new THREE.ConeGeometry(.1, .9 + index * .12, 5)), index % 2 ? materials.tide : materials.coral, { position: [(index - 2) * .16, -.55, .2], rotation: [Math.PI, 0, (index - 2) * .12] }); }
    const accent = pivot(body, `Rig_${type}Accent`, [0, .15, -1.35]); addPearlOrbit(accent, type, materials, 10, 1.5, 'DepthPearl'); addCoralCrown(head, type, materials, 9, .56, 1.05);
    return finalize(root, type, createClips(type, bodyY, { stride: .58, reach: 1.12, fall: .78 }));
}

export function createProceduralDrownedChoir() {
    const type = 'DrownedChoir', materials = createMaterials(type, PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type].palette), root = new THREE.Group(); addTideSeal(root, type, 1.8, materials, 18);
    const frame = addDrownedFrame(root, type, materials, { width: 1.05, bodyY: 2.48, floating: true }); frame.head.visible = false;
    for (let voice = 0; voice < 3; voice += 1) { const x = (voice - 1) * .72, skull = pivot(frame.body, `${type}_Voice${voice + 1}`, [x, 1.65 + (voice === 1 ? .22 : 0), .02]); mesh(skull, `${type}_ChoirMask${voice + 1}`, geometry('choir-mask', () => new THREE.OctahedronGeometry(.38, 0)), voice === 1 ? materials.coral : materials.basalt, { scale: [.9, 1.15, .75] }); mesh(skull, `${type}_ChoirMouth${voice + 1}`, geometry('choir-mouth', () => new THREE.TorusGeometry(.14, .035, 5, 10, Math.PI)), voice === 1 ? materials.pearl : materials.tide, { position: [0, -.08, .35], rotation: [0, 0, Math.PI] }); addCoralCrown(skull, `${type}Voice${voice + 1}`, materials, 5, .38, .66); }
    const rib = geometry('choir-rib', () => new THREE.TorusGeometry(.62, .055, 5, 10, Math.PI)); for (let index = 0; index < 8; index += 1) mesh(frame.body, `${type}_RibHarp${index + 1}`, rib, index % 2 ? materials.iron : materials.coral, { position: [0, .2 + index * .18, .3], rotation: [Math.PI / 2, 0, index % 2 ? Math.PI : 0], scale: [1 - index * .03, 1, 1] });
    mesh(frame.weapon, `${type}_CantorPole`, geometry('choir-pole', () => new THREE.CylinderGeometry(.07, .11, 3, 6)), materials.iron, { position: [0, -1, 0] }); mesh(frame.weapon, `${type}_TideChime`, geometry('choir-chime', () => new THREE.CylinderGeometry(.42, .58, .9, 8)), materials.deep, { position: [0, -2.38, 0] });
    addPearlOrbit(frame.accent, type, materials, 13, 1.65, 'VoicePearl'); return finalize(root, type, createClips(type, frame.bodyY, { stride: .46, reach: 1.08, fall: .74 }));
}

export function createProceduralAbyssalGoliath() {
    const type = 'AbyssalGoliath', materials = createMaterials(type, PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type].palette), root = new THREE.Group(); addTideSeal(root, type, 2.05, materials, 14);
    const frame = addDrownedFrame(root, type, materials, { width: 1.55, bodyY: 2.48 });
    const slab = geometry('goliath-cairn', () => new THREE.BoxGeometry(.72, .78, .28)); for (let index = 0; index < 16; index += 1) { const angle = index / 16 * Math.PI * 2; mesh(frame.body, `${type}_SunkenCairn${index + 1}`, slab, index % 4 === 0 ? materials.coral : materials.basalt, { position: [Math.sin(angle) * 1.18, .35 + (index % 4) * .46, Math.cos(angle) * .72], rotation: [0, angle, Math.sin(angle) * .12] }); }
    for (const [side, sign] of [['Left', 1], ['Right', -1]]) mesh(frame.body.getObjectByName(`Rig_${type}Arm${side}`), `${type}_AnchorFist${side}`, geometry('goliath-anchor-fist', () => new THREE.DodecahedronGeometry(.52, 0)), materials.iron, { position: [0, -1.72, .04], scale: [1.1, .85, 1] });
    mesh(frame.weapon, `${type}_DrownedChain`, geometry('goliath-chain', () => new THREE.CylinderGeometry(.1, .13, 2.8, 6)), materials.iron, { position: [0, -.9, 0] }); mesh(frame.weapon, `${type}_GraveAnchor`, geometry('goliath-anchor', () => new THREE.TorusGeometry(.72, .13, 6, 12, Math.PI * 1.4)), materials.coral, { position: [0, -2.25, 0], rotation: [Math.PI / 2, 0, .3] });
    addPearlOrbit(frame.accent, type, materials, 10, 1.65, 'CairnSoul'); addCoralCrown(frame.head, type, materials, 7, .54, .92); return finalize(root, type, createClips(type, frame.bodyY, { stride: .28, reach: 1.15, fall: 1.05 }));
}

export function createProceduralMaelstromWarden() {
    const type = 'MaelstromWarden', materials = createMaterials(type, PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type].palette), root = new THREE.Group(); addTideSeal(root, type, 2.2, materials, 16);
    const frame = addDrownedFrame(root, type, materials, { width: 1.48, bodyY: 2.55 });
    for (let index = 0; index < 8; index += 1) mesh(frame.body, `${type}_MaelstromRing${index + 1}`, geometry(`warden-ring-${index}`, () => new THREE.TorusGeometry(.72 + index * .14, .055, 5, 16)), index % 3 === 0 ? materials.pearl : materials.tide, { position: [0, -.35 + index * .22, 0], rotation: [Math.PI / 2 + index * .12, index * .08, index * .24] });
    const shell = geometry('warden-shell', () => new THREE.ConeGeometry(.42, 1.2, 6)); for (let index = 0; index < 12; index += 1) { const angle = index / 12 * Math.PI * 2; mesh(frame.body, `${type}_VigilShell${index + 1}`, shell, index % 3 === 0 ? materials.iron : materials.basalt, { position: [Math.sin(angle) * 1.3, .92, Math.cos(angle) * .78], rotation: [Math.sin(angle) * .35, angle, -Math.cos(angle) * .35] }); }
    mesh(frame.weapon, `${type}_WardenShaft`, geometry('warden-shaft', () => new THREE.CylinderGeometry(.1, .15, 3.4, 7)), materials.iron, { position: [0, -1.12, 0] }); mesh(frame.weapon, `${type}_MoonAnchorBlade`, geometry('warden-blade', () => new THREE.ConeGeometry(.5, 1.55, 4)), materials.pearl, { position: [0, -2.75, 0], rotation: [0, 0, Math.PI] });
    addPearlOrbit(frame.accent, type, materials, 14, 1.9, 'MaelstromPearl'); addCoralCrown(frame.head, type, materials, 9, .58, 1.15); return finalize(root, type, createClips(type, frame.bodyY, { stride: .3, reach: 1.2, fall: 1 }));
}

export function createProceduralThalorath() {
    const type = 'Thalorath', materials = createMaterials(type, PROCEDURAL_ABYSSAL_BOSS_DEFINITIONS[type].palette), root = new THREE.Group(); addTideSeal(root, type, 2.5, materials, 20);
    const frame = addDrownedFrame(root, type, materials, { width: 1.62, bodyY: 2.72, floating: true }); addCoralCrown(frame.head, type, materials, 13, .72, 1.65);
    const tentacle = geometry('thalorath-tentacle', () => new THREE.ConeGeometry(.2, 2.2, 7)); for (let index = 0; index < 16; index += 1) { const angle = index / 16 * Math.PI * 2; mesh(frame.accent, `${type}_ThroneTentacle${index + 1}`, tentacle, index % 4 === 0 ? materials.tide : materials.deep, { position: [Math.sin(angle) * 1.5, -.25 + Math.sin(angle * 2) * .25, Math.cos(angle) * 1.5], rotation: [Math.sin(angle) * .45, angle, -Math.cos(angle) * .45], scale: [1, .82 + (index % 3) * .16, 1] }); }
    for (let index = 0; index < 9; index += 1) mesh(frame.body, `${type}_BlackTideRing${index + 1}`, geometry(`thalorath-ring-${index}`, () => new THREE.TorusGeometry(.85 + index * .17, .06, 5, 18)), index % 3 === 0 ? materials.pearl : materials.tide, { position: [0, -.42 + index * .22, 0], rotation: [Math.PI / 2 + index * .11, index * .09, index * .22] });
    mesh(frame.weapon, `${type}_DeepTridentShaft`, geometry('thalorath-trident-shaft', () => new THREE.CylinderGeometry(.1, .16, 3.7, 7)), materials.iron, { position: [0, -1.2, 0] }); for (let index = -1; index <= 1; index += 1) mesh(frame.weapon, `${type}_TridentTine${index + 2}`, geometry('thalorath-tine', () => new THREE.ConeGeometry(.13, 1.1, 5)), index === 0 ? materials.pearl : materials.tide, { position: [index * .3, -3.18, 0], rotation: [0, 0, Math.PI] });
    addPearlOrbit(frame.accent, type, materials, 16, 2.35, 'ThronePearl'); return finalize(root, type, createClips(type, frame.bodyY, { stride: .45, reach: 1.24, fall: .92 }));
}

export function createProceduralAbyssalBoss(type) {
    switch (type) {
        case 'TiderendLeviathan': return createProceduralTiderendLeviathan(); case 'DrownedChoir': return createProceduralDrownedChoir();
        case 'AbyssalGoliath': return createProceduralAbyssalGoliath(); case 'MaelstromWarden': return createProceduralMaelstromWarden();
        case 'Thalorath': return createProceduralThalorath(); default: throw new Error(`Unknown procedural Abyssal Well boss: ${type}`);
    }
}
export function getProceduralAbyssalBossCacheMetrics() { return Object.freeze({ geometries: GEOMETRIES.size, materials: MATERIALS.size }); }
