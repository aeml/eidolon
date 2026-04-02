import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/core/GameEngine.js', () => ({
    GameEngine: class MockGameEngine {
        async loadGame() {}
        destroy() {}
    }
}));

describe('asset persistence boot wiring', () => {
    test('main module registers the asset service worker on DOMContentLoaded', async () => {
        document.body.innerHTML = `
            <div id="debug-console"></div>
            <div id="start-screen"></div>
            <div id="loading-screen"></div>
            <div id="loading-bar-fill"></div>
            <div id="loading-text"></div>
            <input id="server-address" value="ws://localhost:8080/ws" />
            <input id="auth-username" value="test" />
            <input id="auth-email" value="test@example.com" />
            <input id="auth-password" value="secret" />
            <button id="btn-login"></button>
            <button id="btn-register"></button>
            <div id="auth-status"></div>
            <div id="login-panel"></div>
            <div id="class-selection-container"></div>
            <div id="play-container"></div>
            <button id="btn-play-character"></button>
            <button id="login-patch-notes-link"></button>
            <div id="patch-notes-screen"></div>
            <button id="btn-close-patch-notes"></button>
        `;

        const register = jest.fn(async () => ({ scope: './' }));
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                userAgent: 'jest',
                serviceWorker: { register }
            }
        });
        window.matchMedia = jest.fn().mockReturnValue({ addEventListener: jest.fn(), matches: false });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        expect(register).toHaveBeenCalledWith('./sw.js', { scope: './' });
    });

    test('login patch notes link and close button toggle the patch notes history screen', async () => {
        document.body.innerHTML = `
            <div id="debug-console"></div>
            <div id="start-screen"></div>
            <div id="loading-screen"></div>
            <div id="loading-bar-fill"></div>
            <div id="loading-text"></div>
            <input id="server-address" value="ws://localhost:8080/ws" />
            <input id="auth-username" value="test" />
            <input id="auth-email" value="test@example.com" />
            <input id="auth-password" value="secret" />
            <button id="btn-login"></button>
            <button id="btn-register"></button>
            <div id="auth-status"></div>
            <div id="login-panel"></div>
            <div id="class-selection-container"></div>
            <div id="play-container"></div>
            <button id="btn-play-character"></button>
            <button id="login-patch-notes-link"></button>
            <div id="patch-notes-screen" style="display:none"></div>
            <button id="btn-close-patch-notes"></button>
        `;

        const register = jest.fn(async () => ({ scope: './' }));
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                userAgent: 'jest',
                serviceWorker: { register }
            }
        });
        window.matchMedia = jest.fn().mockReturnValue({ addEventListener: jest.fn(), matches: false });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        const patchNotesScreen = document.getElementById('patch-notes-screen');
        document.getElementById('login-patch-notes-link').click();
        expect(patchNotesScreen.style.display).toBe('flex');
        document.getElementById('btn-close-patch-notes').click();
        expect(patchNotesScreen.style.display).toBe('none');
    });
});
