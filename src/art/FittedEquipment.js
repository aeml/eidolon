import * as THREE from 'three';
import { AUTHORED_ASSETS } from '../assets/authoredEquipment.generated.js';
import { resolveEquipmentVisualDescriptor, equipmentVisualSignature } from './ProceduralEquipment.js';
import { isActiveEquipment } from '../core/EquipmentSlots.js';
import { COSMETIC_CATALOGUE, SEASON_COSMETIC_CATALOGUE } from '../data/cosmetics.generated.js';
import { batchFittedEquipment } from './FittedEquipmentBatches.js';
import { applyAuthoredEquipmentSurface } from './AuthoredEquipmentSurfaces.js';

const owners = new WeakMap();
const ownedMaterials = new WeakMap();
const cosmetics = [...COSMETIC_CATALOGUE, ...SEASON_COSMETIC_CATALOGUE];
const swapSide = name => name.replace(/_([lr])$/, (_, side) => side === 'l' ? '_r' : '_l');
const disposeParts = parts => {
    const materials = new Set(), skeletons = new Set();
    for (const part of parts) {
        part.removeFromParent();
        part.traverse(mesh => {
            for (const material of ownedMaterials.get(mesh) || []) materials.add(material);
            ownedMaterials.delete(mesh);
            if (mesh.userData.fittedOwnedGeometry) mesh.geometry.dispose();
            if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
            if (mesh.isMesh) for (const material of [].concat(mesh.material)) materials.add(material);
        });
    }
    for (const skeleton of skeletons) skeleton.dispose();
    // Materials are instance-owned, textures remain shared with the asset cache.
    for (const material of materials) material.dispose();
};

export function prepareFittedEquipment(root, scene, loader) {
    const body = scene.getObjectByName(`${root.userData.authoredClass}_Body`);
    if (!body?.isSkinnedMesh) throw new Error('Fitted equipment requires the complete class body');
    scene.updateMatrixWorld(true);
    const inverse = scene.matrixWorld.clone().invert();
    const point = bone => bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
    const arms = Object.fromEntries(['l', 'r'].map(side => {
        const a = point(scene.getObjectByName(`upperarm_${side}`));
        const axis = point(scene.getObjectByName(`lowerarm_${side}`)).sub(a);
        return [side, { a, axis, lengthSquared: axis.lengthSq() }];
    }));
    const meshes = [];
    scene.traverse(mesh => { if (mesh.isMesh) meshes.push({ mesh, visible: mesh.visible, geometry: mesh.geometry }); });
    owners.set(root, { scene, loader, body, meshes, arms, height: root.userData.authoredScale ? 4.5 / root.userData.authoredScale : 1.9,
        collar: point(scene.getObjectByName('neck_01')).y, epoch: 0, parts: [], ownedBodyGeometry: null });
    root.userData.fittedEquipment = true;
    root.userData.equipmentReady = Promise.resolve();
}

function restoreCoverage(state) {
    for (const { mesh, visible, geometry } of state.meshes) { mesh.visible = visible; mesh.geometry = geometry; }
    state.ownedBodyGeometry?.dispose(); state.ownedBodyGeometry = null;
}

