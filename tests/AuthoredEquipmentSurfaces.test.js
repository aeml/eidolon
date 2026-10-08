import * as THREE from 'three';
import { jest } from '@jest/globals';
import { authoredEquipmentSurface, applyAuthoredEquipmentSurface, hasTrustedEquipmentSurfaceMaps } from '../src/art/AuthoredEquipmentSurfaces.js';
import { getEquipmentSurfaceMaps } from '../src/art/EquipmentSurfaceMaps.js';

test.each([
    ['standard cloth | main', 'cloth'], ['legendary cloth | main', 'cloth'],
    ['standard leather | main', 'leather'], ['legendary leather | main', 'leather'],
    ['standard wood | main', 'wood'], ['legendary wood | main', 'wood'],
    ['standard plate | main', 'metal'], ['legendary holy | main', 'metal'],
    ['standard cloth | edges', 'metal'], ['legendary leather | edges', 'metal'],
    ['Wrapped oxblood leather', 'leather'], ['Dark ashwood', 'wood'],
    ['Forged silver', 'metal'], ['Antique gold settings', 'metal'], ['Undersuit charcoal', 'cloth']
])('%s uses the shared %s surface without replacing supplied colors or PBR factors', (name, surface) => {
    expect(authoredEquipmentSurface(name)).toBe(surface);
    const material = new THREE.MeshStandardMaterial({ name, color: '#556677', roughness: .78, metalness: .15 });
    const color = material.color.clone(), maps = getEquipmentSurfaceMaps(surface);
    expect(applyAuthoredEquipmentSurface(material)).toBe(true);
    expect(material.color.equals(color)).toBe(true);
    expect(material.roughness).toBe(.78); expect(material.metalness).toBe(.15);
    for (const key of ['map', 'roughnessMap', 'bumpMap']) expect(material[key]).toBe(maps[key]);
    expect(material.bumpScale).toBe(maps.bumpScale);
    expect(hasTrustedEquipmentSurfaceMaps(material)).toBe(true);
    const copy = material.clone(), dispose = jest.spyOn(maps.map, 'dispose');
    expect(hasTrustedEquipmentSurfaceMaps(copy)).toBe(true);
    material.dispose(); copy.dispose(); expect(dispose).not.toHaveBeenCalled();
    dispose.mockRestore();
});

test.each(['legendary cloth | luminous inlay', 'standard wood | cut crystal', 'ruby standard jewel',
    'Vellum', 'Skin', 'unknown cloth', 'standard cloth | main extra', '__proto__', 'constructor'])('leaves %s unchanged', name => {
    expect(authoredEquipmentSurface(name)).toBeNull();
    const material = new THREE.MeshStandardMaterial({ name });
    expect(applyAuthoredEquipmentSurface(material)).toBe(false);
    expect(material.map).toBeNull(); expect(material.bumpMap).toBeNull();
});

test.each([
    ['authored map', material => { material.map = new THREE.Texture(); }],
    ['authored normal', material => { material.normalMap = new THREE.Texture(); }],
    ['emission', material => { material.emissive.set('#112233'); }],
    ['transparency', material => { material.transparent = true; }],
    ['opacity', material => { material.opacity = .5; }],
    ['custom shader', material => { material.onBeforeCompile = () => {}; }]
])('preserves the %s boundary', (_, change) => {
    const material = new THREE.MeshStandardMaterial({ name: 'standard cloth | main' });
    change(material);
    const before = material.toJSON();
    expect(applyAuthoredEquipmentSurface(material)).toBe(false);
    expect(material.toJSON()).toEqual(before);
});

test('trusted texture admission requires all exact maps and rejects foreign/replaced texture channels', () => {
    const material = new THREE.MeshStandardMaterial({ name: 'standard cloth | main' });
    expect(hasTrustedEquipmentSurfaceMaps(material)).toBe(false);
    applyAuthoredEquipmentSurface(material);
    for (const channel of ['map', 'roughnessMap', 'bumpMap', 'normalMap', 'envMap']) {
        const clone = material.clone(); clone[channel] = new THREE.Texture();
        expect(hasTrustedEquipmentSurfaceMaps(clone)).toBe(false);
    }
    const missing = material.clone(); missing.bumpMap = null;
    expect(hasTrustedEquipmentSurfaceMaps(missing)).toBe(false);
});
