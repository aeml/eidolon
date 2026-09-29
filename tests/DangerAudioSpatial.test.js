import * as THREE from 'three';
import { dangerAudioOptions } from '../src/audio/DangerAudioSpatial.js';

const listener = new THREE.Vector3();
const camera = new THREE.PerspectiveCamera();
camera.position.set(100, 100, 100); camera.lookAt(listener); camera.updateMatrixWorld();

test('danger pans in camera space, centres nearby sources and preserves both ears', () => {
    expect(dangerAudioOptions(listener, listener, camera, 6)).toEqual({ pan: 0, gain: 1 });
    expect(dangerAudioOptions({ x: 20, z: -20 }, listener, camera, 6).pan).toBe(.8);
    expect(dangerAudioOptions({ x: -20, z: 20 }, listener, camera, 6).pan).toBe(-.8);
    expect(dangerAudioOptions({ x: 20, z: 20 }, listener, camera, 6).pan).toBeCloseTo(0);
    expect(dangerAudioOptions({ x: 1, z: 0 }, listener, camera, 6).pan).toBeLessThan(.1);
    const reversed = camera.clone(); reversed.position.set(-100, 100, -100);
    reversed.lookAt(listener); reversed.updateMatrixWorld();
    expect(dangerAudioOptions({ x: 20, z: -20 }, listener, reversed, 6).pan).toBe(-.8);
});

test('attenuation uses the edge of the field and never changes the input position', () => {
    const source = { x: 40, z: 0 };
    expect(dangerAudioOptions(source, listener, camera, 10).gain).toBe(.25);
    expect(dangerAudioOptions({ x: 70, z: 0 }, listener, camera, 10)).toBeNull();
    expect(dangerAudioOptions({ x: 1000, z: 0 }, listener, camera, 1000).gain).toBe(1);
    expect(source).toEqual({ x: 40, z: 0 });
});

test('missing listener or non-finite positions stay silent; absent camera remains centred', () => {
    expect(dangerAudioOptions(listener, null, camera)).toBeNull();
    expect(dangerAudioOptions({ x: NaN, z: 0 }, listener, camera)).toBeNull();
    expect(dangerAudioOptions({ x: 4, z: 0 }, listener, null).pan).toBe(0);
});