function applyCoverage(state, selection) {
    const head = !!selection.head, chest = !!selection.chest;
    const pants = !!selection.legs && selection.legs !== 'silk-skirt';
    const longLower = selection.chest === 'robes' || selection.legs === 'silk-skirt';
    // A skirt alone must not remove exposed skin above its waistband. Robes
    // enclose the upper hips through to the existing torso coverage boundary.
    const hipTop = selection.chest === 'robes' ? .583 : .52;
    const boots = !!selection.feet && selection.feet !== 'sandals', gloves = !!selection.gloves;
    for (const { mesh } of state.meshes) {
        if (head && /_(Hair|Scalp)(_|$)/.test(mesh.name)) mesh.visible = false;
        if (chest && /_Undertop|_ClothSeams/.test(mesh.name)) mesh.visible = false;
        if ((pants || longLower) && /_Undershorts/.test(mesh.name)) mesh.visible = false;
    }
    if (!chest && !pants && !longLower && !boots && !gloves) return;
    const body = state.body, original = body.geometry;
    const { position, skinIndex: skin, skinWeight: weight } = original.attributes;
    const hidden = new Uint8Array(position.count), vertex = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
        let max = -1, bone = '';
        for (let k = 0; k < 4; k++) if (weight.getComponent(i, k) > max) {
            max = weight.getComponent(i, k); bone = body.skeleton.bones[skin.getComponent(i, k)].name;
        }
        const y = position.getY(i) / state.height;
        let sleeve = false;
        if (chest && /^upperarm_/.test(bone)) {
            const arm = state.arms[bone.endsWith('_l') ? 'l' : 'r'];
            sleeve = vertex.fromBufferAttribute(position, i).sub(arm.a).dot(arm.axis) / arm.lengthSquared < .31;
        }
        hidden[i] = chest && /^(pelvis|spine_|clavicle_|neck_)/.test(bone) && y > .583 && position.getY(i) < state.collar - .005 || sleeve ||
            longLower && /^(pelvis|spine_|thigh_)/.test(bone) && y > .40 && y < hipTop ||
            pants && /^(pelvis|thigh_|calf_)/.test(bone) && y > .055 && y < .554 ||
            boots && /^(calf_|foot_|ball_)/.test(bone) && y < .104 ||
            gloves && /^(hand_|thumb_|index_|middle_|ring_|pinky_)/.test(bone);
    }
    const index = original.index, keep = [];
    for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        if (!(hidden[a] && hidden[b] && hidden[c])) keep.push(a, b, c);
    }
    // Each actor owns its mask and GPU buffers; no cached source geometry mutation.
    state.ownedBodyGeometry = original.clone();
    state.ownedBodyGeometry.setIndex(keep); body.geometry = state.ownedBodyGeometry;
}

function coverRobeUnderlayers(state, selection, parts) {
    if (selection.chest !== 'robes') return;
    // The supplied closed upper skirt encloses the hips. Leave the visible
    // lower trousers/greaves and crossing triangles intact, but do not render
    // their bulky hip shell through the robe's back. Mask before batching and
    // only on equip-owned clones; original GLBs and other actors are untouched.
    const cutoff = state.height * .40;
    for (const part of parts) {
        if (part.userData.slot !== 'legs' || part.userData.fittedItem === 'silk-skirt' || !part.isSkinnedMesh) continue;
        const geometry = part.geometry, index = geometry.index, position = geometry.attributes.position;
        if (!index || !position) continue;
        const keep = [];
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
            if (!(position.getY(a) > cutoff && position.getY(b) > cutoff && position.getY(c) > cutoff)) keep.push(a, b, c);
        }
        if (keep.length === index.count) continue;
        part.geometry = geometry.clone(); part.geometry.setIndex(keep);
        part.userData.fittedOwnedGeometry = true;
    }
}

