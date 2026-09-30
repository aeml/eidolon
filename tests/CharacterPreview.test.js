import { jest } from '@jest/globals';
import { CharacterPreview } from '../src/ui/CharacterPreview.js';
import { BASE_ITEMS, RARITY } from '../src/core/ItemSystem.js';
import { EQUIPMENT_RENDER_SLOTS } from '../src/art/ProceduralEquipment.js';

function fixture() {
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
    const preview = new CharacterPreview(host, { createRenderer, loadFighter });
    const player = { subType: 'Fighter', level: 7, equipment: { head: { id: 'helm', name: 'Iron Helm', rarity: 'COMMON' } } };
    return { host, stage, renderer, createRenderer, preview, player, loadFighter };
}

test('creates graphics lazily and redraws gear changes, not health or XP ticks', () => {
    const { host, renderer, createRenderer, preview, player } = fixture();
    expect(createRenderer).not.toHaveBeenCalled();
    preview.update(player);
    expect(createRenderer).toHaveBeenCalledTimes(1);
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
