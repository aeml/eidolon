import { execFileSync } from 'node:child_process';

const base = 'fdb1bba251922b140fd0d3127fef7685f79e5008';
export async function prepareBirchComparison(page) {
    for (const file of ['ProceduralRealmFoliage', 'FoliageRenderBatches']) {
        let body = execFileSync('git', ['show', `${base}:src/art/${file}.js`], { encoding: 'utf8' });
        if (file === 'FoliageRenderBatches') body = body.replace("'./ProceduralRealmFoliage.js'", "'./ProceduralRealmFoliageBirchReference.js'");
        await page.route(`**/src/art/${file}BirchReference.js`, route => route.fulfill({ body, contentType: 'text/javascript' }));
    }
}

export async function installBirchComparison(page, quality) {
    await page.evaluate(async quality => {
        const { getFoliageRenderBatches, computeFoliageCellBounds } = await import('/src/art/FoliageRenderBatchesBirchReference.js');
        const { THREE, game } = window.__rockReview;
        const candidate = game.renderSystem.scene.getObjectByName('foliage:earth:ossuary_birch');
        const reference = new THREE.Group(); reference.name = 'private original birch crown control';
        reference.userData = { ...candidate.userData };
        const parts = new Map(getFoliageRenderBatches('ossuary_birch', quality).map(part => [part.name, part]));
        const placementMatrix = new THREE.Matrix4(), transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
        for (const current of candidate.children) {
            const part = parts.get(current.name);
            const mesh = new THREE.InstancedMesh(part.geometry, current.material, current.count);
            mesh.name = current.name; mesh.castShadow = current.castShadow; mesh.receiveShadow = current.receiveShadow;
            mesh.matrixAutoUpdate = false; mesh.userData = { ...current.userData };
            current.userData.placementIndices.forEach((placementIndex, i) => {
                const placement = candidate.userData.placements[placementIndex];
                transform.position.set(placement.x, game.terrainElevation.sample(placement.x, placement.z), placement.z);
                transform.quaternion.setFromAxisAngle(up, placement.rotation); transform.scale.setScalar(placement.scale); transform.updateMatrix();
                placementMatrix.multiplyMatrices(transform.matrix, part.matrix); mesh.setMatrixAt(i, placementMatrix);
            });
            mesh.instanceMatrix.needsUpdate = true; computeFoliageCellBounds(mesh); reference.add(mesh);
        }
        reference.visible = false; candidate.parent.add(reference);
        window.__rockReview.birchComparison = { candidate, reference, parts: [...parts.values()], rows: [] };
    }, quality);
}

export function captureBirchComparison(label) {
    const { game, birchComparison: review } = window.__rockReview;
    const render = game.renderSystem, canvas = render.renderer.domElement;
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    const capture = reference => {
        review.candidate.visible = !reference; review.reference.visible = reference;
        render.render(); render.render(); context.drawImage(canvas, 0, 0);
        return { pixels: context.getImageData(0, 0, copy.width, copy.height).data, png: copy.toDataURL('image/png'),
            calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
    };
    const difference = (a, b) => {
        let changed = 0, maximum = 0;
        for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); if (delta) changed++; maximum = Math.max(maximum, delta); }
        return { changed, maximum };
    };
    try {
        const before = capture(true), after = capture(false), again = capture(true);
        const row = { label, change: difference(before.pixels, after.pixels), stability: difference(before.pixels, again.pixels),
            before: { calls: before.calls, triangles: before.triangles }, after: { calls: after.calls, triangles: after.triangles } };
        review.rows.push(row); return { ...row, beforePNG: before.png, afterPNG: after.png };
    } finally { review.candidate.visible = true; review.reference.visible = false; render.render(); }
}

export function retireBirchComparison() {
    const { game, birchComparison: review } = window.__rockReview;
    const geometries = new Set(review.reference.children.map(mesh => mesh.geometry));
    const materials = new Set(review.parts.map(part => part.material));
    const released = { geometry: 0, material: 0, instance: 0 };
    review.reference.removeFromParent();
    for (const mesh of review.reference.children) { mesh.addEventListener('dispose', () => released.instance++); mesh.dispose(); }
    for (const [resources, key] of [[geometries, 'geometry'], [materials, 'material']]) for (const resource of resources) {
        resource.addEventListener('dispose', () => released[key]++); resource.dispose();
    }
    game.renderSystem.renderer.renderLists.dispose();
    window.__rockReview.birchComparison = null;
    return { rows: review.rows, released, expected: { geometry: geometries.size, material: materials.size, instance: review.reference.children.length } };
}