function instanceMaterials(part, item, look) {
    const rarity = typeof item.rarity === 'string' ? item.rarity : item.rarity?.name;
    const accent = rarity === 'Eidolic' ? '#9f66dc' : AUTHORED_ASSETS.sets[item.setId]?.accentColor;
    const owned = new Map();
    const uvEligibility = new Map();
    part.traverse(mesh => {
        if (!mesh.isMesh) return;
        const uv = mesh.geometry.getAttribute('uv');
        const valid = uv?.itemSize === 2 && uv.count === mesh.geometry.getAttribute('position')?.count;
        for (const material of [].concat(mesh.material)) uvEligibility.set(material, (uvEligibility.get(material) ?? true) && valid);
    });
    part.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.castShadow = true; mesh.receiveShadow = true;
        const clone = material => {
            if (owned.has(material)) return owned.get(material);
            const result = material.clone(); owned.set(material, result);
            if (accent && result.emissive?.getHex() > 0) { result.emissive.set(accent); result.color.set(accent); }
            if (look) result.color.set(result.emissive?.getHex() > 0 ? look.secondary : look.primary);
            if (Number(item.potency) > 0 && result.emissive?.getHex() > 0) result.emissiveIntensity *= 1 + Math.min(1, item.potency / 20);
            if (uvEligibility.get(material)) applyAuthoredEquipmentSurface(result);
            return result;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
    // Temporary stealth/highlight materials must not hide the actual owned
    // clones from equip-generation cleanup. Shared asset textures stay cached.
    ownedMaterials.set(part, [...owned.values()]);
}

function fittedSkeleton(joints, inverses, cache) {
    const bones = joints.map(joint => joint.bone);
    const key = bones.map(bone => bone.uuid).join('|');
    const finite = inverses.every(matrix => matrix.elements.every(Number.isFinite));
    const candidates = cache.get(key) || [];
    if (finite) {
        const existing = candidates.find(skeleton => skeleton.bones.every((bone, index) => bone === bones[index]) && skeleton.boneInverses.length === inverses.length &&
            skeleton.boneInverses.every((matrix, index) => matrix.equals(inverses[index])));
        if (existing) return existing;
    }
    const skeleton = new THREE.Skeleton(bones, inverses.map(matrix => matrix.clone()));
    if (finite) { candidates.push(skeleton); cache.set(key, candidates); }
    return skeleton;
}

function bindParts(state, gltf, slot, item, catalog, look, skeletons, staged) {
    const root = gltf.scene.clone(true), parts = [];
    if (slot === 'mainHand' || slot === 'offHand') {
        const grip = AUTHORED_ASSETS.grips[state.actorClass][slot];
        const socket = state.scene.getObjectByName(grip.socket);
        new THREE.Matrix4().fromArray(grip.localMatrix).decompose(root.position, root.quaternion, root.scale);
        instanceMaterials(root, item, look); parts.push(root); staged.push(root);
        root.userData.fittedParent = socket;
    } else {
        const targets = new Map(state.body.skeleton.bones.map((bone, i) => [bone.name, { bone, inverse: state.body.skeleton.boneInverses[i] }]));
        const meshes = []; root.traverse(mesh => { if (mesh.isSkinnedMesh) meshes.push(mesh); });
        for (const mesh of meshes) {
            const mirror = slot === 'ring2' || slot === 'trinket2';
            const joints = mesh.skeleton.bones.map(bone => targets.get(mirror ? swapSide(bone.name) : bone.name));
            if (joints.some(joint => !joint)) throw new Error(`Missing fitted ${slot} joint`);
            // Scope sharing to this actor's staged equip generation. Matching
            // ordered live bones and exact inverse matrices preserve skinning;
            // each mesh retains its own bind matrix and original vertex data.
            const skeleton = fittedSkeleton(joints, mirror
                ? joints.map(joint => joint.inverse) : mesh.skeleton.boneInverses, skeletons);
            if (mirror) {
                mesh.geometry = mesh.geometry.clone(); mesh.userData.fittedOwnedGeometry = true;
                const geometry = mesh.geometry;
                for (const name of ['position', 'normal', 'tangent']) {
                    const attribute = geometry.getAttribute(name);
                    if (!attribute) continue;
                    for (let i = 0; i < attribute.count; i++) {
                        attribute.setX(i, -attribute.getX(i));
                        if (name === 'tangent') attribute.setW(i, -attribute.getW(i));
                    }
                    attribute.needsUpdate = true;
                }
                const index = geometry.index;
                for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); }
                index.needsUpdate = true; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            }
            mesh.bind(skeleton, mesh.bindMatrix.clone()); mesh.removeFromParent();
            instanceMaterials(mesh, item, look); mesh.userData.fittedParent = state.scene; parts.push(mesh); staged.push(mesh);
        }
    }
    for (const part of parts) Object.assign(part.userData, { authoredEquipment: true, fittedItem: catalog.id, slot });
}

export function clearFittedEquipment(root) {
    const state = owners.get(root); if (!state) return;
    state.epoch++; disposeParts(state.parts); state.parts = []; restoreCoverage(state);
    root.userData.equipmentVisualSignature = '';
    root.userData.equipmentVisualItemCount = 0; root.userData.equipmentVisualPartCount = 0;
    root.userData.equipmentVisualFallback = [];
    root.userData.updateWeaponProfile?.({});
}

export function resolveFittedEquipmentModel(catalog, tier, actorClass, quality, original = false) {
    const fits = catalog?.models?.[tier];
    const fit = fits?.[actorClass] ? actorClass : 'universal';
    const source = fits?.[fit];
    const detail = quality === 'low' ? 'low' : 'high';
    const file = original ? source : catalog?.runtimeModels?.[tier]?.[fit]?.[detail] || source;
    return { file, source };
}

