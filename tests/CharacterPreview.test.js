import { jest } from '@jest/globals';
import * as THREE from 'three';
import { CharacterPreview } from '../src/ui/CharacterPreview.js';
import { BASE_ITEMS, RARITY } from '../src/core/ItemSystem.js';
import { EQUIPMENT_RENDER_SLOTS } from '../src/art/ProceduralEquipment.js';

function fixture(inspectPoses = false) {
    document.body.innerHTML = `<div id="preview">
        <div class="character-preview-label"></div>
        <div class="character-preview-stage"><span class="character-preview-status"></span></div>
        <button data-preview-turn="1">Right</button><button data-preview-turn="reset">Front</button>
    </div>`;
    const host = document.getElementById('preview');
    const stage = host.querySelector('.character-preview-stage');
    Object.defineProperties(stage, { clientWidth: { value: 300, configurable: true }, clientHeight: { value: 360 } });
    const renderer = Object.fromEntries(['setPixelRatio', 'setClearColor', 'setSize', 'render', 'dispose', 'forceContextLoss'].map((key) => [key, jest.fn()]));
    renderer.domElement = document.createElement('canvas');
    const createRenderer = jest.fn(() => renderer);
    const loadFighter = jest.fn(() => new Promise(() => {}));
    const loadCharacter = jest.fn(() => new Promise(() => {}));
    const preview = new CharacterPreview(host, { createRenderer, loadFighter, loadCharacter, inspectPoses });
    const player = { subType: 'Fighter', level: 7, equipment: { head: { id: 'helm', name: 'Iron Helm', rarity: 'COMMON' } } };
    return { host, stage, renderer, createRenderer, preview, player, loadFighter, loadCharacter };
}

test('creates graphics lazily and redraws gear changes, not health or XP ticks', () => {
    const { host, renderer, createRenderer, preview, player } = fixture();
    expect(createRenderer).not.toHaveBeenCalled();
    preview.update(player);
    expect(createRenderer).toHaveBeenCalledTimes(1);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.35);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(preview.model.userData.equipmentVisualItemCount).toBe(1);
    const model = preview.model;
    preview.update({ ...player, level: 8, xp: 25 });
    expect(host.querySelector('.character-preview-label').textContent).toBe('Fighter · Level 8');
    expect(renderer.render).toHaveBeenCalledTimes(1);
    player.equipment.head.potency = 3;
    preview.update(player);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(preview.model).toBe(model);
    delete player.equipment.head;
    preview.update(player);
    expect(preview.model.userData.equipmentVisualItemCount).toBe(0);
    expect(renderer.render).toHaveBeenCalledTimes(3);
    preview.dispose();
});

test('a late Fighter result cannot replace another class or revive a disposed preview', async () => {
    const { preview, player } = fixture();
    let resolve;
    preview.loadFighter = () => new Promise(done => { resolve = done; });
    const release = jest.spyOn((await import('../src/utils/MeshFactory.js')).MeshFactory, 'releaseMesh').mockImplementation(() => {});
    try {
        preview.update(player); await Promise.resolve();
        preview.update({ ...player, subType: 'Rogue' });
        const rogue = preview.model, late = rogue.clone();
        resolve(late); await new Promise(done => setTimeout(done, 0));
        expect(preview.model).toBe(rogue); expect(release).toHaveBeenCalledWith('Fighter', late);
        preview.update(player); await Promise.resolve(); preview.dispose();
        const afterDispose = rogue.clone(); resolve(afterDispose);
        await new Promise(done => setTimeout(done, 0));
        expect(release).toHaveBeenCalledWith('Fighter', afterDispose);
    } finally { preview.dispose(); release.mockRestore(); }
});

