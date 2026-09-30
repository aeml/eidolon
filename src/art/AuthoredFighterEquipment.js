import * as THREE from 'three';
import { createProceduralEquipmentVisual, createEquipmentVisualMaterials, resolveEquipmentVisualDescriptor,
    equipmentVisualSignature, EQUIPMENT_RENDER_SLOTS } from './ProceduralEquipment.js';

// Shared, immutable garment geometry is keyed by the delivered body geometry,
// not item IDs. Six coverage bits bound the possible body masks to 64 per LOD.
const geometryCaches = new WeakMap();
const states = new WeakMap();
const SKIN_SLOTS = ['chest', 'shoulders', 'gloves', 'belt', 'legs', 'feet'];
const DECORATION = /^Gear_(?:Socket(?:Mount|Back|MountBack)?\d+|SetRune|UniqueRune)$/;
const components = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];

function cacheFor(body) {
    if (!geometryCaches.has(body.geometry)) geometryCaches.set(body.geometry, { shells: new Map(), fitted: new Map(), masks: new Map(), triangles: null, grid: null });
    return geometryCaches.get(body.geometry);
}

function trianglesFor(body, cache) {
    if (cache.triangles) return cache.triangles;
    const geometry = body.geometry, position = geometry.attributes.position;
    const joints = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight, index = geometry.index;
    const triangles = [];
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const vertices = [0, 1, 2].map(offset => index ? index.getX(i + offset) : i + offset);
        const center = new THREE.Vector3(), influence = new Map();
        for (const vertex of vertices) {
            center.add(new THREE.Vector3().fromBufferAttribute(position, vertex));
            for (let channel = 0; channel < 4; channel++) {
                const joint = joints.getComponent(vertex, channel), weight = weights.getComponent(vertex, channel);
                influence.set(joint, (influence.get(joint) || 0) + weight);
            }
        }
        center.divideScalar(3);
        const joint = [...influence].sort((a, b) => b[1] - a[1])[0]?.[0];
        const bone = body.skeleton.bones[joint]?.name || '';
        const x = Math.abs(center.x), y = center.y;
        const torso = /^(?:spine_|pelvis|clavicle_)/.test(bone), leg = /^(?:thigh_|calf_|foot_|ball_)/.test(bone);
        let mask = 0;
        // Only mask deeply covered skin. Cutting at a collar/pauldron edge by
        // triangle centroid leaves a jagged hole in exposed neck or upper arm.
        if (torso && y > 1.10 && y < 1.34 && x < .18) mask |= 1;
        if (/^(?:upperarm_|clavicle_)/.test(bone) && y > 1.46 && x > .22) mask |= 2;
        if (/^(?:hand_|lowerarm_|index_|middle_|pinky_|ring_|thumb_)/.test(bone) && x > .36 && y < 1.19) mask |= 4;
        if (torso && y > 1.016 && y < 1.086 && x < .32) mask |= 8;
        if (y > .16 && y < 1.045 && (leg || bone === 'pelvis' && x < .33)) mask |= 16;
        if (leg && y < .16) mask |= 32;
        triangles.push({ vertices, center, mask });
    }
    cache.triangles = triangles;
    return triangles;
}

function skinMesh(body, geometry, material, name) {
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.bindMode = body.bindMode;
    mesh.bind(body.skeleton, body.bindMatrix);
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 1.75);
    return mesh;
}

function weightGrid(body, shorts, cache) {
    if (cache.grid) return cache.grid;
    const cells = new Map(), all = [], width = .075;
    for (const owner of [body, shorts].filter(Boolean)) {
        const { position, skinIndex, skinWeight } = owner.geometry.attributes;
        for (let i = 0; i < position.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(position, i);
            const sample = { point, joints: [0, 1, 2, 3].map(channel => skinIndex.getComponent(i, channel)),
                weights: [0, 1, 2, 3].map(channel => skinWeight.getComponent(i, channel)) };
            const key = [point.x, point.y, point.z].map(value => Math.floor(value / width)).join(':');
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(sample); all.push(sample);
        }
    }
    cache.grid = { cells, all, width }; return cache.grid;
}

