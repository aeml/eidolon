import { MeshStandardMaterial, NoColorSpace, RepeatWrapping } from 'three';
import { createWorldPathNetwork } from '../src/art/ProceduralWorldPaths.js';
import { applyElementalTrailGroundMaterial } from '../src/art/ElementalTrailGroundMaterial.js';

for (const realm of ['Water', 'Fire', 'Air']) for (const quality of ['high', 'low']) {
    test(`${realm} ${quality} trail owns its physical detail and retires it without disposing another world`, () => {
        const paths = [{ id: 'bent-route', width: 6, points: [[0, 0], [30, 0], [30, 30]] }];
        const a = createWorldPathNetwork(paths, { name: realm, quality });
        const b = createWorldPathNetwork(paths, { name: realm, quality });
        const material = a.children[0].material, other = b.children[0].material;
        const map = material.userData.elementalTrailDetail, otherMap = other.userData.elementalTrailDetail;
        expect(map.image.width).toBe(quality === 'low' ? 128 : 256);
        expect(map.colorSpace).toBe(NoColorSpace); expect(map.wrapS).toBe(RepeatWrapping); expect(map.wrapT).toBe(RepeatWrapping);
        expect(map.image.data).not.toBe(otherMap.image.data); expect(map.image.data).toEqual(otherMap.image.data);
        let disposed = 0, otherDisposed = 0;
        map.addEventListener('dispose', () => disposed++); otherMap.addEventListener('dispose', () => otherDisposed++);
        const hook = material.onBeforeCompile;
        applyElementalTrailGroundMaterial(material, realm, quality); expect(material.onBeforeCompile).toBe(hook);
        material.dispose(); material.dispose(); expect(disposed).toBe(1); expect(otherDisposed).toBe(0);
        other.dispose(); expect(otherDisposed).toBe(1);
        a.children[0].geometry.dispose(); b.children[0].geometry.dispose();
        material.map.dispose(); other.map.dispose();
    });
}

test('unsupported realms leave the material hook and resources untouched', () => {
    const material = new MeshStandardMaterial(), hook = material.onBeforeCompile;
    expect(() => applyElementalTrailGroundMaterial(material, 'Earth')).toThrow('Unsupported elemental trail');
    expect(material.onBeforeCompile).toBe(hook); expect(material.userData.elementalTrailDetail).toBeUndefined();
});
