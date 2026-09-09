import * as THREE from 'three';

export const CRYSTAL_SANCTUM_DEFINITIONS = Object.freeze({
    earth_crystal_raid: Object.freeze({ element: 'Earth', name: 'Rootheart Crystal', motif: 'root-bound heart', color: 0x76d7a2, stone: 0x364635, metal: 0xb49a58 }),
    water_crystal_raid: Object.freeze({ element: 'Water', name: 'Tidestar Crystal', motif: 'tidal reliquary', color: 0x67d8f1, stone: 0x24444f, metal: 0x8dbac5 }),
    fire_crystal_raid: Object.freeze({ element: 'Fire', name: 'Ember Crown Crystal', motif: 'obsidian sun crown', color: 0xffa65a, stone: 0x392727, metal: 0xc78552 }),
    air_crystal_raid: Object.freeze({ element: 'Air', name: 'Skyglass Crystal', motif: 'suspended astrolabe', color: 0xb7c8ff, stone: 0x3b425d, metal: 0xc4cbd9 })
});

// Three closed sections join into one hexagonal bipyramid. Unlike three whole
// overlapping gems, aligned sections do not leave intersecting outer surfaces.
function crystalSection(bottom, top) {
    const vertices = [];
    const ring = (y, i) => {
        const angle = i * Math.PI / 3;
        const radius = (1 - Math.abs(y)) * 3.6;
        return [Math.cos(angle) * radius, y * 7.5, Math.sin(angle) * radius];
    };
    const triangle = (a, b, c) => vertices.push(...a, ...b, ...c);
    // The equator is a necessary profile break inside the middle section.
    const levels = bottom < 0 && top > 0 ? [bottom, 0, top] : [bottom, top];
    for (let band = 0; band < levels.length - 1; band++) {
        for (let i = 0; i < 6; i++) {
            const a = ring(levels[band], i), b = ring(levels[band], i + 1);
            const c = ring(levels[band + 1], i), d = ring(levels[band + 1], i + 1);
            if (levels[band] > -1) triangle(a, c, b);
            if (levels[band + 1] < 1) triangle(b, c, d);
        }
    }
    for (let i = 0; i < 6; i++) {
        if (bottom > -1) triangle([0, bottom * 7.5, 0], ring(bottom, i), ring(bottom, i + 1));
        if (top < 1) triangle([0, top * 7.5, 0], ring(top, i + 1), ring(top, i));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function addMesh(parent, name, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.raycast = () => {};
    mesh.userData.visualOnly = true;
    parent.add(mesh);
    return mesh;
}

export function createProceduralCrystalSanctum(raidType) {
    const definition = CRYSTAL_SANCTUM_DEFINITIONS[raidType];
    if (!definition) return null;
    const root = new THREE.Group();
    root.name = `CrystalSanctum:${raidType}`;
    root.userData = { crystalSanctum: true, visualOnly: true, raidType, element: definition.element, motif: definition.motif, stage: 'fractured', progress: 0 };
    // The server anchor is the chamber/defense center. The reliquary stands
    // behind it, leaving Maelin, the guardian and their central approach clear.
    const altar = new THREE.Group();
    altar.name = 'CrystalReliquary';
    altar.position.z = -32;
    root.add(altar);
    const stone = new THREE.MeshStandardMaterial({ color: definition.stone, roughness: 0.93, flatShading: true });
    const metal = new THREE.MeshStandardMaterial({ color: definition.metal, metalness: 0.65, roughness: 0.4 });
    const crystalMaterial = new THREE.MeshStandardMaterial({ color: 0x795a9d, emissive: 0x482366, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.24, flatShading: true });
    const lightMaterial = new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: 0.42, depthWrite: false });
    const corruptedColor = new THREE.Color(0x795a9d);
    const healthyColor = new THREE.Color(definition.color);
    const plateGeometry = new THREE.CylinderGeometry(1, 1.1, 1, 8);
    addMesh(altar, 'InlaidLowDais', plateGeometry, stone, [0, 0.18, 0], [8, 0.3, 8]);
    const ringGeometry = new THREE.TorusGeometry(1, 0.018, 4, 48);
    const groundRing = addMesh(altar, 'ResonanceFloorInlay', ringGeometry, metal, [0, 0.37, 0], [10, 10, 10]);
    groundRing.rotation.x = Math.PI / 2;
    const floating = new THREE.Group();
    floating.name = 'ThreeCrystalFacets';
    floating.position.y = 11;
    altar.add(floating);
    const sections = [[-1, -0.3], [-0.3, 0.28], [0.28, 1]].map(([bottom, top], index) =>
        addMesh(floating, `CrystalFacet:${index + 1}`, crystalSection(bottom, top), crystalMaterial));
    const decorative = new THREE.Group();
    decorative.name = 'FineResonanceFiligree';
    altar.add(decorative);
    const orbitRings = [];

    if (definition.element === 'Earth') {
        for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2 + Math.PI / 4;
            const point = (radius, y, twist = 0) => new THREE.Vector3(Math.cos(angle + twist) * radius, y, Math.sin(angle + twist) * radius);
            const rootCurve = new THREE.CatmullRomCurve3([point(12, 0.5), point(8, 2, 0.15), point(6, 6, 0.4), point(5, 9, 0.7)]);
            addMesh(altar, `RootButtress:${i}`, new THREE.TubeGeometry(rootCurve, 12, 0.65, 5, false), stone);
            const leaf = addMesh(decorative, `GildedLeaf:${i}`, new THREE.OctahedronGeometry(1), metal, point(6, 7, 0.5).toArray(), [0.45, 1.8, 0.2]);
            leaf.rotation.z = angle;
        }
    } else if (definition.element === 'Water') {
        for (let i = 0; i < 2; i++) {
            const arch = addMesh(altar, `TidalArch:${i}`, new THREE.TorusGeometry(9, 0.38, 5, 36, Math.PI * 1.3), metal, [0, 8, 0]);
            arch.rotation.z = i * Math.PI + Math.PI * 0.35;
            arch.rotation.y = i === 0 ? -0.45 : 0.45;
        }
        for (let i = 0; i < 3; i++) {
            const ripple = addMesh(decorative, `TideRipple:${i}`, ringGeometry, lightMaterial, [0, 0.42 + i * 0.025, 0], [5 + i * 2, 5 + i * 2, 5 + i * 2]);
            ripple.rotation.x = Math.PI / 2;
        }
    } else if (definition.element === 'Fire') {
        const coneGeometry = new THREE.ConeGeometry(1, 1, 5);
        for (let i = 0; i < 7; i++) {
            const angle = i * Math.PI * 2 / 7;
            const height = 4 + (i % 3) * 1.6;
            const tooth = addMesh(altar, `ObsidianCrown:${i}`, coneGeometry, stone, [Math.cos(angle) * 7, height / 2, Math.sin(angle) * 7], [1.5, height, 1.3]);
            tooth.rotation.z = Math.sin(angle) * -0.2;
            const ember = addMesh(decorative, `CrownEmber:${i}`, coneGeometry, lightMaterial, [Math.cos(angle) * 7, height + 0.8, Math.sin(angle) * 7], [0.4, 1.3, 0.4]);
            ember.rotation.y = angle;
        }
    } else {
        for (let i = 0; i < 3; i++) {
            const orbit = addMesh(altar, `SkyglassOrbit:${i}`, new THREE.TorusGeometry(7 + i * 0.65, 0.13, 5, 48), metal, [0, 11, 0]);
            orbit.rotation.set(Math.PI / 3 + i * 0.5, i * Math.PI / 3, i * 0.7);
            orbitRings.push(orbit);
        }
        for (let i = 0; i < 4; i++) {
            const angle = i * Math.PI / 2;
            const fin = addMesh(decorative, `FloatingCompassFin:${i}`, new THREE.OctahedronGeometry(1), metal, [Math.cos(angle) * 11, 4, Math.sin(angle) * 11], [0.7, 3, 0.3]);
            fin.rotation.z = Math.cos(angle) * 0.4;
        }
    }

    const motes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.14), lightMaterial, 12);
    motes.name = 'CrystalResonanceMotes';
    motes.raycast = () => {};
    motes.frustumCulled = false;
    altar.add(motes);
    const ritual = addMesh(root, 'MaelinRitualThread', new THREE.CylinderGeometry(0.065, 0.065, 1, 5), lightMaterial);
    const start = new THREE.Vector3(0, 2.8, 0), end = new THREE.Vector3(0, 10, -32);
    ritual.position.copy(start).add(end).multiplyScalar(0.5);
    ritual.scale.y = start.distanceTo(end);
    ritual.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    const transform = new THREE.Object3D();
    let progress = 0;
    let stage = 'fractured';

    root.applySnapshot = snapshot => {
        if (!snapshot || !['fractured', 'repairing', 'restored'].includes(snapshot.stage)) return false;
        stage = snapshot.stage;
        progress = stage === 'restored' ? 1 : stage === 'repairing' ? THREE.MathUtils.clamp(Number(snapshot.progress) || 0, 0, 99) / 100 : 0;
        root.userData.stage = stage;
        root.userData.progress = progress * 100;
        crystalMaterial.color.copy(corruptedColor).lerp(healthyColor, progress);
        crystalMaterial.emissive.copy(crystalMaterial.color);
        crystalMaterial.emissiveIntensity = 0.1 + progress * 0.2;
        ritual.visible = stage === 'repairing';
        return true;
    };
    root.animate = (elapsed, quality = 'high') => {
        const time = Number.isFinite(elapsed) ? elapsed : 0;
        const broken = 1 - progress;
        floating.position.y = 11 + Math.sin(time * 0.7) * 0.28;
        floating.rotation.y = time * (stage === 'restored' ? 0.12 : 0.035);
        for (let i = 0; i < sections.length; i++) {
            sections[i].position.set((i - 1) * 1.3 * broken, (i - 1) * 1.5 * broken, (i === 1 ? -0.7 : 0.3) * broken);
            sections[i].rotation.z = (i - 1) * 0.12 * broken;
        }
        decorative.visible = quality !== 'low';
        motes.count = quality === 'low' ? 6 : 12;
        motes.visible = stage !== 'fractured';
        for (let i = 0; i < motes.count; i++) {
            const angle = time * 0.32 + i * Math.PI * 2 / motes.count;
            transform.position.set(Math.cos(angle) * 5.5, 7 + ((i * 1.7 + time * 0.5) % 9), Math.sin(angle) * 5.5);
            transform.rotation.set(angle, angle * 0.7, 0);
            transform.updateMatrix();
            motes.setMatrixAt(i, transform.matrix);
        }
        motes.instanceMatrix.needsUpdate = true;
        orbitRings.forEach((ring, index) => { ring.rotation.z = index * 0.7 + time * 0.04 * (index % 2 ? -1 : 1); });
    };
    root.applySnapshot({ stage: 'fractured' });
    root.animate(0);
    return root;
}

export function disposeCrystalSanctum(root) {
    if (!root) return;
    root.removeFromParent();
    const geometries = new Set(), materials = new Set();
    root.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
}
