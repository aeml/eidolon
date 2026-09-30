import * as THREE from 'three';
import { jest } from '@jest/globals';
import { batchRigidShadowCasters, clearRigidShadowBatches, suspendRigidShadowBatches } from '../src/art/RigidShadowBatches.js';

function fixture() {
    const root = new THREE.Group(), pivot = new THREE.Group(), anchor = new THREE.Group();
    root.userData.proceduralHumanoid = true; pivot.name = 'AnimatedPivot';
    root.userData.animations = [new THREE.AnimationClip('Turn', 1,
        [new THREE.NumberKeyframeTrack('AnimatedPivot.rotation[y]', [0, 1], [0, 1])])];
    root.add(pivot); pivot.add(anchor); anchor.position.set(2, 0, 0);
    const sources = [0, 1].map(index => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: index ? 0xff5500 : 0x00aaff }));
        mesh.name = `source-${index}`; mesh.position.set(index * 2, 0, 0); mesh.castShadow = true;
        anchor.add(mesh); return mesh;
    });
    const batches = () => {
        const result = []; root.traverse(node => { if (node.userData.rigidShadowBatch) result.push(node); }); return result;
    };
    return { root, pivot, anchor, sources, batches };
}

test('combines only depth casters; visible source geometry, colour materials and names remain unchanged', () => {
    const { root, pivot, sources, batches } = fixture();
    const originals = sources.map(mesh => ({ geometry: mesh.geometry, material: mesh.material, name: mesh.name }));
    batchRigidShadowCasters(root);
    expect(batches()).toHaveLength(1); const mesh = batches()[0];
    expect(mesh.parent).toBe(pivot); expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.geometry.attributes.position.count).toBe(72);
    expect(Object.keys(mesh.geometry.attributes)).toEqual(['position']);
    expect(mesh.geometry.drawRange.count).toBe(0);
    expect(mesh.material.colorWrite).toBe(false); expect(mesh.material.depthWrite).toBe(false);
    for (const [index, source] of sources.entries()) {
        expect(source.castShadow).toBe(false); expect(source.visible).toBe(true);
        expect(source.geometry).toBe(originals[index].geometry); expect(source.material).toBe(originals[index].material);
        expect(root.getObjectByName(originals[index].name)).toBe(source);
    }
    mesh.onBeforeShadow(); expect(mesh.geometry.drawRange.count).toBe(72);
    mesh.onAfterShadow(); expect(mesh.geometry.drawRange.count).toBe(0);
    const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3()); expect(center.x).toBeCloseTo(3);
    clearRigidShadowBatches(root);
});

test('animation islands remain separate, including a directly animated mesh', () => {
    const f = fixture(), second = new THREE.Group(); second.name = 'OtherPivot'; f.root.add(second);
    f.root.userData.animations[0].tracks.push(new THREE.NumberKeyframeTrack('OtherPivot.rotation[y]', [0, 1], [0, -1]),
        new THREE.NumberKeyframeTrack('source-1.rotation[y]', [0, 1], [0, 1]));
    second.add(...f.sources.map(source => source.clone()));
    batchRigidShadowCasters(f.root);
    // source-1 in each island is itself animated; no cross-pivot folding.
    expect(f.batches()).toHaveLength(0); f.sources.forEach(source => expect(source.castShadow).toBe(true));
});

test.each(['transparent', 'alphaTest', 'alphaMap', 'displacementMap', 'customDepth', 'customDistance', 'clipping', 'wireframe', 'customVertex', 'morph', 'mirrored', 'partial', 'hidden', 'noCaster', 'materialArray', 'skinned'])('%s source retains its original caster', kind => {
    const f = fixture(), source = f.sources[1];
    if (kind === 'transparent') source.material.transparent = true;
    if (kind === 'alphaTest') source.material.alphaTest = .5;
    if (kind === 'alphaMap') source.material.alphaMap = new THREE.Texture();
    if (kind === 'displacementMap') source.material.displacementMap = new THREE.Texture();
    if (kind === 'customDepth') source.customDepthMaterial = new THREE.MeshDepthMaterial();
    if (kind === 'customDistance') source.customDistanceMaterial = new THREE.MeshDistanceMaterial();
    if (kind === 'clipping') source.material.clippingPlanes = [new THREE.Plane()];
    if (kind === 'wireframe') source.material.wireframe = true;
    if (kind === 'customVertex') source.material.onBeforeCompile = () => {};
    if (kind === 'morph') source.geometry.morphAttributes.position = [source.geometry.attributes.position.clone()];
    if (kind === 'mirrored') source.scale.x = -1;
    if (kind === 'partial') source.geometry.setDrawRange(0, 3);
    if (kind === 'hidden') source.visible = false;
    if (kind === 'noCaster') source.castShadow = false;
    if (kind === 'materialArray') source.material = [source.material];
    if (kind === 'skinned') source.isSkinnedMesh = true;
    batchRigidShadowCasters(f.root);
    expect(f.batches()).toHaveLength(0);
    expect(f.sources[0].castShadow).toBe(true); expect(source.castShadow).toBe(kind !== 'noCaster');
});

test.each(['side', 'shadowSide', 'layers'])('%s differences remain separate depth groups', kind => {
    const f = fixture(), source = f.sources[1];
    if (kind === 'side') source.material.side = THREE.DoubleSide;
    if (kind === 'shadowSide') source.material.shadowSide = THREE.FrontSide;
    if (kind === 'layers') source.layers.set(1);
    batchRigidShadowCasters(f.root); expect(f.batches()).toHaveLength(0);
});

test('suspension restores piece-level casters, reuses geometry and resumes once', () => {
    const f = fixture(); batchRigidShadowCasters(f.root);
    const mesh = f.batches()[0], geometry = mesh.geometry;
    suspendRigidShadowBatches(f.root, true); suspendRigidShadowBatches(f.root, true);
    expect(mesh.visible).toBe(false); f.sources.forEach(source => expect(source.castShadow).toBe(true));
    suspendRigidShadowBatches(f.root, false);
    expect(mesh.visible).toBe(true); expect(mesh.geometry).toBe(geometry);
    f.sources.forEach(source => expect(source.castShadow).toBe(false)); clearRigidShadowBatches(f.root);
});

test('refresh and repeated clear dispose only owned geometry/materials, never cached sources', () => {
    const f = fixture(); batchRigidShadowCasters(f.root);
    const mesh = f.batches()[0], ownGeometry = jest.spyOn(mesh.geometry, 'dispose'), ownMaterial = jest.spyOn(mesh.material, 'dispose');
    const shared = f.sources.flatMap(source => [jest.spyOn(source.geometry, 'dispose'), jest.spyOn(source.material, 'dispose')]);
    batchRigidShadowCasters(f.root);
    expect(ownGeometry).toHaveBeenCalledTimes(1); expect(ownMaterial).toHaveBeenCalledTimes(1);
    clearRigidShadowBatches(f.root); clearRigidShadowBatches(f.root);
    expect(f.batches()).toHaveLength(0); shared.forEach(spy => expect(spy).not.toHaveBeenCalled());
    f.sources.forEach(source => expect(source.castShadow).toBe(true)); jest.restoreAllMocks();
});

test('imported/nonprocedural roots and hidden ancestors are not folded', () => {
    const f = fixture(); f.root.userData.proceduralHumanoid = false;
    batchRigidShadowCasters(f.root); expect(f.batches()).toHaveLength(0);
    f.root.userData.proceduralHumanoid = true; f.anchor.visible = false;
    batchRigidShadowCasters(f.root); expect(f.batches()).toHaveLength(0);
});