function weightsAt(grid, point) {
    const center = [point.x, point.y, point.z].map(value => Math.floor(value / grid.width)), candidates = [];
    for (let radius = 0; radius <= 4; radius++) {
        for (let x = -radius; x <= radius; x++) for (let y = -radius; y <= radius; y++) for (let z = -radius; z <= radius; z++) {
            if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) !== radius) continue;
            for (const sample of grid.cells.get([center[0] + x, center[1] + y, center[2] + z].join(':')) || []) candidates.push({ sample, distance: sample.point.distanceToSquared(point) });
        }
        candidates.sort((a, b) => a.distance - b.distance);
        candidates.length = Math.min(candidates.length, 3);
        if (candidates.length === 3 && candidates[2].distance < (radius * grid.width) ** 2) break;
    }
    if (!candidates.length) for (const sample of grid.all) {
        candidates.push({ sample, distance: sample.point.distanceToSquared(point) });
        candidates.sort((a, b) => a.distance - b.distance); candidates.length = Math.min(candidates.length, 3);
    }
    const influences = new Map();
    for (const { sample, distance } of candidates) for (let channel = 0; channel < 4; channel++) {
        const joint = sample.joints[channel], weight = sample.weights[channel] / Math.max(.000001, distance);
        influences.set(joint, (influences.get(joint) || 0) + weight);
    }
    const strongest = [...influences].sort((a, b) => b[1] - a[1]).slice(0, 4), total = strongest.reduce((sum, [, weight]) => sum + weight, 0);
    return { joints: Array.from({ length: 4 }, (_, i) => strongest[i]?.[0] || 0), weights: Array.from({ length: 4 }, (_, i) => total ? (strongest[i]?.[1] || 0) / total : i === 0 ? 1 : 0) };
}

function retargetGeometry(geometry, matrix, grid, bend = null) {
    const result = geometry.clone().applyMatrix4(matrix), position = result.attributes.position;
    const joints = new Uint16Array(position.count * 4), weights = new Float32Array(position.count * 4);
    for (let i = 0; i < position.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(position, i);
        if (bend) { bend(point); position.setXYZ(i, point.x, point.y, point.z); }
        const sample = weightsAt(grid, point);
        for (let channel = 0; channel < 4; channel++) { joints[i * 4 + channel] = sample.joints[channel]; weights[i * 4 + channel] = sample.weights[channel]; }
    }
    result.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
    result.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    if (bend) result.computeVertexNormals();
    result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}

