import { jest } from '@jest/globals';
import * as THREE from 'three';
import { InputManager } from '../src/core/InputManager.js';
import { ChronicleSite } from '../src/entities/ChronicleSite.js';
import { requestNearbyChronicleInspection } from '../src/core/ChronicleInspection.js';

test.each(['valid', 'far', 'dead', 'dungeon', 'offline', 'unaccepted', 'complete', 'menu', 'removed'])('nearby inspection stays scoped and server-confirmed: %s', mode => {
    const site = new ChronicleSite('chronicle-site-mara_diary');
    site.position.set(0, 0, mode === 'far' ? 5.01 : 4);
    site.isActive = mode !== 'removed';
    const quest = { id: 'chronicle_earth_keepers_house', accepted: mode !== 'unaccepted', completed: mode === 'complete', investigationMask: 0 };
    const engine = { isMultiplayer: mode !== 'offline', currentInstanceId: mode === 'dungeon' ? 'dungeon' : '',
        player: { id: 'reader', state: mode === 'dead' ? 'DEAD' : 'IDLE', position: new THREE.Vector3(), quests: [quest] },
        uiManager: { isEscMenuOpen: mode === 'menu' },
        // A hostile can remain hovered; E does not change attack targeting.
        hoveredEntity: { id: 'hostile' }, chunkManager: { getActiveEntities: () => [site] }, network: { send: jest.fn() } };
    expect(requestNearbyChronicleInspection(engine)).toBe(mode === 'valid');
    expect(engine.network.send).toHaveBeenCalledTimes(mode === 'valid' ? 1 : 0);
    expect(quest.investigationMask).toBe(0);
    expect(engine.hoveredEntity.id).toBe('hostile');
    if (mode === 'valid') expect(engine.network.send).toHaveBeenCalledWith('chronicle_inspect', { entityId: site.id });
});

test('E is deliberate, non-repeating and does not consume typing or modified keys', () => {
    const input = new InputManager({}, {});
    const inspect = jest.fn(); input.subscribe('onInspect', inspect);
    input.onKeyDown({ key: 'e', code: 'KeyE' });
    for (const extra of [{repeat:true},{ctrlKey:true},{altKey:true},{metaKey:true}]) input.onKeyDown({ key: 'e', code: 'KeyE', ...extra });
    const composer = document.createElement('input'); document.body.append(composer); composer.focus();
    input.onKeyDown({key:'e',code:'KeyE'});
    composer.remove();
    expect(inspect).toHaveBeenCalledTimes(1);
    input.dispose();
});

test('already recorded nearby evidence does not steal the next inspection', () => {
    const root = new ChronicleSite('chronicle-site-severed_root'), growth = new ChronicleSite('chronicle-site-new_growth');
    root.position.set(0,0,1); growth.position.set(0,0,4);
    const engine = { isMultiplayer:true,currentInstanceId:'',
        player:{id:'reader',state:'IDLE',position:new THREE.Vector3(),quests:[{id:'chronicle_earth_returning_scar',accepted:true,investigationMask:1}]},
        chunkManager:{getActiveEntities:()=>[root,growth]},network:{send:jest.fn()} };
    expect(requestNearbyChronicleInspection(engine)).toBe(true);
    expect(engine.network.send).toHaveBeenCalledWith('chronicle_inspect',{entityId:growth.id});
});
