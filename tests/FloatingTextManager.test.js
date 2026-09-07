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
afterEach(() => { document.body.innerHTML = ''; viewport(1024, 768); });

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
