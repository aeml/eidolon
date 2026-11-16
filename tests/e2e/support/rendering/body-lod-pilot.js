import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function installBodyLodPilot(page) {
    const directory = process.env.EIDOLON_E2E_BODY_LOD_PILOT;
    if (!directory) return null;
    if (!path.isAbsolute(directory)) throw new Error('Body pilot root must be absolute');
    const root = fs.realpathSync(directory), responses = new Map(), requested = new Set();
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const selection = JSON.parse(fs.readFileSync('assets/archetypes/runtime-selection.json'));
    for (const relative of fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith('-body-pilot.json'))) {
        const receipt = JSON.parse(fs.readFileSync(path.join(root, relative)));
        const actorClass = receipt.actorClass;
        if (!['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(actorClass)) throw new Error('Unknown body class');
        const manifest = JSON.parse(fs.readFileSync(`assets/archetypes/${actorClass}/${actorClass.toLowerCase()}-runtime.manifest.json`));
        if (manifest.source.sha256 !== receipt.sourceHash) throw new Error('Body source identity mismatch');
        for (const quality of ['high', 'low']) {
            const variant = receipt.variants[quality], file = fs.realpathSync(variant.file);
            const legacyFile = `assets/archetypes/${actorClass}/${actorClass.toLowerCase()}-runtime-${quality}.glb`;
            const selected = selection.characters[actorClass].variants[quality];
            const previous = selection.characters[actorClass].previousVariants?.[quality]?.find(v => v.file === variant.baselineFile);
            const baselineHash = variant.baselineFile === selected.file ? selected.sha256
                : previous?.sha256 || (variant.baselineFile === legacyFile ? manifest.variants[quality].sha256 : null);
            if (!baselineHash || baselineHash !== variant.baselineSHA256 ||
                hash(fs.readFileSync(variant.baselineFile)) !== variant.baselineSHA256 ||
                hash(fs.readFileSync(selected.file)) !== selected.sha256) throw new Error('Reviewed body baseline mismatch');
            if (!file.startsWith(root + path.sep) || variant.gltfErrors !== 0 || variant.gltfWarnings !== 0) throw new Error('Invalid body pilot');
            const body = fs.readFileSync(file);
            if (hash(body) !== variant.sha256) throw new Error('Body pilot hash mismatch');
            const url = '/' + selected.file;
            if (responses.has(url)) throw new Error('Duplicate body pilot URL');
            responses.set(url, { body, actorClass, quality, sha256: variant.sha256,
                reviewedBaselineFile: variant.baselineFile, runtimeSelectedSHA256: selected.sha256 });
        }
    }
    if (responses.size !== 8) throw new Error('Body pilot requires all four High/Low classes');
    await page.route('**/assets/archetypes/**', async route => {
        const url = new URL(route.request().url()).pathname, response = responses.get(url);
        if (!response) { await route.continue(); return; }
        requested.add(url);
        await route.fulfill({ body: response.body, contentType: 'model/gltf-binary', headers: { 'cache-control': 'no-store' } });
    });
    return { read: () => ({ candidates: responses.size, requested: [...requested].sort().map(url => {
        const { body: _body, ...entry } = responses.get(url); return { url, ...entry };
    }) }) };
}

export async function captureBodyLodReview(page, testInfo) {
    const samples = [];
    const asymmetric = process.env.EIDOLON_E2E_BODY_MORPH_BASIS_COMPARE === '1';
    try {
        await page.evaluate(() => {
            const qa = window.__classGear;
            qa.bodyReviewCamera = { position: qa.camera.position.clone(), quaternion: qa.camera.quaternion.clone() };
        });
        for (let index = 0; index < 8; index++) {
            await page.evaluate(async index => {
                const qa = window.__classGear, entry = qa.actors[index];
                for (const other of qa.actors) other.root.visible = other === entry;
                entry.actor.syncEquipmentVisuals({}); await entry.root.userData.equipmentReady;
            }, index);
            const poses = [
                ['face-open', 'Idle', .2, 0, 0, true], ['face-blink', 'Idle', .2, 0, 1, true],
                ['bare-back-run', 'Run', .3, Math.PI, 0, false], ['bare-side-attack', 'Attack', 14 / 30, Math.PI / 2, 0, false]
            ];
            if (asymmetric) poses.push(['face-left-blink', 'Idle', .2, 0, [1, 0], true],
                ['face-right-blink', 'Idle', .2, 0, [0, 1], true], ['face-partial-blink', 'Idle', .2, 0, [.5, .25], true]);
            for (const [label, state, time, yaw, blink, close] of poses) {
                const sample = await page.evaluate(({ index, label, state, time, yaw, blink, close }) => {
                    const qa = window.__classGear, entry = qa.actors[index], body = entry.root.getObjectByName(`${entry.type}_Body`);
                    qa.sample(state, time, yaw);
                    const [blinkLeft, blinkRight] = Array.isArray(blink) ? blink : [blink, blink];
                    entry.root.traverse(part => {
                        for (const name of ['Blink_L', 'Blink_R']) {
                            const morph = part.morphTargetDictionary?.[name];
                            if (morph !== undefined) part.morphTargetInfluences[morph] = name === 'Blink_L' ? blinkLeft : blinkRight;
                        }
                    });
                    const offset = entry.root.position.clone();
                    qa.camera.position.copy(offset).add({ x: 0, y: close ? 3.9 : 2.25, z: close ? 2.4 : 8 });
                    qa.camera.lookAt(offset.add({ x: 0, y: close ? 3.85 : 2.25, z: 0 }));
                    entry.root.updateMatrixWorld(true); qa.renderer.render(qa.scene, qa.camera);
                    const point = body.position.clone(), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
                    let badVertices = 0;
                    for (let i = 0; i < body.geometry.attributes.position.count; i++) {
                        body.getVertexPosition(i, point);
                        if (!point.toArray().every(Number.isFinite) || point.length() > 10) badVertices++;
                        point.toArray().forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
                    }
                    return { type: entry.type, quality: entry.quality, label, state, yaw, blink, blinkLeft, blinkRight, badVertices,
                        bodyTriangles: body.geometry.index.count / 3, authoredScale: entry.root.userData.authoredScale,
                        morphNames: Object.keys(body.morphTargetDictionary).sort(), morphInfluences: body.morphTargetInfluences.slice(),
                        posedLocalBounds: { min, max } };
                }, { index, label, state, time, yaw, blink, close });
                samples.push(sample);
                await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`${sample.type}-${sample.quality}-${label}.png`) });
            }
        }
    } finally {
        await page.evaluate(async () => {
            const qa = window.__classGear;
            for (const entry of qa.actors) { entry.root.visible = true; entry.actor.syncEquipmentVisuals(entry.gear); await entry.root.userData.equipmentReady; }
            qa.camera.position.copy(qa.bodyReviewCamera.position); qa.camera.quaternion.copy(qa.bodyReviewCamera.quaternion);
            qa.sample('CombatIdle'); delete qa.bodyReviewCamera;
        });
    }
    return samples;
}
