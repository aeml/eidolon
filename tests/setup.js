// Mock Canvas and WebGL
HTMLCanvasElement.prototype.getContext = () => { 
    return {
        getParameter: (param) => {
            // console.log('getParameter', param);
            if (param === 37445) return "WebGL 1.0"; // UNMASKED_VENDOR_WEBGL
            if (param === 37446) return "WebGL 1.0"; // UNMASKED_RENDERER_WEBGL
            if (param === 7938) return "WebGL 1.0"; // VERSION
            if (param === 35724) return "WebGL 1.0"; // SHADING_LANGUAGE_VERSION
            if (param === 7936) return "Vendor"; // VENDOR
            if (param === 7937) return "Renderer"; // RENDERER
            return "WebGL 1.0"; // Default to string to avoid crash
        },
        getExtension: () => ({
            loseContext: () => {}
        }),
        createTexture: () => {},
        bindTexture: () => {},
        texParameteri: () => {},
        texImage2D: () => {},
        texImage3D: () => {},
        clearColor: () => {},
        clear: () => {},
        enable: () => {},
        blendFunc: () => {},
        viewport: () => {},
        createProgram: () => {},
        createShader: () => {},
        shaderSource: () => {},
        compileShader: () => {},
        getShaderParameter: () => true,
        getProgramParameter: () => true,
        attachShader: () => {},
        linkProgram: () => {},
        useProgram: () => {},
        createBuffer: () => {},
        bindBuffer: () => {},
        bufferData: () => {},
        enableVertexAttribArray: () => {},
        vertexAttribPointer: () => {},
        drawArrays: () => {},
        drawElements: () => {},
        activeTexture: () => {},
        uniform1i: () => {},
        uniform1f: () => {},
        uniform2f: () => {},
        uniform3f: () => {},
        uniform4f: () => {},
        uniformMatrix4fv: () => {},
        getUniformLocation: () => {},
        getContextAttributes: () => ({
            alpha: true,
            antialias: true,
            depth: true,
            failIfMajorPerformanceCaveat: false,
            powerPreference: "default",
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            stencil: false,
            desynchronized: false
        }),
        getAttribLocation: () => {},
        clearDepth: () => {},
        clearStencil: () => {},
        depthFunc: () => {},
        depthMask: () => {},
        enable: () => {},
        disable: () => {},
        cullFace: () => {},
        frontFace: () => {},
        lineWidth: () => {},
        polygonOffset: () => {},
        scissor: () => {},
        viewport: () => {},
        pixelStorei: () => {},
        createFramebuffer: () => {},
        bindFramebuffer: () => {},
        createRenderbuffer: () => {},
        bindRenderbuffer: () => {},
        renderbufferStorage: () => {},
        framebufferTexture2D: () => {},
        framebufferRenderbuffer: () => {},
        checkFramebufferStatus: () => 36053, // FRAMEBUFFER_COMPLETE
        deleteFramebuffer: () => {},
        deleteRenderbuffer: () => {},
        deleteTexture: () => {},
        getShaderPrecisionFormat: () => ({
            rangeMin: 1,
            rangeMax: 1,
            precision: 1
        }),
        // Add more as needed by Three.js initialization
    };
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock crypto.randomUUID if not present
if (!global.crypto) {
    global.crypto = {};
}
if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = () => 'uuid-' + Math.random().toString(36).substr(2, 9);
}

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 16);
};
global.cancelAnimationFrame = (id) => {
    clearTimeout(id);
};

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

// Mock AudioContext (if used)
global.AudioContext = class {
    createGain() { return { connect: () => {}, gain: { value: 0 } }; }
    createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {} }; }
};