export function applyFittedEquipment(root, equipment = {}, { force = false } = {}) {
    const state = owners.get(root); if (!state) return { supported: false };
    const actorClass = root.userData.authoredClass; state.actorClass = actorClass;
    const active = Object.fromEntries(Object.entries(equipment).filter(([slot, item]) => isActiveEquipment(slot, item, actorClass)));
    const signature = `${root.userData.authoredQuality}:${root.userData.fittedEquipmentLOD !== false}:${equipmentVisualSignature(active)}`;
    if (!force && signature === root.userData.equipmentVisualSignature) return { supported: true, changed: false };
    const epoch = ++state.epoch; root.userData.equipmentVisualSignature = signature;
    root.userData.updateWeaponProfile?.(active);
    const requested = Object.entries(active).flatMap(([slot, item]) => {
        const descriptor = resolveEquipmentVisualDescriptor(item);
        const look = cosmetics.find(look => look.name === descriptor?.baseName);
        const catalog = AUTHORED_ASSETS.items[look?.base || descriptor?.baseName];
        if (!catalog) return [];
        const tier = ['Legendary', 'Eidolic'].includes(typeof item.rarity === 'string' ? item.rarity : item.rarity?.name) ? 'legendary' : 'standard';
        const { file, source } = resolveFittedEquipmentModel(catalog, tier, actorClass, root.userData.authoredQuality, root.userData.fittedEquipmentLOD === false);
        return [{ slot, item, catalog, look, file, source }];
    });
    root.userData.equipmentReady = Promise.all(requested.map(async request => {
        try { return { ...request, gltf: await state.loader(request.file, 8000) }; }
        catch (error) {
            if (request.file !== request.source) {
                try { return { ...request, gltf: await state.loader(request.source, 8000), fallback: true }; }
                catch (error) { return { ...request, error }; }
            }
            return { ...request, error };
        }
    })).then(results => {
        if (state.epoch !== epoch) return; // Released/reused actor or superseded equip.
        let staged = [];
        const selection = {}, missing = [], skeletons = new Map();
        try {
            for (const result of results) {
                if (result.error) { missing.push(result.slot); continue; }
                // Track each completed owned part before a later mesh in the
                // same asset can reject. One generation-level cleanup also
                // disposes shared equip-owned skeletons exactly once.
                bindParts(state, result.gltf, result.slot, result.item, result.catalog, result.look, skeletons, staged);
                selection[result.slot] = result.catalog.id;
            }
            for (const part of staged) {
                if (part.userData.fittedItem === 'silk-skirt' && selection.chest === 'robes') part.visible = false;
            }
            coverRobeUnderlayers(state, selection, staged);
            // Exact surfaces and native comparisons pass for compatible opaque
            // pieces. False retains the original path for diagnostic comparisons.
            if (root.userData.fittedEquipmentBatching !== false) staged = batchFittedEquipment(staged);
        } catch (error) {
            disposeParts(staged);
            if (state.epoch === epoch) root.userData.equipmentVisualSignature = '';
            throw error;
        }
        disposeParts(state.parts); restoreCoverage(state); state.parts = staged;
        for (const part of staged) {
            part.userData.fittedParent.add(part); delete part.userData.fittedParent;
        }
        applyCoverage(state, selection);
        root.userData.equipmentVisualItemCount = Object.keys(selection).length;
        root.userData.equipmentVisualPartCount = staged.reduce((count, part) => { part.traverse(mesh => { if (mesh.isMesh && mesh.visible) count++; }); return count; }, 0);
        root.userData.equipmentVisualMissing = missing;
        root.userData.equipmentVisualFallback = results.filter(result => result.fallback).map(result => result.slot);
        root.userData.equipmentVisualRevision = (root.userData.equipmentVisualRevision || 0) + 1;
        if (missing.length) root.userData.equipmentVisualSignature = ''; // Allow retry, never cache failure as success.
        root.updateMatrixWorld(true);
    }).catch(error => {
        console.warn('Fitted equipment unavailable', error);
        if (state.epoch === epoch) root.userData.equipmentVisualSignature = '';
    });
    return { supported: true, changed: true, pending: true };
}
