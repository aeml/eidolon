import { Matrix4 } from 'three';

// Private QA control: both paths use identical eligibility, geometry, materials,
// view policy and shaders. Restore the exact original property on every exit.
export function compareActorCellTranslation(render, timing = false) {
    const instances = render.actorInstances;
    if (!instances?.enabled) throw Error('Cell comparison requires active actor instances');
    const descriptor = Object.getOwnPropertyDescriptor(instances, 'writeCellMatrix');
    const candidateWriter = instances.writeCellMatrix, inverse = new Matrix4(), matrix = new Matrix4();
    const referenceWriter = function (batch, index, part, originX, originZ) {
        if (index === 0) inverse.makeTranslation(originX, 0, originZ).invert();
        batch.setMatrixAt(index, matrix.multiplyMatrices(inverse, part.matrixWorld));
    };
    const canvas = render.renderer.domElement, copy = document.createElement('canvas');
    copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    const realNow = performance.now.bind(performance), frozen = realNow();
    const clockDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
    const restored = () => !instances.hidden.length && !instances.group.visible;
    const draw = candidate => {
        instances.writeCellMatrix = candidate ? candidateWriter : referenceWriter;
        render.render();
        return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles, restored: restored() };
    };
    const capture = candidate => {
        const counts = draw(candidate); context.drawImage(canvas, 0, 0);
        return { ...counts, pixels: context.getImageData(0, 0, copy.width, copy.height).data,
            batches: [...instances.batches].map(([key, batch]) => ({ key, count: batch.count,
                matrix: [...batch.matrixWorld.elements], sphere: [...batch.boundingSphere.center.toArray(), batch.boundingSphere.radius],
                values: [...batch.instanceMatrix.array.slice(0, batch.count * 16)] })) };
    };
    try {
        let reference, candidate, again;
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            draw(false); draw(true); draw(false);
            reference = capture(false); candidate = capture(true); again = capture(false);
        } finally {
            if (clockDescriptor) Object.defineProperty(performance, 'now', clockDescriptor);
            else delete performance.now;
        }
        let changedChannels = 0, unstableChannels = 0, signedZeros = 0, matrixDifferences = 0;
        for (let i = 0; i < reference.pixels.length; i++) {
            changedChannels += reference.pixels[i] !== candidate.pixels[i] ? 1 : 0;
            unstableChannels += reference.pixels[i] !== again.pixels[i] ? 1 : 0;
        }
        if (reference.batches.length !== candidate.batches.length) throw Error('Cell comparison batch membership changed');
        for (let i = 0; i < reference.batches.length; i++) {
            const a = reference.batches[i], b = candidate.batches[i];
            if (a.key !== b.key || a.count !== b.count || a.values.length !== b.values.length ||
                a.matrix.some((value, index) => value !== b.matrix[index]) ||
                a.sphere.some((value, index) => value !== b.sphere[index])) throw Error('Cell comparison bounds or origin changed');
            a.values.forEach((value, index) => {
                if (value !== b.values[index]) matrixDifferences++;
                else if (!Object.is(value, b.values[index])) signedZeros++;
            });
        }
        const strip = ({ pixels: _pixels, batches: _batches, ...counts }) => counts;
        const blocks = [];
        if (timing) for (const selected of [false, true, true, false, false, true, true, false]) {
            draw(selected); draw(selected);
            const milliseconds = [];
            for (let frame = 0; frame < 12; frame++) {
                const start = realNow(); draw(selected); milliseconds.push(realNow() - start);
            }
            blocks.push({ candidate: selected, milliseconds, restored: restored() });
        }
        const summarize = selected => {
            const times = blocks.filter(block => block.candidate === selected).flatMap(block => block.milliseconds).sort((a, b) => a - b);
            return { frames: times.length, median: times[Math.floor(times.length / 2)], p95: times[Math.ceil(times.length * .95) - 1] };
        };
        return { reference: strip(reference), candidate: strip(candidate), again: strip(again),
            matrices: { batches: reference.batches.length, coefficients: reference.batches.reduce((sum, batch) => sum + batch.values.length, 0), matrixDifferences, signedZeros },
            image: { changedChannels, unstableChannels, width: copy.width, height: copy.height, frozenRenderClock: true },
            cpu: timing ? { scope: 'Same-scene synchronous submission, real clock, eight ABBA blocks; not whole-frame pacing or hardware GPU time.',
                reference: summarize(false), candidate: summarize(true), blocks } : null };
    } finally {
        if (descriptor) Object.defineProperty(instances, 'writeCellMatrix', descriptor);
        else delete instances.writeCellMatrix;
        instances.endFrame();
    }
}