test('pending Fighter install uses the latest gear without an animation loop', async () => {
    const { preview, player, renderer } = fixture();
    const { createProceduralFighter } = await import('../src/art/ProceduralHumanoid.js');
    let resolve;
    preview.loadFighter = () => new Promise(done => { resolve = done; });
    preview.update(player); await Promise.resolve();
    player.equipment.head.potency = 4; preview.update(player);
    const loaded = createProceduralFighter(); resolve(loaded);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(preview.model).toBe(loaded);
    expect(loaded.userData.equipmentVisualSignature).toContain('4');
    const renders = renderer.render.mock.calls.length;
    preview.update({ ...player, xp: 50 }); expect(renderer.render).toHaveBeenCalledTimes(renders);
    expect(preview.previewMixer).toBeDefined(); preview.dispose();
});

test.each(['Rogue', 'Wizard', 'Cleric'])('%s preview uses the selected class/quality loader', async type => {
    const { preview, player, loadCharacter } = fixture();
    const { createProceduralRogue } = await import('../src/art/ProceduralHumanoid.js');
    let resolve;
    loadCharacter.mockImplementation(() => new Promise(done => { resolve = done; }));
    preview.update({ ...player, subType: type, mesh: { userData: { authoredQuality: 'low' } } });
    await Promise.resolve();
    expect(loadCharacter).toHaveBeenCalledWith(type, 'low');
    const model = createProceduralRogue();
    resolve(model); await preview.modelReady;
    expect(preview.model).toBe(model); expect(preview.previewMixer).toBeDefined();
    preview.dispose();
});

test('rotates on controls, fits finite bounds and skips hidden or disposed rendering', () => {
    const { host, stage, renderer, preview, player } = fixture();
    preview.update(player);
    host.querySelector('[data-preview-turn="1"]').click();
    expect(preview.model.rotation.y).toBeCloseTo(0.72);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    host.querySelector('[data-preview-turn="reset"]').click();
    expect(preview.model.rotation.y).toBeCloseTo(-0.28);
    for (const type of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
        preview.update({ ...player, subType: type });
        expect(preview.model.userData.proceduralClass).toBe(type);
        expect(preview.camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
        expect(preview.camera.top).toBeGreaterThan(0);
    }
    const count = renderer.render.mock.calls.length;
    Object.defineProperty(stage, 'clientWidth', { value: 0 });
    preview.render();
    expect(renderer.render).toHaveBeenCalledTimes(count);
    preview.dispose();
    preview.update(player);
    host.querySelector('[data-preview-turn="1"]').click();
    expect(renderer.render).toHaveBeenCalledTimes(count);
});

test('releases only owned graphics and disconnects controls once', () => {
    const { renderer, preview, player } = fixture();
    preview.update(player);
    const textureDispose = jest.spyOn(preview.environment, 'dispose');
    const sharedDisposes = [];
    preview.model.traverse((node) => {
        if (node.geometry) sharedDisposes.push(jest.spyOn(node.geometry, 'dispose'));
        if (node.material) sharedDisposes.push(jest.spyOn(node.material, 'dispose'));
    });
    preview.dispose();
    preview.dispose();
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(preview.scene.environment).toBeNull();
    expect(renderer.domElement.isConnected).toBe(false);
    sharedDisposes.forEach((dispose) => expect(dispose).not.toHaveBeenCalled());
    jest.restoreAllMocks();
});

test('falls back to equipment slots when another WebGL context is unavailable', () => {
    const { host, preview, player } = fixture();
    preview.createRenderer = jest.fn(() => { throw new Error('No context'); });
    expect(() => preview.update(player)).not.toThrow();
    preview.update(player);
    expect(preview.createRenderer).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Preview unavailable');
    preview.dispose();
});

test('class replacement and final disposal release owned loadout geometry, not shared sources', () => {
    const { preview, player } = fixture();
    player.equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map(slot => {
        const base = BASE_ITEMS.find(item => item.slot === slot.replace(/[12]$/, ''));
        return [slot, { ...base, id: `preview-${slot}`, baseName: base.name, rarity: RARITY.RARE }];
    }));
    const disposers = root => {
        const owned = [], shared = [];
        root.traverse(node => {
            if (!node.geometry) return;
            (node.userData.rigidEquipmentPivot ? owned : shared).push(jest.spyOn(node.geometry, 'dispose'));
        });
        expect(owned.length).toBeGreaterThan(0);
        return { owned, shared };
    };
    try {
        preview.update(player);
        const first = disposers(preview.model);
        preview.update({ ...player, subType: 'Rogue' });
        first.owned.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
        first.shared.forEach(spy => expect(spy).not.toHaveBeenCalled());
        const second = disposers(preview.model);
        preview.dispose(); preview.dispose();
        second.owned.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
        second.shared.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally { preview.dispose(); jest.restoreAllMocks(); }
});

function inspectionFixture() {
    const { preview, renderer, host } = fixture(); preview.initialize();
    const root = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), new THREE.MeshStandardMaterial());
    body.position.y = 2;
    const hidden = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshStandardMaterial()); hidden.visible = false;
    const held = new THREE.Group(); Object.assign(held.userData, { authoredEquipment: true, slot: 'offHand' });
    held.position.set(-1, 1.5, 0); held.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(new THREE.BoxGeometry(.5, .7, .03), new THREE.MeshStandardMaterial()); held.add(face);
    root.add(body, hidden, held); preview.model = root; preview.scene.add(root);
    return { preview, renderer, host, root, body, hidden, held, face };
}

