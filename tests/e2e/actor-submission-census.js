import { writeFile } from 'node:fs/promises';

// Read-only, untimed observation at the renderer boundary; object callbacks
// would disqualify batching and change the submissions being investigated.
export async function captureActorSubmissionCensus(page, testInfo) {
    const census = await page.evaluate(() => {
        const game = window.game, render = game.renderSystem, renderer = render.renderer;
        const original = renderer.renderBufferDirect, rows = [], parents = new WeakMap();
        let parentCount = 0;
        const parentID = parent => {
            if (!parents.has(parent)) parents.set(parent, ++parentCount);
            return parents.get(parent);
        };
        const geometryKey = geometry => Object.entries(geometry.attributes).map(([name, attr]) =>
            [name, attr.itemSize, attr.normalized, attr.array.constructor.name, attr.isInterleavedBufferAttribute === true]);
        renderer.renderBufferDirect = function (camera, scene, geometry, material, mesh, group) {
            if (camera === render.camera) {
                let root = mesh, equipment = null;
                while (root.parent && !root.userData.authoredClass) {
                    if (root.userData.authoredEquipment && ['mainHand', 'offHand'].includes(root.userData.slot)) equipment = root;
                    root = root.parent;
                }
                if (equipment && root.userData.authoredClass) {
                    const structure = material.toJSON({ textures: {}, images: {} });
                    for (const key of ['uuid', 'name', 'metadata', 'userData', 'color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity']) delete structure[key];
                    const layout = geometryKey(geometry);
                    const flags = [mesh.castShadow, mesh.receiveShadow, mesh.layers.mask, mesh.renderOrder, mesh.frustumCulled];
                    const matrix = mesh.matrix.toArray();
                    rows.push({ kind: 'rigid-handgear', actorClass: root.userData.authoredClass, slot: equipment.userData.slot,
                        item: equipment.userData.fittedItem, mesh: mesh.name, parent: parentID(mesh.parent),
                        localMatrix: matrix, worldMatrix: mesh.matrixWorld.toArray(), flags, geometry: geometry.uuid,
                        attributes: layout, vertices: geometry.attributes.position.count, indices: geometry.index?.count,
                        groups: geometry.groups.length, fullRange: geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity,
                        morphs: Object.keys(geometry.morphAttributes), materialName: material.name, materialType: material.type,
                        opaque: !material.transparent && material.opacity === 1,
                        surfaceFamily: material.userData.authoredEquipmentSurface || null,
                        gpuSurface: [...material.color.toArray(), material.roughness,
                            ...material.emissive.toArray().map(x => x * material.emissiveIntensity), material.metalness].map(Math.fround),
                        materialStructure: structure,
                        candidateKey: JSON.stringify([parentID(mesh.parent), matrix, flags, layout, structure]) });
                } else if (mesh.isInstancedMesh && mesh.parent === render.actorInstances?.group) {
                    const bucket = [...render.actorInstances.batches].find(([, value]) => value === mesh);
                    rows.push({ kind: 'actor-instance-bucket', key: bucket?.[0], name: mesh.name, count: mesh.count,
                        geometry: geometry.uuid, material: material.uuid, attributes: geometryKey(geometry),
                        indices: geometry.index?.count, localMatrix: mesh.matrix.toArray(), worldMatrix: mesh.matrixWorld.toArray(),
                        instanceMatrices: Array.from(mesh.instanceMatrix.array.subarray(0, mesh.count * 16)) });
                }
            }
            return original.call(this, camera, scene, geometry, material, mesh, group);
        };
        try {
            render.render();
            const groups = new Map();
            for (const row of rows) if (row.kind === 'rigid-handgear') {
                const entries = groups.get(row.candidateKey) || [];
                groups.set(row.candidateKey, entries); entries.push(row);
            }
            return { rows, candidateGroups: [...groups.values()].filter(group => group.length > 1).map(group => ({
                actorClass: group[0].actorClass, slot: group[0].slot, parent: group[0].parent,
                materials: group.map(row => row.materialName), candidateDrawReduction: group.length - 1
            })) };
        } finally { renderer.renderBufferDirect = original; }
    });
    await writeFile(testInfo.outputPath('actor-submission-census.json'), JSON.stringify({
        scope: 'Actual connected Low party, one untimed native color render. Exact current sibling transforms/layouts/material structures and float32 instances. Candidate groups estimate compatibility only; custom shader/deformation safety and native equivalence still require qualification. Not profile or draw-gain acceptance.',
        ...census
    }, null, 2));
}