function fitPieces(state, root, group, item, slot, descriptor, source) {
    const { body, cache, shorts } = state, grid = weightGrid(body, shorts, cache), scale = 1 / root.userData.authoredScale;
    let number = 0;
    const add = (geometry, material, key, matrix, bend = null) => {
        if (!cache.fitted.has(key)) cache.fitted.set(key, retargetGeometry(geometry, matrix, grid, bend));
        group.add(skinMesh(body, cache.fitted.get(key), material, number++ === 0 ? `AuthoredGear_${slot}` : `AuthoredPiece_${slot}_${number}`));
    };
    const pieces = (input, side, origin, stretch = [1, 1, 1], rotation = new THREE.Quaternion(), bend = null) => {
        input.updateMatrixWorld(true);
        const fit = new THREE.Matrix4().compose(new THREE.Vector3(...origin), rotation, new THREE.Vector3(...stretch).multiplyScalar(scale));
        input.traverse(part => {
            if (!part.isMesh || DECORATION.test(part.name)) return;
            const matrix = fit.clone().multiply(part.matrixWorld);
            const key = [slot, descriptor.variant, input.userData.tier, side, part.geometry.uuid, matrix.elements.join(',')].join(':');
            add(part.geometry, part.material, key, matrix, bend);
        });
    };
    if (slot === 'chest') {
        pieces(source, 0, [0, 1.08, -.015], [.84, 1, 1]);
        if (descriptor.variant === 'robes') {
            const geometry = new THREE.LatheGeometry([new THREE.Vector2(.31, .46), new THREE.Vector2(.29, .7), new THREE.Vector2(.25, 1.10)], 32);
            geometry.scale(1, 1, .78);
            add(geometry, createEquipmentVisualMaterials(item, descriptor).primary, 'robe-tail', new THREE.Matrix4()); geometry.dispose();
        }
    } else if (slot === 'belt') pieces(source, 0, [0, 1.052, .004], [.97, 1, .78]);
    else if (slot === 'shoulders') for (const side of [-1, 1]) {
        pieces(createProceduralEquipmentVisual(item, { slot, side }), side, [side * .23, 1.505, .026], [.73, .75, .85]);
    } else if (slot === 'feet') for (const side of [-1, 1]) {
        pieces(source, side, [side * .214, .015, .026], [.90, 1.5, .96]);
    } else if (slot === 'gloves') {
        const mats = createEquipmentVisualMaterials(item, descriptor);
        group.add(skinMesh(body, garment(body, cache, slot, descriptor), [mats.primary, mats.secondary], `AuthoredGear_${slot}`)); number++;
        for (const side of [-1, 1]) {
            const wrist = state.hands.get(side);
            const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-side * .37, .928, -.05).normalize());
            pieces(source, side, wrist.toArray(), [1.12, 1.12, 1.12], orientation);
        }
    } else if (slot === 'legs') {
        const mats = createEquipmentVisualMaterials(item, descriptor);
        // The delivered body omits waist faces beneath its fitted shorts.
        if (shorts) add(shorts.geometry, mats.dark, 'pants-waist', new THREE.Matrix4().makeScale(1.018, 1, 1.035));
        if (descriptor.variant === 'skirt') {
            const geometry = new THREE.LatheGeometry([new THREE.Vector2(.31, .48), new THREE.Vector2(.29, .72), new THREE.Vector2(.25, 1.045)], 32);
            geometry.scale(.96, 1, .75);
            add(geometry, mats.primary, 'skirt-wrap', new THREE.Matrix4()); geometry.dispose();
        }
        for (const side of [-1, 1]) {
            if (descriptor.variant !== 'skirt') pieces(source, side, [side * .117, 1.015, -.028], [1.18, 1.35, 1.3], new THREE.Quaternion(), point => {
                const t = THREE.MathUtils.clamp((1.015 - point.y) / .46, 0, 1); point.x += side * .044 * t; point.z += .05 * t;
            });
            const shin = createProceduralEquipmentVisual(item, { slot, segment: 'shin' });
            pieces(shin, side, [side * .161, .548, .033], [1.15, 1.12, 1.2], new THREE.Quaternion(), point => {
                const t = THREE.MathUtils.clamp((.548 - point.y) / .47, 0, 1); point.x += side * .053 * t; point.z -= .013 * t;
            });
        }
    }
}

