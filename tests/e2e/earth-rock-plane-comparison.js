import { execFileSync } from 'node:child_process';

// Private art control: immutable pre-change geometry, with the current lights,
// materials, supplied outfit, HUD and camera. No runtime switch is published.
export async function prepareRockPlaneComparison(page) {
    const body = execFileSync('git', ['show', 'a8890a8406feafc70fdb9f9c3c490195224bfef9:src/art/EarthOutcrops.js'], { encoding: 'utf8' });
    await page.route('**/src/art/EarthOutcropsReference.js', route => route.fulfill({ body, contentType: 'text/javascript' }));
}

export async function installRockPlaneComparison(page) {
    await page.evaluate(async () => {
        const { createEarthOutcrops } = await import('/src/art/EarthOutcropsReference.js');
        const review = window.__rockReview;
        review.referenceRocks = createEarthOutcrops({ terrainElevation: review.game.terrainElevation });
        review.referenceRocks.visible = false;
        review.game.renderSystem.instanceEnvironmentGroup.add(review.referenceRocks);
        review.rockPlaneComparisons = [];
    });
}

export function captureRockPlaneComparison(label) {
    const review = window.__rockReview;
    if (!review.referenceRocks) return null;
    const render = review.game.renderSystem, canvas = render.renderer.domElement;
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    const capture = reference => {
        review.field.visible = !reference; review.referenceRocks.visible = reference;
        render.render(); render.render(); context.drawImage(canvas, 0, 0);
        return { pixels: context.getImageData(0, 0, copy.width, copy.height).data, png: copy.toDataURL('image/png'),
            calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
    };
    const difference = (a, b) => {
        let changed = 0, maximum = 0;
        for (let i = 0; i < a.length; i++) {
            const delta = Math.abs(a[i] - b[i]);
            if (delta) changed++; maximum = Math.max(maximum, delta);
        }
        return { changed, maximum };
    };
    try {
        const before = capture(true), after = capture(false), again = capture(true);
        const row = { label, change: difference(before.pixels, after.pixels), stability: difference(before.pixels, again.pixels),
            before: { calls: before.calls, triangles: before.triangles }, after: { calls: after.calls, triangles: after.triangles } };
        review.rockPlaneComparisons.push(row);
        return { ...row, beforePNG: before.png, afterPNG: after.png };
    } finally { review.field.visible = true; review.referenceRocks.visible = false; render.render(); }
}

export function retireRockPlaneComparison() {
    const review = window.__rockReview;
    if (!review.referenceRocks) return null;
    const root = review.referenceRocks;
    const geometries = new Set(root.children.map(mesh => mesh.geometry));
    const materials = new Set(root.children.map(mesh => mesh.material));
    const released = { geometry: 0, material: 0 };
    for (const [set, key] of [[geometries, 'geometry'], [materials, 'material']]) for (const object of set) {
        object.addEventListener('dispose', () => released[key]++);
    }
    root.removeFromParent(); review.game.renderSystem.disposeObjectResources(root);
    review.referenceRocks = null;
    return { rows: review.rockPlaneComparisons, released, expected: { geometry: geometries.size, material: materials.size } };
}
