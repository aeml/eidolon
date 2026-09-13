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
    beforeEach(() => localStorage.clear());
    afterEach(() => { viewport(1024, 768); document.body.innerHTML = ''; });

    test('observes layout changes and releases both layout and viewport listeners on disposal', () => {
        viewport(390, 844);
        document.body.innerHTML = '<div id="phone-encounter-region"></div>';
        const region = document.getElementById('phone-encounter-region');
        let bounds = { left: 12, top: 216, width: 366, height: 348 };
        region.getBoundingClientRect = () => bounds;
        const originalObserver = globalThis.ResizeObserver;
        const observe = jest.fn(), disconnect = jest.fn();
        let notify;
        globalThis.ResizeObserver = class {
            constructor(callback) { notify = callback; }
            observe = observe;
            disconnect = disconnect;
        };
        let render;
        try {
            render = new RenderSystem(true);
            expect(observe).toHaveBeenCalledWith(region);
            const before = [...render.camera.projectionMatrix.elements];
            bounds = { ...bounds, top: 260, height: 300 };
            notify();
            expect(render.camera.projectionMatrix.elements).not.toEqual(before);
            expect(render.currentZoom).toBe(CONSTANTS.CAMERA.ZOOM);
            const resize = jest.spyOn(render, 'onWindowResize');
            window.dispatchEvent(new Event('resize'));
            expect(resize).toHaveBeenCalledTimes(1);
            render.dispose();
            expect(disconnect).toHaveBeenCalledTimes(1);
            window.dispatchEvent(new Event('resize'));
            expect(resize).toHaveBeenCalledTimes(1);
            render = null;
        } finally {
            render?.dispose();
            globalThis.ResizeObserver = originalObserver;
        }
    });

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

    test('phone zoom restores separately from desktop and menu preferences', () => {
        viewport(390, 844);
        const render = cameraOnly(true);
        localStorage.setItem('eidolon.cameraZoom', '18');
        localStorage.setItem('eidolon.phoneMenuTextScale', '115');
        render.setZoom(20);
        expect(localStorage.getItem('eidolon.phoneCameraZoom')).toBe('20');
        expect(localStorage.getItem('eidolon.cameraZoom')).toBe('18');
        expect(localStorage.getItem('eidolon.phoneMenuTextScale')).toBe('115');
        const restored = new RenderSystem(true);
        try { expect(restored.currentZoom).toBe(20); } finally { restored.dispose(); }
    });

    test('centers the hero in the shared encounter region, with correct ground raycasts', () => {
        viewport(390, 844);
        document.body.innerHTML = '<div id="phone-encounter-region"></div>';
        document.getElementById('phone-encounter-region').getBoundingClientRect = () => ({ left: 12, top: 216, width: 366, height: 348 });
        const render = cameraOnly(true);
        render.setCameraTarget(new THREE.Vector3(80, 0, 200));
        render.camera.updateMatrixWorld(true);
        const projected = render.cameraTarget.clone().project(render.camera);
        expect((1 - projected.y) * 844 / 2).toBeCloseTo(390);
        expect(projected.x).toBeCloseTo(0);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(projected.x, projected.y), render.camera);
        const ground = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        expect(ground.distanceTo(render.cameraTarget)).toBeLessThan(0.00001);
    });

    test('landscape framing also offsets horizontally without zooming actors out', () => {
        viewport(568, 320);
        document.body.innerHTML = '<div id="phone-encounter-region"></div>';
        document.getElementById('phone-encounter-region').getBoundingClientRect = () => ({ left: 134, top: 72, width: 226, height: 180 });
        const render = cameraOnly(true);
        render.camera.updateMatrixWorld(true);
        const p = render.cameraTarget.clone().project(render.camera);
        expect((p.x + 1) * 568 / 2).toBeCloseTo(247);
        expect((1 - p.y) * 320 / 2).toBeCloseTo(162);
        expect(render.camera.top - render.camera.bottom).toBe(24);
    });

    test('transient menus, chat and callouts never change encounter composition', () => {
        viewport(390, 844);
        document.body.innerHTML = '<div id="phone-encounter-region"></div><div id="chat-box"></div><div id="esc-menu"></div>';
        document.getElementById('phone-encounter-region').getBoundingClientRect = () => ({ left: 12, top: 216, width: 366, height: 348 });
        const render = cameraOnly(true);
        const before = [...render.camera.projectionMatrix.elements];
        document.getElementById('chat-box').style.height = '400px';
        document.getElementById('esc-menu').style.display = 'flex';
        render.updateCameraProjection();
        expect(render.camera.projectionMatrix.elements).toEqual(before);
    });

    test.each([{left:NaN,top:1,width:20,height:30},{left:1,top:1,width:0,height:30}])(
        'invalid or hidden encounter bounds retain a finite centered view', bounds => {
            viewport(390, 844);
            document.body.innerHTML = '<div id="phone-encounter-region"></div>';
            document.getElementById('phone-encounter-region').getBoundingClientRect = () => bounds;
            const render = cameraOnly(true);
            expect(render.camera.left).toBe(-render.camera.right);
            expect(render.camera.top).toBe(-render.camera.bottom);
            expect(render.camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
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
