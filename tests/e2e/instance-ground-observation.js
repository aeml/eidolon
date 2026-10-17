import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { DARK_REALM_PATHS, DARK_REALM_MAIN_PATHS } from '../../src/data/darkRealmPopulation.js';

// Optional read-only observations on existing authenticated routes. They grant
// no equipment, progression, location, party membership or marker visibility.
export async function captureInstanceGrounding(page, testInfo, label, minimumActors = 1) {
    if (process.env.EIDOLON_INSTANCE_GROUND_REVIEW !== '1') return;
    let readiness;
    try {
        await expect.poll(async () => {
            readiness = await page.evaluate(() => {
                const game = window.game, ids = new Set(game.uiManager.social.partyData?.members?.map(member => member.id) || []);
                return [game.player, ...game.remotePlayers.values()].filter(actor => actor === game.player || ids.has(actor.id))
                    .map(actor => ({ local: actor === game.player, class: actor.mesh?.userData.authoredClass || null,
                        fallback: Boolean(actor.mesh?.userData.assetFallback),
                        equippedItems: actor.mesh?.userData.equipmentVisualItemCount || 0,
                        missing: actor.mesh?.userData.equipmentVisualMissing || [],
                        equipmentFallback: actor.mesh?.userData.equipmentVisualFallback || [] }));
            });
            return readiness.filter(actor => actor.class && !actor.fallback && actor.equippedItems === 14 &&
                !actor.missing.length && !actor.equipmentFallback.length).length;
        }, { message: 'Server-delivered party meshes and complete outfits must be ready for grounding observation' }).toBeGreaterThanOrEqual(minimumActors);
    } finally {
        await writeFile(testInfo.outputPath(`grounding-readiness-${label}.json`), JSON.stringify({ actors: readiness }, null, 2));
    }
    const evidence = await page.evaluate(async () => {
        const THREE = await import('three');
        const game = window.game, render = game.renderSystem;
        const streets = game.getInstanceEnvironmentGroup().getObjectByName('Dark Realm authored paths');
        const ids = new Set(game.uiManager.social.partyData?.members?.map(member => member.id) || []), floors = [];
        game.getInstanceEnvironmentGroup().traverse(part => {
            if (part.name === 'DungeonUnionFloor' || part.name === 'dark-realm-union-floor' ||
                /^(?:Procedural)?Dungeon(?:Room|Corner|Corridor)Floor$/.test(part.name))
                floors.push({ name: part.name, y: part.getWorldPosition(new THREE.Vector3()).y });
        });
        const actors = [game.player, ...game.remotePlayers.values()].filter(actor => actor === game.player || ids.has(actor.id));
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { instance: game.currentInstanceId, type: game.currentInstanceType, quality: render.graphicsQuality,
            darkStreets: streets && { meshes: streets.children.length,
                ids: streets.children.flatMap(mesh => mesh.userData.worldPathIds || [mesh.userData.worldPathId]) },
            floors, overworldVisible: render.staticEnvironmentGroup.visible,
            calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            actors: actors.map(actor => {
                const ring = actor.mesh?.getObjectByName('PartyRing');
                return { local: actor === game.player, class: actor.mesh?.userData.authoredClass,
                    y: actor.position.y, meshY: actor.mesh?.position.y, fallback: Boolean(actor.mesh?.userData.assetFallback),
                    equippedItems: actor.mesh?.userData.equipmentVisualItemCount || 0,
                    equipmentMissing: actor.mesh?.userData.equipmentVisualMissing?.length || 0,
                    equipmentFallback: actor.mesh?.userData.equipmentVisualFallback?.length || 0,
                    partyRing: ring && { y: ring.getWorldPosition(new THREE.Vector3()).y, depthTest: ring.material.depthTest } };
            }) };
    });
    await writeFile(testInfo.outputPath(`grounding-${label}.json`), JSON.stringify({ ...evidence,
        scope: 'Read-only authenticated game observation on an existing prepared route. Scene floors, server/mesh heights and actual party markers; screenshot counts are not frame timing, capacity, physical-phone or earned prerequisite evidence.' }, null, 2));
    await page.screenshot({ path: testInfo.outputPath(`grounding-${label}.png`) });
    expect(evidence.floors.length).toBeGreaterThan(0);
    expect(evidence.floors.every(floor => Math.abs(floor.y) < 1e-8)).toBe(true);
    expect(evidence.actors.length).toBeGreaterThanOrEqual(minimumActors);
    if (process.env.EIDOLON_DARK_STREETS_REVIEW === '1' && evidence.type === 'dark_realm') {
        expect(evidence.darkStreets.meshes).toBe(DARK_REALM_MAIN_PATHS.length);
        expect(evidence.darkStreets.ids.sort()).toEqual(DARK_REALM_PATHS.map(path => path.id).sort());
    }
    for (const actor of evidence.actors) {
        expect(actor.class).toBeTruthy(); expect(actor.fallback).toBe(false);
        expect(actor.equippedItems).toBe(14); expect(actor.equipmentMissing).toBe(0); expect(actor.equipmentFallback).toBe(0);
        expect(actor.y).toBe(0); expect(actor.meshY).toBeCloseTo(0, 5);
        if (!actor.local) {
            expect(actor.partyRing).toBeTruthy(); expect(actor.partyRing.depthTest).toBe(true);
            expect(actor.partyRing.y).toBeCloseTo(.05, 5);
        }
    }
    if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(evidence.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
}

export async function captureGroundingReturn(page, testInfo, label) {
    if (process.env.EIDOLON_INSTANCE_GROUND_REVIEW !== '1') return;
    await expect.poll(() => page.evaluate(() => !window.game.currentInstanceId &&
        window.game.renderSystem.staticEnvironmentGroup.visible && window.game.renderSystem.currentRealm === 'town'),
    { message: 'Ordinary return must finish restoring town ground and atmosphere' }).toBe(true);
    const evidence = await page.evaluate(() => ({ instance: window.game.currentInstanceId,
        overworldVisible: window.game.renderSystem.staticEnvironmentGroup.visible,
        player: window.game.player.position.toArray(), realm: window.game.renderSystem.currentRealm }));
    await writeFile(testInfo.outputPath(`grounding-${label}.json`), JSON.stringify(evidence, null, 2));
    await page.screenshot({ path: testInfo.outputPath(`grounding-${label}.png`) });
    expect(evidence.instance || '').toBe(''); expect(evidence.overworldVisible).toBe(true); expect(evidence.realm).toBe('town');
}
