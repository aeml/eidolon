import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createCherubArt(track, quality, color, boosted) {
    const low = quality === 'low';
    const sphere = track(new THREE.SphereGeometry(1, low ? 8 : 12, low ? 6 : 8));
    const halo = track(new THREE.TorusGeometry(0.3, 0.025, 5, low ? 12 : 20));
    const skin = track(new THREE.MeshStandardMaterial({ color: 0xf3c7a2, emissive: color, emissiveIntensity: boosted ? 0.24 : 0.12, roughness: 0.82 }));
    const feathers = track(new THREE.MeshStandardMaterial({ color: 0xfff4da, emissive: color, emissiveIntensity: boosted ? 0.35 : 0.18, roughness: 0.9 }));
    const curls = track(new THREE.MeshStandardMaterial({ color: 0xc79448, roughness: 0.85, emissive: color, emissiveIntensity: 0.12 }));
    const eyes = track(new THREE.MeshBasicMaterial({ color: 0x493329 }));
    const glow = track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86, depthWrite: false, toneMapped: false }));
    return { sphere, halo, skin, feathers, curls, eyes, glow, track, batches: new Map() };
}

function batchParts(parent, art, key) {
    const groups = new Map();
    for (const child of parent.children) {
        if (!child.isMesh || child.material.transparent) continue;
        if (!groups.has(child.material)) groups.set(child.material, []);
        groups.get(child.material).push(child);
    }
    for (const [material, parts] of groups) {
        if (parts.length < 2) continue;
        const cacheKey = `${key}:${material.uuid}`;
        if (!art.batches.has(cacheKey)) {
            const geometries = parts.map((part) => { part.updateMatrix(); return part.geometry.clone().applyMatrix4(part.matrix); });
            const merged = art.track(mergeGeometries(geometries, false));
            geometries.forEach((geometry) => geometry.dispose());
            art.batches.set(cacheKey, merged);
        }
        const batch = new THREE.Mesh(art.batches.get(cacheKey), material);
        batch.name = `Cherub_Batch_${key}`;
        parent.add(batch);
        parts.forEach((part) => { part.visible = false; });
    }
}

// Classical, non-explicit putto proportions: bare rounded torso/limbs and a
// featureless body, small feathered wings, curled hair and a thin gold halo.
export function createProceduralCherub(art, index, count) {
    const root = new THREE.Group();
    root.name = `GuardianSpirit:${index + 1}`;
    root.userData.presentation = 'cherub';
    const part = (parent, name, material, position, scale, rotation = 0) => {
        const mesh = new THREE.Mesh(art.sphere, material);
        mesh.name = `Cherub_${name}`;
        mesh.position.set(...position);
        mesh.scale.set(...scale);
        mesh.rotation.z = rotation;
        parent.add(mesh);
        return mesh;
    };
    part(root, 'Belly', art.skin, [0, 0.39, 0.025], [0.28, 0.34, 0.22]);
    part(root, 'Chest', art.skin, [0, 0.61, 0], [0.27, 0.24, 0.2]);
    part(root, 'Head', art.skin, [0, 0.96, 0.025], [0.3, 0.31, 0.27]);
    part(root, 'Nose', art.skin, [0, 0.93, 0.285], [0.06, 0.045, 0.06]);
    for (const side of [-1, 1]) {
        part(root, `Cheek${side}`, art.skin, [side * 0.16, 0.9, 0.235], [0.115, 0.085, 0.06]);
        part(root, `Eye${side}`, art.eyes, [side * 0.105, 1.01, 0.273], [0.025, 0.035, 0.012]);
        part(root, `Arm${side}`, art.skin, [side * 0.32, 0.54, 0.04], [0.095, 0.23, 0.095], side * 0.5);
        part(root, `Hand${side}`, art.skin, [side * 0.41, 0.38, 0.09], [0.085, 0.09, 0.085]);
        part(root, `Leg${side}`, art.skin, [side * 0.15, 0.1, 0.01], [0.125, 0.22, 0.12], side * 0.25);
        part(root, `Foot${side}`, art.skin, [side * 0.2, -0.075, 0.075], [0.11, 0.075, 0.145]);
    }
    for (let curl = 0; curl < 5; curl++) {
        const angle = curl / 4 * Math.PI;
        part(root, `Curl${curl}`, art.curls, [Math.cos(angle) * 0.24, 1.18 + Math.sin(angle) * 0.06, 0.07], [0.1, 0.09, 0.12]);
    }
    const wings = [-1, 1].map((side) => {
        const wing = new THREE.Group();
        wing.name = `Cherub_Wing${side}`;
        wing.position.set(side * 0.18, 0.65, -0.14);
        wing.userData.side = side;
        part(wing, 'WingShoulder', art.feathers, [side * 0.16, 0.11, -0.04], [0.22, 0.16, 0.07], side * 0.5);
        for (let feather = 0; feather < 4; feather++) {
            part(wing, `Feather${feather}`, art.feathers,
                [side * (0.29 + feather * 0.06), 0.24 - feather * 0.105, -0.04],
                [0.07, 0.28 - feather * 0.025, 0.045], -side * (0.7 + feather * 0.12));
        }
        root.add(wing);
        batchParts(wing, art, `wing${side}`);
        return wing;
    });
    const halo = new THREE.Mesh(art.halo, art.glow);
    halo.name = 'Cherub_Halo';
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.4;
    root.add(halo);
    batchParts(root, art, 'body');
    Object.assign(root.userData, { bodyMaterial: art.skin, headMaterial: art.skin, haloMaterial: art.glow, wings, phase: index / count * Math.PI * 2 });
    return root;
}
