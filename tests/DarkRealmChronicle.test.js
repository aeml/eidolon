import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { jest } from '@jest/globals';
import * as THREE from 'three';
import { darkRealmChapters, chronicleInvestigations } from '../src/data/chronicleCatalog.js';
import { getIlyraCompletionReply } from '../src/ui/QuestConversation.js';
import { ChronicleSite } from '../src/entities/ChronicleSite.js';
import { createChronicleSiteModel } from '../src/art/ChronicleSiteModels.js';
import { requestChronicleInspection } from '../src/core/ChronicleInspection.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { drawDarkRealmWorldMap, darkRealmObjectiveSites } from '../src/ui/DarkRealmMap.js';
import { darkRealmFixture } from './darkRealmFixture.js';

test('the client uses the exact authored campaign and checks generated content in CI', () => {
    const source = JSON.parse(fs.readFileSync('server/internal/game/content/dark-realm-chronicle.json', 'utf8'));
    expect(darkRealmChapters).toHaveLength(24);
    expect(chronicleInvestigations).toHaveLength(20);
    for (const [index, chapter] of source.entries()) {
        expect(darkRealmChapters[index]).toMatchObject(chapter);
        expect(getIlyraCompletionReply({ id: chapter.id })).toBe(chapter.completion);
        expect(getIlyraCompletionReply({ id: chapter.id, legacyOptional: true })).toBe(`This account joins the Chronicle. ${chapter.summary}`);
    }
    expect(execFileSync(process.execPath, ['scripts/generate-dark-realm-chronicle.mjs', '--check'], { encoding: 'utf8' })).toContain('38 discoveries');
});

const discoveries = darkRealmChapters.flatMap(chapter => (chapter.sites || []).map(site => ({ chapter, site })));

test('expedition map uses authoritative floors and only the player’s remaining accepted discoveries', () => {
    const chapter = darkRealmChapters[0];
    const quests = [{ id: chapter.id, accepted: true, investigationMask: 1 }];
    expect(darkRealmObjectiveSites(quests).map(site => site.id)).toEqual(chapter.sites.slice(1).map(site => site.id));
    expect(darkRealmObjectiveSites([{ ...quests[0], accepted: false }])).toEqual([]);
    expect(darkRealmObjectiveSites([{ ...quests[0], completed: true }])).toEqual([]);
    const ctx = Object.fromEntries(['fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'arc', 'fillText'].map(key => [key, jest.fn()]));
    const layout = darkRealmFixture();
    drawDarkRealmWorldMap(ctx, 390, 700, { currentDungeonLayout: layout }, { position: { x: 40000, z: 40800 }, quests });
    expect(ctx.closePath).toHaveBeenCalledTimes(layout.walkRects.length);
    expect(ctx.fillText.mock.calls.flat()).toContain('City Without Tomorrow');
    expect(ctx.fillText.mock.calls.flat()).not.toContain(chapter.sites[0].text);
    for (const [x, y] of ctx.arc.mock.calls) {
        expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(390);
        expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(700);
    }
});
test.each(discoveries)('$site.id has a usable, finite model and an open inspection approach', ({ chapter, site }) => {
    const entity = new ChronicleSite(site.entityId);
    expect(entity.discovery.chapter.id).toBe(chapter.id);
    const model = createChronicleSiteModel(site, 'dark');
    const bounds = new THREE.Box3().setFromObject(model.mesh);
    expect(bounds.isEmpty()).toBe(false);
    expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    for (let z = 5; z >= 0; z -= .25) {
        expect(model.walls.some(wall => wall.clone().expandByScalar(1).containsPoint(new THREE.Vector3(0, .5, z)))).toBe(false);
    }
    model.dispose();
});

test.each(['dark-realm', '', 'private-dungeon'])('Dark Realm discovery requests and delayed receipts stay in their own scene: %s', instanceId => {
    const { site } = discoveries[0];
    const entity = new ChronicleSite(site.entityId);
    entity.isActive = true;
    entity.position.set(site.x, 0, site.z);
    const engine = Object.create(GameEngine.prototype);
    Object.assign(engine, { isMultiplayer: true, currentInstanceId: instanceId,
        player: { id: 'reader', state: 'IDLE', position: entity.position.clone() },
        network: { send: jest.fn() }, sendPlayerMovementIfNeeded: jest.fn(),
        uiManager: { quest: { openChronicleDiscovery: jest.fn() } } });
    expect(requestChronicleInspection(engine, entity)).toBe(instanceId === 'dark-realm');
    if (instanceId !== 'dark-realm') return;
    expect(engine.pendingChronicleInspection.instanceId).toBe('dark-realm');
    const receipt = { questId: discoveries[0].chapter.id, siteId: site.id, recorded: true };
    engine.handleServerMessage({ type: 'chronicle_discovery', payload: receipt });
    expect(engine.uiManager.quest.openChronicleDiscovery).toHaveBeenCalledTimes(1);
    requestChronicleInspection(engine, entity);
    engine.currentInstanceId = '';
    engine.handleServerMessage({ type: 'chronicle_discovery', payload: receipt });
    expect(engine.uiManager.quest.openChronicleDiscovery).toHaveBeenCalledTimes(1);
});
