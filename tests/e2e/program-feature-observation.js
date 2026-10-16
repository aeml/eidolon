const observers = new WeakSet();

// Separate, opt-in metadata observation. No material/program/scene writes.
export function observeProgramFeatures(game, { frames = 120 } = {}) {
    return new Promise((resolve, reject) => {
        const system = game?.renderSystem, renderer = system?.renderer;
        const scene = system?.scene, camera = system?.camera;
        if (!renderer || !scene || !camera || game.isDestroyed || !Number.isInteger(frames) || frames < 1 || frames > 180 ||
            typeof renderer.render !== 'function' || typeof renderer.renderBufferDirect !== 'function' || !renderer.properties?.get) {
            reject(new Error('Program observation requires a live renderer and bounded frames')); return;
        }
        if (observers.has(renderer)) { reject(new Error('Program observer already owns this renderer')); return; }
        const originalRender = renderer.render, originalDirect = renderer.renderBufferDirect;
        const renderDescriptor = Object.getOwnPropertyDescriptor(renderer, 'render');
        const directDescriptor = Object.getOwnPropertyDescriptor(renderer, 'renderBufferDirect');
        const fields = ['__version', 'lightsStateVersion', 'outputColorSpace', 'batching', 'batchingColor',
            'instancing', 'instancingColor', 'instancingMorph', 'skinning', 'envMap', 'fog',
            'numClippingPlanes', 'numIntersection', 'vertexAlphas', 'vertexTangents', 'morphTargets',
            'morphNormals', 'morphColors', 'toneMapping', 'morphTargetsCount'];
        const materials = new Map(), shapes = new WeakMap(), seenShapes = new WeakMap(), changes = {}, mismatches = {};
        let completed = 0, directCalls = 0, submitted = 0, skipped = 0, firstUse = 0, visibleFrames = 0;
        let active = false, closed = false, deadline;
        const increment = (object, name) => { object[name] = (object[name] || 0) + 1; };
        function describeShape(geometry) {
            if (shapes.has(geometry)) return shapes.get(geometry);
            const position = geometry.attributes?.position;
            const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
            if (position && position.count <= 100_000) {
                for (let i = 0; i < position.count; i++) {
                    for (const [axis, getter] of ['getX', 'getY', 'getZ'].entries()) {
                        const value = position[getter](i); min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
                    }
                }
            }
            const bounds = [...min, ...max].every(Number.isFinite) ? { min, max } : null;
            const shape = { type: geometry.type || 'unknown', vertices: position?.count || 0,
                indices: geometry.index?.count || 0, bounds,
                flatAxes: bounds ? min.map((value, axis) => value === max[axis] ? axis : -1).filter(axis => axis >= 0) : [] };
            shapes.set(geometry, shape); return shape;
        }
        function finish(error) {
            if (closed) return;
            closed = true; clearTimeout(deadline); observers.delete(renderer);
            for (const [key, wrapper, descriptor] of [
                ['render', observedRender, renderDescriptor], ['renderBufferDirect', observedDirect, directDescriptor]
            ]) {
                if (renderer[key] !== wrapper) { error ??= new Error(`Program observer lost ${key} ownership`); continue; }
                if (descriptor) Object.defineProperty(renderer, key, descriptor); else delete renderer[key];
            }
            if (error) { reject(error); return; }
            resolve({ frames: completed, visibleFrames, directCalls, submitted, skipped, firstUse,
                changes, mismatches, restored: true,
                materials: [...materials.values()].sort((a, b) => b.changedDraws - a.changedDraws).slice(0, 24),
                scope: 'Separate instrumented gameplay world calls only, exact scene and camera. Counts actual submissions and cached Three material-property transitions; skipped existing batches do not count as submissions. No material/geometry/visibility writes, raw object names, account identifiers or timing acceptance.' });
        }
        function validate() {
            if (game.isDestroyed || game.renderSystem !== system || system.renderer !== renderer || system.scene !== scene ||
                system.camera !== camera || renderer.render !== observedRender || renderer.renderBufferDirect !== observedDirect)
                throw new Error('Program observer lost gameplay ownership');
            if (document.visibilityState !== 'visible') throw new Error('Program observation requires a visible document');
        }
        function observedDirect(...args) {
            if (!active || args[0] !== camera || args[1] !== scene) return originalDirect.apply(this, args);
            validate(); directCalls++;
            const material = args[3], object = args[4], properties = renderer.properties.get(material);
            const before = Object.fromEntries(fields.map(key => [key, properties[key]]));
            const program = properties.currentProgram, calls = renderer.info.render.calls;
            const result = originalDirect.apply(this, args);
            if (renderer.info.render.calls === calls) { skipped++; return result; }
            submitted++;
            const row = materials.get(material) || { type: material.type, draws: 0, changedDraws: 0,
                programTransitions: 0, cacheEntriesMin: Infinity, cacheEntriesMax: 0, changes: {}, mismatches: {}, versionChangingShapes: [] };
            materials.set(material, row); row.draws++;
            const entries = properties.programs?.size || 0;
            row.cacheEntriesMin = Math.min(row.cacheEntriesMin, entries); row.cacheEntriesMax = Math.max(row.cacheEntriesMax, entries);
            if (before.__version === undefined) firstUse++;
            if (program !== properties.currentProgram) row.programTransitions++;
            let changed = false;
            for (const key of fields) if (before[key] !== properties[key]) {
                increment(changes, key); increment(row.changes, key); changed = true;
            }
            if (before.__version !== properties.__version && row.versionChangingShapes.length < 8) {
                const seen = seenShapes.get(material) || new WeakSet(); seenShapes.set(material, seen);
                if (!seen.has(args[2])) {
                    seen.add(args[2]); row.versionChangingShapes.push({ ...describeShape(args[2]),
                        transparent: material.transparent === true, sideAtDraw: material.side,
                        forceSinglePass: material.forceSinglePass === true, opacity: material.opacity });
                }
            }
            for (const [key, value] of [['skinning', object.isSkinnedMesh === true],
                ['instancing', object.isInstancedMesh === true], ['batching', object.isBatchedMesh === true]]) {
                if (before[key] !== undefined && before[key] !== value) {
                    increment(mismatches, key); increment(row.mismatches, key);
                }
            }
            if (changed) row.changedDraws++;
            return result;
        }
        function observedRender(...args) {
            if (args[0] !== scene || args[1] !== camera || active) return originalRender.apply(this, args);
            try {
                validate(); active = true;
                const result = originalRender.apply(this, args);
                completed++; visibleFrames++;
                if (completed === frames) finish();
                return result;
            } catch (error) { finish(error); throw error; }
            finally { active = false; }
        }
        observers.add(renderer);
        renderer.render = observedRender; renderer.renderBufferDirect = observedDirect;
        deadline = setTimeout(() => finish(new Error('Program observation deadline exceeded')), 20_000);
    });
}

export async function profileProgramFeatures(page) {
    const { readFile } = await import('node:fs/promises');
    const body = await readFile(new URL('program-feature-observation.js', import.meta.url), 'utf8');
    const url = '**/tests/e2e/program-feature-observation.js';
    const handler = route => route.fulfill({ body, contentType: 'text/javascript' });
    try {
        await page.route(url, handler);
        await page.evaluate(async () => { await import('/tests/e2e/program-feature-observation.js'); });
    } finally { await page.unroute(url, handler); }
    return page.evaluate(async () => {
        const { observeProgramFeatures } = await import('/tests/e2e/program-feature-observation.js');
        return observeProgramFeatures(window.game);
    });
}
