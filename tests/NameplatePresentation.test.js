import { Object3D, OrthographicCamera, Sprite, SpriteMaterial, Texture, Vector3 } from 'three';
import { chooseNameplates, NameplatePresentation } from '../src/core/NameplatePresentation.js';

const candidate = (id, changes = {}) => ({ id, priority: 4, distance: 5, wasVisible: false,
    left: 0, right: 100, top: 0, bottom: 22, ...changes });

test('an important new target displaces an overlapping previously visible name', () => {
    expect([...chooseNameplates([candidate('old', { wasVisible: true }), candidate('target', { priority: 0 })])])
        .toEqual(['target']);
});

test('stable labels win within a distance band; nearer bands remain preferred', () => {
    expect([...chooseNameplates([candidate('a'), candidate('b', { wasVisible: true })])]).toEqual(['b']);
    expect([...chooseNameplates([candidate('a'), candidate('b', { distance: 21, wasVisible: true })])]).toEqual(['a']);
});

test('selection is deterministic, bounded, and leaves candidate order/data unchanged', () => {
    const candidates = Object.freeze([Object.freeze(candidate('b')),
        Object.freeze(candidate('a')), Object.freeze(candidate('far', { left: 110, right: 210 }))]);
    expect([...chooseNameplates(candidates, 1)]).toEqual(['a']);
    expect([...chooseNameplates(candidates, 2)]).toEqual(['a', 'far']);
    expect(candidates[0].id).toBe('b');
});

function fixture() {
    const camera = new OrthographicCamera(-10, 10, 10, -10, .1, 100);
    camera.position.z = 20;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const make = (id, x = 0) => {
        const mesh = new Object3D();
        mesh.position.x = x;
        const texture = new Texture({ width: 150, height: 52 });
        const nameTag = new Sprite(new SpriteMaterial({ map: texture }));
        mesh.add(nameTag);
        return { id, nameTag, mesh, position: new Vector3(x, 0, 0), isActive: true };
    };
    const hero = make('hero'), target = make('enemy');
    const presentation = new NameplatePresentation();
    const options = { camera, width: 900, height: 900, player: hero, target };
    return { camera, hero, target, presentation, options, make };
}

test('readable pixel height survives zoom, phone dimensions, and parent scale', () => {
    const { camera, hero, target, presentation, options } = fixture();
    target.mesh.scale.setScalar(3);
    for (const [height, zoom] of [[900, 1], [844, 2], [390, .5]]) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        presentation.update([hero, target], { ...options, height });
        expect(target.nameTag.visible).toBe(true);
        expect(hero.nameTag.visible).toBe(false);
        expect(target.nameTag.scale.y * 3 / ((camera.top - camera.bottom) / zoom) * height).toBeCloseTo(22);
    }
});

test('clearing target priority restores eligible labels; dead and offscreen names stay hidden', () => {
    const { hero, target, presentation, options } = fixture();
    presentation.update([hero, target], options);
    target.state = 'DEAD';
    presentation.update([hero, target], { ...options, target: null });
    expect(hero.nameTag.visible).toBe(true);
    expect(target.nameTag.visible).toBe(false);
    hero.mesh.position.x = 30;
    presentation.update([hero, target], options);
    expect(hero.nameTag.visible).toBe(false);
});

test('NPC and party labels take priority without modifying any other mesh or marker', () => {
    const { hero, target, presentation, options, make } = fixture();
    const npc = make('npc'), party = make('party');
    party._partyHighlightActive = true;
    const marker = new Object3D();
    npc.mesh.add(marker);
    presentation.update([hero, target, npc, party], { ...options, target: null, isInteractable: e => e === npc });
    expect(npc.nameTag.visible).toBe(true);
    expect(party.nameTag.visible).toBe(false);
    expect(marker.visible).toBe(true);
    expect(npc.mesh.visible).toBe(true);
    presentation.update([hero, target, party], { ...options, target: null });
    expect(party.nameTag.visible).toBe(true);
});

test('world-only screenshot suspension does not re-expose account labels', () => {
    const { hero, target, presentation, options } = fixture();
    presentation.update([hero, target], options);
    presentation.suspended = true;
    target.nameTag.visible = false;
    presentation.update([hero, target], options);
    expect(target.nameTag.visible).toBe(false);
    presentation.suspended = false;
    presentation.update([hero, target], options);
    expect(target.nameTag.visible).toBe(true);
});

test('a quest name clears its marker without cumulative movement or moving the NPC', () => {
    const { hero, target, presentation, options } = fixture();
    target.questMarker = new Sprite(new SpriteMaterial());
    target.questMarker.position.y = .8;
    target.questMarker.scale.set(.85, 1.06, 1);
    target.mesh.add(target.questMarker);
    const meshPosition = target.mesh.position.clone();
    presentation.update([hero, target], options);
    const labelPosition = target.nameTag.position.clone();
    for (let i = 0; i < 20; i++) presentation.update([hero, target], options);
    expect(target.nameTag.position.distanceTo(labelPosition)).toBeLessThan(1e-9);
    expect(target.mesh.position.equals(meshPosition)).toBe(true);
    expect(target.questMarker.position.y).toBe(.8);
    expect(target.nameTag.position.y - target.nameTag.scale.y / 2)
        .toBeGreaterThan(target.questMarker.position.y + target.questMarker.scale.y / 2);
});
