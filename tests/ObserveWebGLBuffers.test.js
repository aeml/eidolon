import { jest } from '@jest/globals';
import { observeWebGLBuffers } from './observeWebGLBuffers.js';

function context() {
    const buffer = {};
    const original = jest.fn(function () { expect(this).toBe(gl); return 7; });
    const gl = Object.assign(Object.create({ bufferData: original }), {
        ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2,
        ARRAY_BUFFER_BINDING: 3, ELEMENT_ARRAY_BUFFER_BINDING: 4,
        getParameter: jest.fn(() => buffer)
    });
    return { gl, original, buffer };
}

test.each([[1, 3], [2, 4]])('observes target %i after forwarding the exact upload', (target, binding) => {
    const { gl, original, buffer } = context();
    const observer = observeWebGLBuffers(gl), data = new Float32Array(16);
    expect(gl.bufferData(target, data, 35048, 2, 4)).toBe(7);
    expect(original).toHaveBeenCalledWith(target, data, 35048, 2, 4);
    expect(gl.getParameter).toHaveBeenCalledWith(binding);
    expect(observer.bufferFor(data)).toBe(buffer);
    expect(observer.bufferFor(new Float32Array(16))).toBeUndefined();
    observer.restore(); observer.restore();
    expect(gl.bufferData).toBe(original);
    expect(Object.hasOwn(gl, 'bufferData')).toBe(false);
});

test('does not invent observations for allocation sizes or unrelated targets', () => {
    const { gl, original } = context(), observer = observeWebGLBuffers(gl);
    const data = new Float32Array(4);
    gl.bufferData(1, 128, 35048); gl.bufferData(99, data, 35048);
    expect(original).toHaveBeenCalledTimes(2);
    expect(gl.getParameter).not.toHaveBeenCalled();
    expect(observer.bufferFor(data)).toBeUndefined(); observer.restore();
});

test('preserves an upload error and does not record a failed upload', () => {
    const { gl, original } = context(), observer = observeWebGLBuffers(gl);
    original.mockImplementation(() => { throw new Error('upload failed'); });
    const data = new Float32Array(4);
    expect(() => gl.bufferData(1, data, 35048)).toThrow('upload failed');
    expect(observer.bufferFor(data)).toBeUndefined();
    expect(gl.getParameter).not.toHaveBeenCalled(); observer.restore();
});

test('restores an existing own method descriptor', () => {
    const { gl, original } = context();
    Object.defineProperty(gl, 'bufferData', { value: original, configurable: true, writable: true });
    const before = Object.getOwnPropertyDescriptor(gl, 'bufferData');
    const observer = observeWebGLBuffers(gl); observer.restore();
    expect(Object.getOwnPropertyDescriptor(gl, 'bufferData')).toEqual(before);
});
