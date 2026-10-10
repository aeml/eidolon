import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function captureUnderstoryDetailComparison(page, testInfo) {
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { createEarthUnderstoryPlacements, earthUnderstoryScale, earthUnderstoryTint } = await import('/src/art/EarthUnderstory.js');
        const { createSpatialUnderstoryBatches } = await import('/src/art/SpatialUnderstoryBatches.js');
        const { createWoodlandUnderstoryGeometry } = await import('/src/art/WoodlandUnderstoryGeometry.js');
        const { createWoodlandWindMaterial } = await import('/src/art/WoodlandWindMaterial.js');
        const game = window.game, render = game.renderSystem, parent = game.getInstanceEnvironmentGroup();
        const current = parent.children.find(root => root.userData.earthUnderstory);
        if (render.graphicsQuality !== 'low' || !current?.children.every(mesh => mesh.isBatchedMesh)) {
            throw Error('Detail comparison requires actual Low spatial cover');
        }
        const plants = createEarthUnderstoryPlacements('low'), reference = new THREE.Group();
        reference.add(...createSpatialUnderstoryBatches({ plants,
            geometries: ['bracken', 'sedge'].map(kind => createWoodlandUnderstoryGeometry(kind, { quality: 'high' })),
            material: createWoodlandWindMaterial(), terrainElevation: game.terrainElevation,
            scaleForPlant: earthUnderstoryScale, tintForPlant: earthUnderstoryTint }));
        reference.position.copy(current.position); reference.quaternion.copy(current.quaternion); reference.scale.copy(current.scale);
        // The reference retains the previous Low recipe with three sections;
        // placement, sector submissions, wind, actors, poses and camera agree.
        const matricesEqual = reference.children.length === current.children.length && reference.children.every((mesh, index) => {
            const other = current.children[index];
            return mesh.instanceCount === other.instanceCount && mesh.name === other.name &&
                mesh._matricesTexture.image.data.every((value, i) => value === other._matricesTexture.image.data[i]) &&
                mesh._colorsTexture.image.data.every((value, i) => value === other._colorsTexture.image.data[i]);
        });
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const originalZoom = render.currentZoom, descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const frozen = performance.now(), rows = [];
        const capture = selected => {
            reference.removeFromParent(); current.removeFromParent(); parent.add(selected); render.render();
            context.drawImage(canvas, 0, 0);
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                pixels: context.getImageData(0, 0, copy.width, copy.height).data };
        };
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            for (const zoom of [originalZoom, 5]) {
                render.setZoom(zoom); capture(reference); capture(current); capture(reference);
                const old = capture(reference), referencePNG = canvas.toDataURL('image/png');
                const candidate = capture(current), candidatePNG = canvas.toDataURL('image/png'), repeat = capture(reference);
                let changedChannels = 0, unstableChannels = 0;
                for (let i = 0; i < old.pixels.length; i++) {
                    changedChannels += old.pixels[i] !== candidate.pixels[i] ? 1 : 0;
                    unstableChannels += old.pixels[i] !== repeat.pixels[i] ? 1 : 0;
                }
                const strip = ({ pixels: _pixels, ...row }) => row;
                rows.push({ zoom, reference: strip(old), candidate: strip(candidate), repeat: strip(repeat),
                    changedChannels, unstableChannels, referencePNG, candidatePNG });
            }
        } finally {
            reference.removeFromParent(); current.removeFromParent(); parent.add(current);
            render.setZoom(originalZoom);
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
            render.disposeObjectResources(reference); render.render();
        }
        return { plants: plants.length, currentPlants: current.userData.plantCount, matricesEqual, rows,
            restored: current.parent === parent && !reference.parent,
            scope: 'Untimed same-scene prior Low three-section recipe versus current two-section recipe. Same full Low plants, transforms, tints, wind clock, supplied actors and camera. Isolated comparison after actual frame profile; reference resources disposed. Pixel differences are reviewed, not waived as exact.' };
    });
    for (const [index, row] of result.rows.entries()) {
        for (const variant of ['reference', 'candidate']) {
            await writeFile(testInfo.outputPath(`understory-detail-${index}-${variant}.png`), Buffer.from(row[`${variant}PNG`].split(',')[1], 'base64'));
            delete row[`${variant}PNG`];
        }
        expect(row.unstableChannels).toBe(0);
        expect(row.candidate.triangles).toBeLessThan(row.reference.triangles);
    }
    expect(result.plants).toBe(7439); expect(result.currentPlants).toBe(result.plants);
    expect(result.matricesEqual && result.restored).toBe(true);
    await writeFile(testInfo.outputPath('understory-detail-comparison.json'), JSON.stringify(result, null, 2));
}