function garment(body, cache, slot, descriptor) {
    const key = `${slot}:${descriptor.variant}`;
    if (cache.shells.has(key)) return cache.shells.get(key);
    const bit = 1 << SKIN_SLOTS.indexOf(slot), original = body.geometry;
    const selected = trianglesFor(body, cache).filter(triangle => triangle.mask & bit);
    const vertices = [...new Set(selected.flatMap(triangle => triangle.vertices))];
    const remap = new Map(vertices.map((vertex, index) => [vertex, index])), geometry = new THREE.BufferGeometry();
    for (const name of components) {
        const source = original.attributes[name];
        const data = new source.array.constructor(vertices.length * source.itemSize);
        const attribute = new THREE.BufferAttribute(data, source.itemSize, source.normalized);
        // GLTFLoader can return interleaved or normalized accessors. Raw array
        // slicing ignores their stride and corrupts joint indices/weights.
        vertices.forEach((vertex, index) => {
            for (let channel = 0; channel < source.itemSize; channel++) attribute.setComponent(index, channel, source.getComponent(vertex, channel));
        });
        geometry.setAttribute(name, attribute);
    }
    const position = geometry.attributes.position, normal = geometry.attributes.normal;
    // This anatomical shell is only used for gloves; armor and clothes use
    // separately shaped pieces rather than copying the bare body surface.
    const distance = descriptor.material === 'metal' ? .023 : .012;
    for (let i = 0; i < position.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(position, i), direction = new THREE.Vector3().fromBufferAttribute(normal, i);
        point.addScaledVector(direction, distance);
        position.setXYZ(i, point.x, Math.max(.002, point.y), point.z);
    }
    const primary = [], trim = [];
    for (const triangle of selected) {
        const edge = triangle.center.y > 1.13;
        (edge ? trim : primary).push(...triangle.vertices.map(vertex => remap.get(vertex)));
    }
    geometry.setIndex([...primary, ...trim]);
    geometry.addGroup(0, primary.length, 0); geometry.addGroup(primary.length, trim.length, 1);
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    cache.shells.set(key, geometry);
    return geometry;
}

function maskedBody(body, cache, mask) {
    if (!mask) return body.geometry;
    if (!cache.masks.has(mask)) {
        const geometry = new THREE.BufferGeometry();
        for (const [name, attribute] of Object.entries(body.geometry.attributes)) geometry.setAttribute(name, attribute);
        geometry.morphAttributes = body.geometry.morphAttributes;
        geometry.morphTargetsRelative = body.geometry.morphTargetsRelative;
        geometry.setIndex(trianglesFor(body, cache).filter(triangle => !(triangle.mask & mask)).flatMap(triangle => triangle.vertices));
        geometry.boundingBox = body.geometry.boundingBox?.clone() || null;
        geometry.boundingSphere = body.geometry.boundingSphere?.clone() || null;
        cache.masks.set(mask, geometry);
    }
    return cache.masks.get(mask);
}

function preferredDecorationPoint(slot, side = 0) {
    const preferred = slot === 'chest' ? [0, 1.4, .25] : slot === 'legs' ? [-.14, .82, .25]
        : slot === 'gloves' ? [side * .49, 1.01, .2] : slot === 'feet' ? [side * .21, .1, .18]
            : slot === 'shoulders' ? [side * .25, 1.47, .2] : [0, 1.05, .23];
    return new THREE.Vector3(...preferred);
}

function decorateGarment(state, group, source, slot, scale) {
    const { body, cache, shorts } = state, grid = weightGrid(body, shorts, cache);
    // Sample immutable bind-space garment surfaces, not their current animated
    // world pose. This keeps equip/refresh during a cast identical to idle fit.
    const supports = group.children.filter(part => part.isSkinnedMesh).map(part => new THREE.Mesh(part.geometry, part.material));
    const positions = slot === 'gloves' || slot === 'feet' || slot === 'shoulders' ? [-1, 1] : [0];
    for (const side of positions) {
        source.traverse(part => {
            if (!part.isMesh || !DECORATION.test(part.name)) return;
            // Back settings are useful on blades; a body garment needs one
            // front setting rather than mirrored ornaments inside the wearer.
            if (part.name.includes('Back')) return;
            const geometry = part.geometry.clone();
            const offset = part.name.includes('Socket') ? (Number(part.name.match(/\d+/)?.[0]) - 2) * .035 : part.name.includes('Set') ? -.045 : .045;
            const point = preferredDecorationPoint(slot, side).add(new THREE.Vector3(offset, part.name.includes('Socket') ? 0 : -.08, 0));
            const hit = new THREE.Raycaster(new THREE.Vector3(point.x, point.y, 2), new THREE.Vector3(0, 0, -1)).intersectObjects(supports)[0];
            if (hit) point.z = hit.point.z + .002;
            const sample = weightsAt(grid, point);
            const matrix = new THREE.Matrix4().compose(point, part.quaternion, part.scale.clone().multiplyScalar(1 / scale));
            geometry.applyMatrix4(matrix);
            const count = geometry.attributes.position.count, joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
            for (let i = 0; i < count; i++) for (let channel = 0; channel < 4; channel++) {
                joints[i * 4 + channel] = sample.joints[channel];
                weights[i * 4 + channel] = sample.weights[channel];
            }
            geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
            geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
            const ornament = skinMesh(body, geometry, part.material, `${part.name}_${side}`);
            ornament.userData.authoredOwnedGeometry = true;
            group.add(ornament);
        });
    }
}

