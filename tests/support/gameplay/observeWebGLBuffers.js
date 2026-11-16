// Prepared rendering tests only. Observe real uploads without replacing their
// results or changing GL bindings; never install this in the game runtime.
export function observeWebGLBuffers(gl) {
    const descriptor = Object.getOwnPropertyDescriptor(gl, 'bufferData');
    const original = gl.bufferData;
    const uploaded = new WeakMap();
    gl.bufferData = function (...args) {
        const result = original.apply(this, args);
        const [target, data] = args;
        if (ArrayBuffer.isView(data)) {
            const binding = target === gl.ARRAY_BUFFER ? gl.ARRAY_BUFFER_BINDING
                : target === gl.ELEMENT_ARRAY_BUFFER ? gl.ELEMENT_ARRAY_BUFFER_BINDING : null;
            if (binding !== null) uploaded.set(data, gl.getParameter(binding));
        }
        return result;
    };
    return {
        bufferFor: array => uploaded.get(array),
        restore() {
            if (descriptor) Object.defineProperty(gl, 'bufferData', descriptor);
            else delete gl.bufferData;
        }
    };
}
