import * as THREE from 'three';
import { FloatingTextManager } from '../src/ui/FloatingTextManager.js';

let manager;
const fullName = 'ArchmageAurelianOfTheVeryLongCrystalWatch';
function viewport(width, height) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}
function spawnAction(source = fullName) {
    manager.spawn(`${source}: INTERVENTION UP`, new THREE.Vector3(), '#ffd36b', '16px', {
        compactActorAction: { source, action: 'INTERVENTION UP', anchorHeight: 4 }
    });
    return manager.texts.at(-1);
}
beforeEach(() => {
    viewport(390, 844);
    document.body.innerHTML = '<div id="ui-layer"></div>';
    const camera = new THREE.OrthographicCamera(-12, 12, 24, -24, .1, 200);
    camera.position.set(0, 20, 20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    manager = new FloatingTextManager(camera);
});
afterEach(() => { document.body.innerHTML = ''; delete document.documentElement.dataset.reducedMotion; viewport(1024, 768); });

test('compact action separates full actor identity from the readable action', () => {
    const t = spawnAction();
    expect(t.el.querySelector('[data-floating-source]')?.textContent).toBe(fullName);
    expect(t.el.querySelector('[data-floating-action]')?.textContent).toBe('INTERVENTION UP');
    expect(t.el.getAttribute('aria-label')).toBe(`${fullName}: INTERVENTION UP`);
    expect(t.el.style.pointerEvents).toBe('none');
    expect(parseFloat(t.el.style.width)).toBeLessThanOrEqual(192);
    expect(t.el.querySelector('[data-floating-source]').style.textOverflow).toBe('ellipsis');
});

test('local support omits the redundant source row without dropping its action', () => {
    const t = spawnAction('');
    expect(t.el.querySelector('[data-floating-source]')).toBeNull();
    expect(t.el.querySelector('[data-floating-action]')?.textContent).toBe('INTERVENTION UP');
});

test('pool reuse restores normal numeric feedback without compact-label styling', () => {
    const action = spawnAction(); manager.update(2);
    manager.spawn('1287', new THREE.Vector3(), '#0f0', '24px');
    const damage = manager.texts[0];
    expect(damage.el).toBe(action.el);
    expect(damage.el.children).toHaveLength(0);
    expect(damage.el.textContent).toBe('1287');
    expect(damage.el.style.width).toBe('');
    expect(damage.el.style.whiteSpace).toBe('nowrap');
    expect(damage.el.hasAttribute('aria-label')).toBe(false);
    expect(damage.scale).toBe(1.5);
});

test('compact labels retain scale limits and responsive width after rotation', () => {
    const t = spawnAction();
    expect(t.scale).toBeLessThanOrEqual(1.12);
    viewport(180, 320); manager.update(.1);
    expect(parseFloat(t.el.style.width) * t.scale).toBeLessThanOrEqual(156);
    viewport(844, 390); manager.update(.1);
    expect(parseFloat(t.el.style.width)).toBe(192);
    expect(t.el.style.transform).not.toContain('NaN');
});

test('dispose removes active and pooled nodes without removing unrelated HUD', () => {
    spawnAction(); manager.update(2); spawnAction(); manager.spawn('12', new THREE.Vector3());
    manager.dispose();
    expect(manager.texts).toHaveLength(0); expect(manager.pool).toHaveLength(0);
    expect(document.getElementById('ui-layer').children).toHaveLength(0);
    manager.spawn('late network feedback', new THREE.Vector3());
    expect(manager.texts).toHaveLength(0);
    expect(document.getElementById('ui-layer').children).toHaveLength(0);
});

test('offscreen actor labels are hidden and do not hide reused damage numbers', () => {
    const t = spawnAction(); t.position.x = 1000; manager.update(.1);
    expect(t.el.style.visibility).toBe('hidden');
    manager.update(2); manager.spawn('1287', new THREE.Vector3());
    expect(manager.texts[0].el.style.visibility).toBe('visible');
});

test('structured actor text is literal text, never executable markup', () => {
    const t = spawnAction('<img src=x onerror=alert(1)>');
    expect(t.el.querySelector('img')).toBeNull();
    expect(t.el.querySelector('[data-floating-source]').textContent).toBe('<img src=x onerror=alert(1)>');
});

test('plain skill messages wrap within the viewport and release their layout on numeric reuse', () => {
    manager.spawn('SERAPH SUMMONED!', new THREE.Vector3());
    const t = manager.texts[0];
    expect(t.bounded).toBe(true);
    expect(t.el.style.whiteSpace).toBe('normal');
    expect(parseFloat(t.el.style.maxWidth) * t.popScale).toBeCloseTo(366);
    viewport(844, 390); manager.update(.1);
    expect(parseFloat(t.el.style.maxWidth) * t.popScale).toBeCloseTo(820);
    t.position.x = 1000; manager.update(.1);
    expect(t.el.style.visibility).toBe('hidden');
    manager.update(2); manager.spawn('1287', new THREE.Vector3());
    const damage = manager.texts[0];
    expect(damage.el).toBe(t.el);
    expect(damage.bounded).toBe(false);
    expect(damage.el.style.maxWidth).toBe('');
    expect(damage.el.style.overflowWrap).toBe('');
    expect(damage.el.style.visibility).toBe('visible');
    expect(damage.popScale).toBe(1.5);
});

function sizedLabel(text, position = new THREE.Vector3(), compact = false) {
    manager.spawn(text, position, '#fff', '24px', compact ? {
        compactActorAction: { source: 'ALLY', action: text, anchorHeight: 2.5 }
    } : {});
    const t = manager.texts.at(-1);
    Object.defineProperty(t.el, 'offsetHeight', { configurable: true, get: () => compact ? 40 : 30 });
    Object.defineProperty(t.el, 'offsetWidth', { configurable: true, get: () => 190 });
    t.boxWidth = undefined; t.availableWidth = undefined;
    return t;
}
function expectSeparated(labels) {
    for (let i = 0; i < labels.length; i++) {
        const a = labels[i].layoutBox;
        expect(a.top).toBeGreaterThanOrEqual(12);
        expect(a.bottom).toBeLessThanOrEqual(window.innerHeight - 12);
        for (const t of labels.slice(i + 1)) {
            const b = t.layoutBox;
            expect(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left).toBe(true);
        }
    }
}

test('simultaneous skill and attributed party labels remain separate throughout animation and rotation', () => {
    const labels = ['WARD +100', 'SERAPH SUMMONED', 'INTERVENTION UP', 'STUNNED', 'ROOTED', 'ZEAL'].map(
        (text, i) => sizedLabel(text, new THREE.Vector3(), i % 2 === 1));
    for (const dt of [.01, .06, .13, .2]) { manager.update(dt); expectSeparated(labels); }
    viewport(844, 390); manager.update(.1); expectSeparated(labels);
    const afterLayout = labels.map(t => t.el.style.transform);
    manager.update(0);
    expect(labels.map(t => t.el.style.transform)).toEqual(afterLayout);
    manager.update(2);
    expect(manager.placedLabels).toHaveLength(0);
});

test('offscreen actions consume no slots and separate actors keep their own anchors', () => {
    viewport(1280, 720);
    sizedLabel('OFFSCREEN', new THREE.Vector3(1000, 0, 0));
    const left = sizedLabel('LEFT', new THREE.Vector3(-8, 0, 0));
    const right = sizedLabel('RIGHT', new THREE.Vector3(8, 0, 0));
    manager.update(0);
    expect(manager.placedLabels).toHaveLength(2);
    expect(left.layoutBox.top).toBe(right.layoutBox.top);
    expectSeparated([left, right]);
});

test('animation placement uses cached layout, and full viewports preserve feedback', () => {
    const labels = Array.from({ length: 30 }, (_, i) => sizedLabel(`ACTION ${i}`));
    manager.update(0);
    for (const t of labels) {
        Object.defineProperty(t.el, 'offsetWidth', { get: () => { throw Error('frame layout read'); } });
        Object.defineProperty(t.el, 'offsetHeight', { get: () => { throw Error('frame layout read'); } });
    }
    manager.update(.1);
    expect(manager.texts).toHaveLength(30);
    expect(labels.every(t => t.el.style.visibility === 'visible')).toBe(true);
    expect(labels.every(t => t.layoutBox.top >= 12 && t.layoutBox.bottom <= 832)).toBe(true);
});

test('live reduced motion stops float and pop while preserving damage, actions and expiry', () => {
    manager.spawn('120', new THREE.Vector3());
    manager.spawn('DANGER', new THREE.Vector3());
    manager.update(.05);
    document.documentElement.dataset.reducedMotion = 'true';
    manager.update(0);
    const positions = manager.texts.map(t => t.el.style.transform);
    manager.update(.4);
    expect(manager.texts.map(t => t.el.style.transform)).toEqual(positions);
    expect(manager.texts.every(t => t.scale === 1 && t.el.style.opacity === '1')).toBe(true);
    manager.spawn('NEW ACTION', new THREE.Vector3());
    expect(manager.texts.at(-1).scale).toBe(1);
    expect(manager.texts.at(-1).el.style.opacity).toBe('1');
    manager.update(2);
    expect(manager.texts).toHaveLength(0);
    delete document.documentElement.dataset.reducedMotion;
    manager.spawn('180', new THREE.Vector3());
    expect(manager.texts[0].scale).toBe(1.5);
});