test('held inspection frames the exact item front, preserves rotation controls and restores borrowed visibility', () => {
    const { preview, renderer, host, root, body, hidden, face } = inspectionFixture();
    preview.render(); const originalHeight = preview.camera.top;
    renderer.render.mockImplementation(() => { expect(body.visible).toBe(false); expect(hidden.visible).toBe(false); expect(face.visible).toBe(true); });
    preview.setFocusSlot('offHand');
    expect(preview.camera.top).toBeLessThan(originalHeight); expect(host.dataset.previewFocus).toBe('offHand');
    expect(Math.abs(preview.camera.up.dot(preview.focusDirection))).toBeLessThan(.000001);
    const direction = preview.focusDirection.clone(); host.querySelector('[data-preview-turn="1"]').click();
    expect(preview.focusDirection.equals(direction)).toBe(true); expect(root.rotation.y).toBe(preview.yaw);
    expect(body.visible).toBe(true); expect(hidden.visible).toBe(false); expect(face.visible).toBe(true);
    renderer.render.mockImplementation(() => {}); preview.setFocusSlot(null);
    expect(preview.camera.top).toBe(originalHeight); expect(preview.camera.up.toArray()).toEqual([0, 1, 0]);
    expect(host.dataset.previewFocus).toBe('character'); preview.dispose();
});

test('an inspection render error cannot leave the character or other equipment hidden', () => {
    const { preview, renderer, body, hidden, face } = inspectionFixture();
    renderer.render.mockImplementation(() => { throw Error('lost render context'); });
    expect(() => preview.setFocusSlot('offHand')).toThrow('lost render context');
    expect(body.visible).toBe(true); expect(hidden.visible).toBe(false); expect(face.visible).toBe(true);
    preview.dispose();
});

async function poseFixture() {
    const f = fixture(true);
    const { createProceduralFighter } = await import('../src/art/ProceduralHumanoid.js');
    const model = createProceduralFighter();
    model.userData.animations = [['Idle', .1], ['Run', 1], ['Attack', .5], ['Sword_Attack', .4], ['Dagger_Attack', -.6]]
        .map(([name, end]) => new THREE.AnimationClip(name, 1, [
            new THREE.NumberKeyframeTrack('Rig_Head.rotation[z]', [0, 1], [0, end])
        ]));
    f.preview.loadFighter = () => Promise.resolve(model);
    f.preview.update(f.player); await f.preview.modelReady; await model.userData.equipmentReady;
    await Promise.resolve();
    return { ...f, model, head: model.getObjectByName('Rig_Head') };
}

test('store pose controls stay disabled until loading, without changing ordinary character portraits', async () => {
    const f = fixture(true);
    expect(f.preview.poseControls.pose.disabled).toBe(true);
    expect(f.preview.poseControls.moment.disabled).toBe(true);
    expect(f.host.nextElementSibling).toBe(f.preview.poseControls.root);
    f.preview.dispose(); expect(document.querySelector('.character-pose-controls')).toBeNull();
    const ordinary = fixture(); ordinary.preview.update(ordinary.player);
    expect(ordinary.preview.poseControls).toBeUndefined();
    expect(document.querySelector('.character-pose-controls')).toBeNull(); ordinary.preview.dispose();
});

