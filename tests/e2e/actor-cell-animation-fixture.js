export async function renderAnimatedActorCells({ quality, perInstanceFrustum = false }) {

        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { ActorInstanceMultiDraw } = await import('/src/art/ActorInstanceMultiDraw.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const owner = render.actorInstances;
        owner.multiDraw = new ActorInstanceMultiDraw(owner.group);
        owner.multiDraw.perInstanceFrustum = perInstanceFrustum;
        if (!render.renderer.extensions.has('WEBGL_multi_draw')) throw Error('Actual native multi-draw extension required');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(-128, 0, -192); floor.receiveShadow = true; render.scene.add(floor);
        const models = [];
        for (const type of ['Skeleton', 'InfernoTitan', 'DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC']) {
            for (let i = 0; i < (type === 'Skeleton' ? 9 : 3); i++) {
                const mesh = await MeshFactory.createMeshForType(type);
                const cell = i % 3;
                mesh.position.set(-128 + Math.floor(i / 3) * 4 - 4 + models.length % 2,
                    0, -128 - cell * 64 + (type === 'Skeleton' ? -2 : 5 + models.length % 3));
                render.entityGroup.add(mesh); models.push({ type, mesh, position: mesh.position.clone() });
            }
        }
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(-128, 1, -192));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(-128, 0, -192), 0);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true }), reports = [];
        const capture = enabled => {
            owner.multiDraw.enabled = enabled; render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures,
                restored: !owner.hidden.length && !owner.group.visible && !owner.multiDraw.hidden.length && !owner.multiDraw.group.visible };
        };
        let image, failureRestored = false;
        try {
            for (const state of ['Idle', 'Run', 'Attack', 'Death', 'FarRealmRun', 'WideBucketRun', 'ShearedAttack']) {
                const offset = state === 'FarRealmRun' ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                const mixers = models.map(({ mesh, position }, i) => {
                    mesh.position.copy(position).add(offset); mesh.scale.set(...(state === 'ShearedAttack' ? [1.7, .8, 1.1] : [1, 1, 1]));
                    if (state === 'WideBucketRun' && i < 9) mesh.position.x += (Math.floor(i / 3) - 1) * 24;
                    const name = ['FarRealmRun', 'WideBucketRun'].includes(state) ? 'Run' : state === 'ShearedAttack' ? 'Attack' : state;
                    const clip = mesh.userData.animations.find(clip => clip.name === name) || mesh.userData.animations.find(clip => clip.name === 'Idle');
                    const mixer = new THREE.AnimationMixer(mesh); mixer.clipAction(clip).play(); mixer.update(.2 + i * .073); return mixer;
                });
                floor.position.copy(offset).add(new THREE.Vector3(-128, 0, -192));
                render.setCameraTarget(offset.clone().add(new THREE.Vector3(-128, 1, -192)));
                render.updateEnvironmentLighting(offset.clone().add(new THREE.Vector3(-128, 0, -192)), 0);
                const frozen = performance.now(), descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
                let before, after, again, entries;
                try {
                    Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
                    capture(false); capture(true); capture(false);
                    before = capture(false); after = capture(true);
                    entries = owner.multiDraw.entries.size;
                    if (state === 'Idle') image = canvas.toDataURL('image/png');
                    again = capture(false);
                } finally {
                    if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
                }
                let changedRGB = 0, unstableRGB = 0, maxChannelDifference = 0; const differences = [];
                for (let i = 0; i < before.pixels.length; i++) if (i % 4 !== 3) {
                    changedRGB += before.pixels[i] !== after.pixels[i] ? 1 : 0;
                    maxChannelDifference = Math.max(maxChannelDifference, Math.abs(before.pixels[i] - after.pixels[i]));
                    if (before.pixels[i] !== after.pixels[i] && differences.length < 64) differences.push({ x: Math.floor(i / 4) % copy.width, y: Math.floor(i / 4 / copy.width), channel: i % 4, before: before.pixels[i], after: after.pixels[i] });
                    unstableRGB += before.pixels[i] !== again.pixels[i] ? 1 : 0;
                }
                const strip = ({ pixels: _pixels, ...counts }) => counts;
                reports.push({ state, changedRGB, unstableRGB, maxChannelDifference, differences, entries, before: strip(before), after: strip(after), again: strip(again) });
                mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                models.forEach(({ mesh }) => mesh.userData.resetPose());
            }
            const visibility = new Map(); models.forEach(({ mesh }) => mesh.traverse(part => visibility.set(part, part.visible)));
            const previous = floor.onBeforeRender, failure = Error('Prepared multi-draw render failure');
            let observedFailure = false, hiddenDuringFailure = false;
            owner.multiDraw.enabled = true;
            floor.onBeforeRender = () => { hiddenDuringFailure = owner.multiDraw.hidden.length > 0; throw failure; };
            try { render.render(); } catch (error) { if (error !== failure) throw error; observedFailure = true; }
            finally { floor.onBeforeRender = previous; }
            failureRestored = observedFailure && hiddenDuringFailure && !owner.hidden.length && !owner.multiDraw.hidden.length &&
                !owner.group.visible && !owner.multiDraw.group.visible && [...visibility].every(([part, value]) => part.visible === value);
            capture(true);
        } finally {
            render.setActorInstancesEnabled(false);
            models.forEach(({ type, mesh }) => { mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); });
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return { reports, image, failureRestored };
}
