import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';

afterEach(() => jest.restoreAllMocks());

test('a changed shadow resolution releases its target, while a repeated setting retains it', () => {
    const render = new RenderSystem(false);
    try {
        const high = new THREE.WebGLRenderTarget(4096, 4096), releaseHigh = jest.spyOn(high, 'dispose');
        render.keyLight.shadow.map = high;
        render.setGraphicsQuality('medium');
        expect(releaseHigh).toHaveBeenCalledTimes(1);
        expect(render.keyLight.shadow.map).toBeNull();
        expect(render.keyLight.shadow.mapSize.toArray()).toEqual([2048, 2048]);
        const medium = new THREE.WebGLRenderTarget(2048, 2048), releaseMedium = jest.spyOn(medium, 'dispose');
        render.keyLight.shadow.map = medium;
        render.setGraphicsQuality('medium');
        expect(render.keyLight.shadow.map).toBe(medium);
        expect(releaseMedium).not.toHaveBeenCalled();
        render.setGraphicsQuality('low');
        expect(releaseMedium).toHaveBeenCalledTimes(1);
        expect(render.keyLight.shadow.map).toBeNull();
        expect(render.renderer.shadowMap.enabled).toBe(false);
        expect(render.composer).toBeNull();
        expect(render.bloomPass).toBeNull();
        expect(render.usePostProcessing).toBe(false);
    } finally { render.dispose(); }
});

test('postprocessing cleanup releases each owned pass once, including partial initialization', () => {
    const render = Object.create(RenderSystem.prototype);
    const bloom = { dispose: jest.fn() }, output = { dispose: jest.fn() }, partial = { dispose: jest.fn() };
    const composer = { passes: [bloom, output], dispose: jest.fn() };
    Object.assign(render, { composer, bloomPass: bloom, outputPass: output, fxaaPass: partial, usePostProcessing: true });
    render.disposePostProcessing(); render.disposePostProcessing();
    for (const resource of [bloom, output, partial, composer]) expect(resource.dispose).toHaveBeenCalledTimes(1);
    expect(render.composer).toBeNull(); expect(render.fxaaPass).toBeNull(); expect(render.usePostProcessing).toBe(false);
});

test('light replacement and teardown release shadow render targets without double disposal', () => {
    const render = new RenderSystem(false);
    const first = new THREE.WebGLRenderTarget(4096, 4096), firstDispose = jest.spyOn(first, 'dispose');
    render.keyLight.shadow.map = first; render.keyLight.shadow.mapPass = first;
    render.setupLights(); expect(firstDispose).toHaveBeenCalledTimes(1);
    const second = new THREE.WebGLRenderTarget(4096, 4096), secondDispose = jest.spyOn(second, 'dispose');
    render.keyLight.shadow.map = second;
    render.dispose(); expect(secondDispose).toHaveBeenCalledTimes(1);
});

test('switching back from Low recreates postprocessing without enabling it on phones', () => {
    for (const mobile of [false, true]) {
        const render = new RenderSystem(mobile);
        try {
            const initial = render.composer;
            render.setGraphicsQuality('low'); expect(render.composer).toBeNull();
            render.setGraphicsQuality('high');
            expect(render.usePostProcessing).toBe(!mobile);
            if (!mobile) { expect(render.composer).not.toBeNull(); expect(render.composer).not.toBe(initial); }
            else expect(render.composer).toBeNull();
        } finally { render.dispose(); }
    }
});
test('terminal disposal releases the owned context once after renderer cleanup', () => {
    const render = new RenderSystem(false);
    render.renderer.forceContextLoss = jest.fn();
    const dispose = jest.spyOn(render.renderer, 'dispose');
    render.dispose(); render.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(render.renderer.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(render.renderer.forceContextLoss.mock.invocationCallOrder[0]).toBeGreaterThan(dispose.mock.invocationCallOrder[0]);
});