test('pose input samples actual tracks and clamps the end without wrapping to the start', async () => {
    const f = await poseFixture();
    try {
        const controls = f.preview.poseControls;
        expect([...controls.pose.options].map(option => option.value)).toEqual(['Idle', 'Run', 'Attack']);
        controls.pose.value = 'Run'; controls.pose.dispatchEvent(new Event('change'));
        expect(f.head.rotation.z).toBeCloseTo(.35);
        controls.moment.value = '100'; controls.moment.dispatchEvent(new Event('input'));
        expect(f.head.rotation.z).toBeCloseTo(1);
        expect(controls.moment.getAttribute('aria-valuetext')).toBe('100 percent of Running');
        controls.moment.value = '0'; controls.moment.dispatchEvent(new Event('input'));
        expect(f.head.rotation.z).toBeCloseTo(0);
        expect(f.preview.setPreviewPose('missing', .5)).toBe(false);
        expect(f.preview.setPreviewPose('Run', NaN)).toBe(false);
        const count = f.renderer.render.mock.calls.length;
        f.preview.update({ ...f.player, health: 20, xp: 800 });
        expect(f.renderer.render).toHaveBeenCalledTimes(count);
    } finally { f.preview.dispose(); }
});

test('garment or equipment refresh preserves the chosen pose and moment without touching real gear', async () => {
    const f = await poseFixture();
    try {
        f.preview.setPreviewPose('Attack', .8);
        f.player.equipment.head.potency = 4;
        const actual = JSON.stringify(f.player.equipment);
        f.preview.update(f.player); await f.model.userData.equipmentReady;
        expect(f.preview.previewPose).toBe('Attack'); expect(f.head.rotation.z).toBeCloseTo(.4);
        expect(f.preview.poseControls.moment.value).toBe('80');
        expect(JSON.stringify(f.player.equipment)).toBe(actual);
    } finally { f.preview.dispose(); }
});

test('dual wield inspection keeps its main-hand stroke stable and exposes the delivered offhand strike', async () => {
    const f = await poseFixture();
    try {
        const { prepareWeaponMotions } = await import('../src/art/AuthoredWeaponMotions.js');
        prepareWeaponMotions(f.model, f.model);
        Object.assign(f.model.userData, { weaponProfile: 'Sword', offhandWeaponProfile: 'Dagger', dualWield: true });
        f.preview.syncWeaponPose();
        f.preview.setPreviewPose('Attack', .2); expect(f.head.rotation.z).toBeCloseTo(.08);
        f.preview.setPreviewPose('Attack', .8); expect(f.head.rotation.z).toBeCloseTo(.32);
        expect(f.preview.getPoseClip('Attack').name).toBe('Sword_Attack');
        expect(f.preview.setPreviewPose('OffhandAttack', .5)).toBe(true);
        expect(f.head.rotation.z).toBeCloseTo(-.3);
        expect(f.preview.poseControls.pose.value).toBe('OffhandAttack');
    } finally { f.preview.dispose(); }
});

test('disposed pose controls cannot redraw or be revived by late model loads', async () => {
    const f = fixture(true); let resolve;
    f.preview.loadFighter = () => new Promise(done => { resolve = done; });
    const { createProceduralFighter } = await import('../src/art/ProceduralHumanoid.js');
    f.preview.update(f.player); await Promise.resolve();
    const controls = f.preview.poseControls, renders = f.renderer.render.mock.calls.length;
    f.preview.dispose(); resolve(createProceduralFighter()); await f.preview.modelReady;
    controls.pose.dispatchEvent(new Event('change')); controls.moment.dispatchEvent(new Event('input'));
    expect(document.querySelector('.character-pose-controls')).toBeNull();
    expect(f.renderer.render).toHaveBeenCalledTimes(renders); expect(f.preview.setPreviewPose('Run', .5)).toBe(false);
});
