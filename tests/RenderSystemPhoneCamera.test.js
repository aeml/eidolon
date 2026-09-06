import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { CONSTANTS } from '../src/core/Constants.js';

function viewport(width, height) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function cameraOnly(isMobile) {
    const render = Object.create(RenderSystem.prototype);
    Object.assign(render, {
        isMobile, currentZoom: CONSTANTS.CAMERA.ZOOM,
        camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000),
        cameraTarget: new THREE.Vector3(), cameraOffset: new THREE.Vector3(100, 100, 100),
        renderer: { setSize: jest.fn() }, updateFxaaResolution: jest.fn()
    });
    render.updateCamera();
    render.onWindowResize();
    return render;
}

describe('phone camera composition', () => {
    afterEach(() => { viewport(1024, 768); document.body.innerHTML = ''; });

    test('desktop keeps its established vertical zoom and isometric direction', () => {
        viewport(1280, 800);
        const render = cameraOnly(false);
        expect(render.camera.right - render.camera.left).toBe(48);
        expect(render.camera.top - render.camera.bottom).toBe(30);
        expect(render.camera.position.toArray()).toEqual([100, 100, 100]);
    });

    test.each([[360, 800], [390, 844], [430, 932], [844, 390]])(
        '%sx%s uses a 24-unit short-axis view without maximum zoom', (width, height) => {
            viewport(width, height);
            const render = cameraOnly(true);
            const horizontal = render.camera.right - render.camera.left;
            const vertical = render.camera.top - render.camera.bottom;
            expect(Math.min(horizontal, vertical)).toBeCloseTo(24);
            expect(horizontal / vertical).toBeCloseTo(width / height);
            expect(render.currentZoom).toBe(CONSTANTS.CAMERA.ZOOM);
            expect(render.currentZoom).toBeLessThan(CONSTANTS.CAMERA.MAX_ZOOM);
        });

    test('rotation preserves pixel scale and manual zoom preference', () => {
        viewport(390, 844);
        const render = cameraOnly(true);
        render.setZoom(20);
        const pixelsPerUnit = 390 / (render.camera.right - render.camera.left);
        viewport(844, 390);
        render.onWindowResize();
        expect(390 / (render.camera.top - render.camera.bottom)).toBeCloseTo(pixelsPerUnit);
        expect(render.currentZoom).toBe(20);
    });

    test('centers the hero between persistent navigation and hotbar, with correct ground raycasts', () => {
        viewport(390, 844);
        document.body.innerHTML = '<div id="mobile-top-right"></div><div id="hotbar-container"></div>';
        document.getElementById('mobile-top-right').getBoundingClientRect = () => ({ top: 68, bottom: 112, width: 366, height: 44 });
        document.getElementById('hotbar-container').getBoundingClientRect = () => ({ top: 646, bottom: 776, width: 130, height: 130 });
        const render = cameraOnly(true);
        render.setCameraTarget(new THREE.Vector3(80, 0, 200));
        render.camera.updateMatrixWorld(true);
        const projected = render.cameraTarget.clone().project(render.camera);
        expect((1 - projected.y) * 844 / 2).toBeCloseTo(379);
        expect(projected.x).toBeCloseTo(0);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), render.camera);
        const ground = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        expect(ground.distanceTo(render.cameraTarget)).toBeLessThan(0.00001);
    });

    test('reset restores default zoom and follows the supplied hero position', () => {
        viewport(390, 844);
        const render = cameraOnly(true);
        render.setZoom(CONSTANTS.CAMERA.MAX_ZOOM);
        render.panCamera(100, -30);
        const hero = new THREE.Vector3(15, 0, 205);
        render.resetCamera(hero);
        expect(render.currentZoom).toBe(CONSTANTS.CAMERA.ZOOM);
        expect(render.cameraTarget.toArray()).toEqual(hero.toArray());
        expect(render.camera.right - render.camera.left).toBeCloseTo(24);
    });

    test('invalid dimensions and zoom do not poison camera matrices', () => {
        viewport(0, 0);
        const render = cameraOnly(true);
        render.setZoom(NaN);
        expect(render.currentZoom).toBe(CONSTANTS.CAMERA.ZOOM);
        expect(render.camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    });
});