function rigidMount(root, body, parent, name, position, rotation, scale) {
    const mount = new THREE.Group(); mount.name = name;
    const scene = body.parent;
    scene.updateWorldMatrix(true, true);
    const matrix = new THREE.Matrix4().copy(scene.matrixWorld).invert().multiply(parent.matrixWorld).invert()
        .multiply(new THREE.Matrix4().compose(position, rotation, scale));
    matrix.decompose(mount.position, mount.quaternion, mount.scale);
    parent.add(mount);
    return mount;
}

export function prepareAuthoredFighterEquipment(root) {
    const body = root.getObjectByName('Fighter_Body');
    if (!body?.isSkinnedMesh || !root.userData.authoredScale) throw new Error('Fighter equipment requires its complete skinned body');
    const scale = 1 / root.userData.authoredScale, mounts = new Map();
    const socket = name => root.getObjectByName(name);
    const point = part => part.getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(body.parent.matrixWorld).invert());
    const add = (slot, parent, position, rotation = new THREE.Quaternion(), fit = [scale, scale, scale]) => {
        if (!parent) throw new Error(`Missing Fighter equipment mount: ${slot}`);
        mounts.set(slot, rigidMount(root, body, parent, `AuthoredMount_${slot}`, position, rotation, new THREE.Vector3(...fit)));
    };
    root.updateMatrixWorld(true);
    add('head', socket('socket_head'), new THREE.Vector3(0, 1.67, .035));
    add('mainHand', socket('socket_mainHand'), point(socket('socket_mainHand')), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.85));
    add('offHand', socket('socket_offHand'), point(socket('socket_offHand')), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .35));
    add('neck', socket('socket_chest'), new THREE.Vector3(0, 1.52, .015), new THREE.Quaternion(), [scale * .85, scale, scale * .65]);
    for (const [slot, side] of [['ring1', 1], ['ring2', -1]]) {
        const finger = root.getObjectByName(side > 0 ? 'ring_01_l' : 'ring_01_r') || socket(side > 0 ? 'socket_offHand' : 'socket_mainHand');
        add(slot, finger, point(finger), new THREE.Quaternion(), [scale * .55, scale * .55, scale * .55]);
    }
    add('trinket1', socket('socket_belt'), new THREE.Vector3(-.21, 1.02, .12));
    add('trinket2', socket('socket_belt'), new THREE.Vector3(.21, 1.02, .12));
    const group = new THREE.Group(); group.name = 'AuthoredFighterGarments'; body.parent.add(group);
    const hands = new Map([-1, 1].map(side => [side, point(root.getObjectByName(side < 0 ? 'hand_r' : 'hand_l') || socket(side > 0 ? 'socket_offHand' : 'socket_mainHand'))]));
    const torso = root.getObjectByName('spine_03');
    const state = { body, original: body.geometry, cache: cacheFor(body), mounts, group, hands, torso,
        torsoRestInverse: torso.getWorldQuaternion(new THREE.Quaternion()).invert(),
        shieldRest: mounts.get('offHand').getWorldQuaternion(new THREE.Quaternion()),
        offHandRest: mounts.get('offHand').quaternion.clone(),
        parentRotation: new THREE.Quaternion(), targetRotation: new THREE.Quaternion(), shield: false,
        hair: root.getObjectByName('Fighter_Hair'), shorts: root.getObjectByName('Fighter_Undershorts'), seams: root.getObjectByName('Fighter_ClothSeams') };
    states.set(root, state);
    // The supplied hand poses are unarmed. Keep the shield facing with the
    // torso while its grip follows the hand, rather than presenting its edge
    // when that wrist turns during Run/Block. Authority transforms are untouched.
    root.userData.updateEquipmentPose = () => {
        if (!state.shield) return;
        const mount = mounts.get('offHand');
        torso.updateWorldMatrix(true, false);
        mount.parent.updateWorldMatrix(true, false);
        torso.getWorldQuaternion(state.targetRotation).multiply(state.torsoRestInverse).multiply(state.shieldRest);
        mount.parent.getWorldQuaternion(state.parentRotation).invert();
        mount.quaternion.copy(state.parentRotation).multiply(state.targetRotation);
        mount.updateMatrixWorld(true);
    };
}

