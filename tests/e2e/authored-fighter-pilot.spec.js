import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test('derived Fighter assets render and animate with independent player skeletons', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const intake = await page.evaluate(async () => {
        const THREE = await import('three');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { createAuthoredFighterInstance, fighterRuntimePath } = await import('/src/art/AuthoredFighter.js');
        document.getElementById('start-screen').style.display = 'none';
        const started = performance.now();
        const inputs = await Promise.all(['high', 'low'].map(quality => MeshFactory.loadModel(fighterRuntimePath(quality))));
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(1280, 900); renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.shadowMap.enabled = true;
        renderer.domElement.id = 'fighter-pilot';
        Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', zIndex: '10000' });
        document.body.appendChild(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color('#171b23');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#303946', roughness: .9 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
        scene.add(new THREE.HemisphereLight('#d0deee', '#504238', 2));
        const key = new THREE.DirectionalLight('#ffe0ba', 3);
        key.position.set(-5, 10, 7); key.castShadow = true;
        key.shadow.camera.left = -12; key.shadow.camera.right = 12;
        key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
        key.shadow.mapSize.set(2048, 2048); scene.add(key);
        // Use the game's normal/bias policy, not WebGL's zero-bias default,
        // which produces self-shadow acne that resembles a bad skin texture.
        key.shadow.bias = -.00014;
        key.shadow.normalBias = .05;
        const camera = new THREE.PerspectiveCamera(35, 1280 / 900, .1, 80);
        camera.position.set(0, 4.2, 16); camera.lookAt(0, 2, 0);
        const actors = inputs.flatMap((input, index) => Array.from({ length: 2 }, (_, seat) => {
            const root = createAuthoredFighterInstance(input, { quality: index === 0 ? 'high' : 'low' });
            root.position.x = (index * 2 + seat - 1.5) * 3;
            scene.add(root);
            return { root, mixer: new THREE.AnimationMixer(root) };
        }));
        const renderPose = (clipName, yaw = 0, time = .25) => {
            for (const actor of actors) {
                actor.mixer.stopAllAction(); actor.root.userData.resetRestPose();
                const clip = actor.root.userData.animations.find(clip => clip.name === clipName);
                actor.mixer.clipAction(clip).reset().play(); actor.mixer.setTime(time);
                actor.root.rotation.y = yaw;
            }
            renderer.render(scene, camera);
        };
        renderPose('Idle');
        const body = actors[0].root.getObjectByName('Fighter_Body');
        const clonedBody = actors[1].root.getObjectByName('Fighter_Body');
        const independent = body.skeleton.bones.every((bone, index) => bone !== clonedBody.skeleton.bones[index]);
        const textureImages = [];
        for (const input of inputs) input.scene.traverse(part => {
            for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
                if (!material) continue;
                for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
                    const image = material[key]?.image;
                    if (image) textureImages.push([image.width, image.height]);
                }
            }
        });
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        window.fighterPilot = { THREE, renderer, scene, camera, actors, renderPose, inputs };
        return { loadMs: performance.now() - started, independent, textureImages,
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'not exposed',
            calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            skinCounts: actors.map(actor => { let count = 0; actor.root.traverse(part => { if (part.isSkinnedMesh) count++; }); return count; }) };
    });
    expect(intake.independent).toBe(true);
    expect(intake.skinCounts).toEqual([11, 11, 11, 11]);
    expect(intake.textureImages.length).toBeGreaterThan(0);
    expect(intake.textureImages.every(([width, height]) => width <= 1024 && height <= 1024 && width > 0 && height > 0)).toBe(true);
    for (const [clip, yaw] of [['Idle', 0], ['Run', Math.PI / 2], ['Attack', 0], ['Block', 0], ['Death', 0], ['Jump', Math.PI],
        ['Cast', 0], ['Channel', 0], ['Guard', 0], ['Shout', 0], ['Bless', 0]]) {
        const pose = await page.evaluate(({ clip, yaw }) => {
            const { renderPose, actors } = window.fighterPilot;
            renderPose(clip, yaw);
            let bad = 0;
            for (const actor of actors) actor.root.traverse(part => { if (!part.matrixWorld.elements.every(Number.isFinite)) bad++; });
            return bad;
        }, { clip, yaw });
        expect(pose).toBe(0);
        await page.locator('#fighter-pilot').screenshot({ path: testInfo.outputPath(`${clip}.png`) });
    }
    const movingCast = await page.evaluate(async () => {
        const { THREE, inputs } = window.fighterPilot;
        const { Actor } = await import('/src/entities/Actor.js');
        const { createAuthoredFighterInstance } = await import('/src/art/AuthoredFighter.js');
        return inputs.map((input, index) => {
            const make = () => {
                const actor = new Actor(`fighter-moving-pilot-${index}`, {});
                actor.meshType = 'Fighter'; actor.setMesh(createAuthoredFighterInstance(input, { quality: index === 0 ? 'high' : 'low' }));
                actor.isRemote = true; actor.state = 'MOVING'; actor.isRunning = true;
                actor.playAnimation('Run'); actor.updateAnimationMixer(.15);
                actor.playAbilityAnimation('Guardian Roar', { duration: 1 });
                return actor;
            };
            const actor = make(), baseline = make(), samples = [];
            baseline.movingCastGait.dispose(); baseline.movingCastGait = null;
            let upperBodyDifference = 0;
            for (let frame = 0; frame < 30; frame++) {
                actor.updateAnimationMixer(1 / 60); baseline.updateAnimationMixer(1 / 60);
                samples.push(actor.mesh.getObjectByName('thigh_r').quaternion.clone());
                for (const name of ['upperarm_r', 'lowerarm_r', 'spine_03']) {
                    // Float32 source rotations can be slightly non-unit;
                    // angleTo(q, q) then reports a false angle. Compare the
                    // actual mixer components to prove the mask left them alone.
                    const actual = actor.mesh.getObjectByName(name).quaternion.toArray();
                    const expected = baseline.mesh.getObjectByName(name).quaternion.toArray();
                    upperBodyDifference = Math.max(upperBodyDifference, ...actual.map((value, component) => Math.abs(value - expected[component])));
                }
            }
            actor.playHitReaction(new THREE.Vector3(-5, 0, 0), 10);
            const result = { stride: Math.max(...samples.map(pose => pose.angleTo(samples[0]))), upperBodyDifference,
                clip: actor.currentAnimationName, position: actor.position.toArray(), recoilRig: actor.hitReaction?.rig?.name };
            actor.dispose(); baseline.dispose();
            return result;
        });
    });
    for (const result of movingCast) {
        expect(result.stride).toBeGreaterThan(.1);
        expect(result.upperBodyDifference).toBeLessThan(1e-12);
        expect(result.position).toEqual([0, 0, 0]);
        expect(result.recoilRig).toBe('FighterVisualRig');
    }
    intake.movingCast = movingCast;
    await testInfo.attach('fighter-pilot-metrics', { body: JSON.stringify(intake, null, 2), contentType: 'application/json' });
    await writeFile(testInfo.outputPath('metrics.json'), JSON.stringify(intake, null, 2));
    expect(failures, failures.join('\n')).toEqual([]);
    await page.evaluate(() => {
        const { actors, renderer } = window.fighterPilot;
        actors.forEach(actor => { actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root); });
        renderer.dispose(); renderer.domElement.remove();
    });
});