export function clearAuthoredFighterEquipment(root) {
    const state = states.get(root);
    if (!state) return false;
    for (const owner of [state.group, ...state.mounts.values()]) {
        for (const part of [...owner.children]) {
            part.traverse(child => { if (child.userData.authoredOwnedGeometry) child.geometry.dispose(); });
            part.removeFromParent();
        }
    }
    state.body.geometry = state.original;
    state.shield = false;
    state.mounts.get('offHand').quaternion.copy(state.offHandRest);
    for (const part of [state.hair, state.shorts, state.seams]) if (part) part.visible = true;
    root.userData.equipmentVisualSignature = '';
    root.userData.equipmentVisualItemCount = 0; root.userData.equipmentVisualPartCount = 0;
    root.userData.equipmentVisualRevision = (root.userData.equipmentVisualRevision || 0) + 1;
    return true;
}

export function applyAuthoredFighterEquipment(root, equipment = {}, { force = false } = {}) {
    const state = states.get(root);
    if (!state) return { supported: false, changed: false, items: 0, parts: 0, missing: [] };
    const signature = equipmentVisualSignature(equipment);
    if (!force && signature === root.userData.equipmentVisualSignature) return { supported: true, changed: false, items: root.userData.equipmentVisualItemCount, parts: root.userData.equipmentVisualPartCount, missing: [] };
    clearAuthoredFighterEquipment(root);
    const missing = []; let items = 0, parts = 0, mask = 0;
    for (const slot of EQUIPMENT_RENDER_SLOTS) {
        const item = equipment[slot];
        if (!item?.id && !item?.name) continue;
        const descriptor = resolveEquipmentVisualDescriptor(item);
        if (!descriptor) { missing.push(item.name || item.id || slot); continue; }
        const source = createProceduralEquipmentVisual(item, { slot, batch: !SKIN_SLOTS.includes(slot) });
        if (SKIN_SLOTS.includes(slot)) {
            const group = new THREE.Group(); group.name = source.name; group.userData = { ...source.userData, authoredEquipment: true };
            fitPieces(state, root, group, item, slot, descriptor, source);
            decorateGarment(state, group, source, slot, root.userData.authoredScale);
            state.group.add(group);
            if (!(slot === 'feet' && descriptor.variant === 'sandals')) mask |= 1 << SKIN_SLOTS.indexOf(slot);
        } else {
            state.mounts.get(slot).add(source);
            if (slot === 'offHand') state.shield = descriptor.variant === 'shield';
            if (slot === 'head' && state.hair) state.hair.visible = false;
        }
        items++;
    }
    state.body.geometry = maskedBody(state.body, state.cache, mask);
    if (mask & 16) for (const part of [state.shorts, state.seams]) if (part) part.visible = false;
    for (const owner of [state.group, ...state.mounts.values()]) owner.traverse(part => { if (part.isMesh && part.visible && !part.userData.equipmentBatchSource) parts++; });
    root.userData.equipmentVisualSignature = signature; root.userData.equipmentVisualItemCount = items; root.userData.equipmentVisualPartCount = parts;
    root.userData.updateEquipmentPose();
    return { supported: true, changed: true, items, parts, missing };
}
