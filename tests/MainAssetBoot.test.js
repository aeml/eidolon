import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/core/GameEngine.js', () => ({
    GameEngine: class MockGameEngine {
        constructor() {
            this.uiManager = {
                handleEscape: jest.fn(),
                onFullscreenChange: null,
                onEscMenuChange: null,
                onEscMenuClosedByEscape: null
            };
        }
        async loadGame() {}
        destroy() {}
    }
}));

describe('asset persistence boot wiring', () => {
    const buildStartDom = () => {
        document.body.innerHTML = `
            <div id="debug-console"></div>
            <div id="perf-overlay"></div>
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
            <button class="class-btn" data-type="Fighter"></button>
            <div id="play-container"></div>
            <button id="btn-play-character"></button>
            <button id="login-patch-notes-link"></button>
            <div id="patch-notes-screen"></div>
            <button id="btn-close-patch-notes-header"></button>
            <button id="btn-close-patch-notes"></button>
            <div id="start-flow-title"></div>
            <div id="start-flow-copy"></div>
            <div id="start-flow-steps"></div>
        `;
    };

    const installBrowserMocks = () => {
        const register = jest.fn(async () => ({ scope: './' }));
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                userAgent: 'jest',
                serviceWorker: { register }
            }
        });
        window.matchMedia = jest.fn().mockReturnValue({ addEventListener: jest.fn(), matches: false });
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            writable: true,
            value: null
        });
        document.documentElement.requestFullscreen = jest.fn(async () => {
            document.fullscreenElement = document.documentElement;
        });
        document.exitFullscreen = jest.fn(async () => {
            document.fullscreenElement = null;
        });
        return { register };
    };

    test('main module registers the asset service worker on DOMContentLoaded', async () => {
        buildStartDom();
        const { register } = installBrowserMocks();

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        expect(register).toHaveBeenCalledWith('./sw.js', { scope: './' });
        expect(document.documentElement.dataset.eidolonReady).toBe('true');
    });

    test('login patch notes link, both close buttons, and Escape toggle the patch notes history screen', async () => {
        buildStartDom();
        document.getElementById('patch-notes-screen').style.display = 'none';
        installBrowserMocks();

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        const patchNotesScreen = document.getElementById('patch-notes-screen');
        document.getElementById('login-patch-notes-link').click();
        expect(patchNotesScreen.style.display).toBe('flex');
        document.getElementById('btn-close-patch-notes-header').click();
        expect(patchNotesScreen.style.display).toBe('none');

        document.getElementById('login-patch-notes-link').click();
        expect(patchNotesScreen.style.display).toBe('flex');
        document.getElementById('btn-close-patch-notes').click();
        expect(patchNotesScreen.style.display).toBe('none');

        document.getElementById('login-patch-notes-link').click();
        expect(patchNotesScreen.style.display).toBe('flex');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(patchNotesScreen.style.display).toBe('none');
    });

    test('shows returning-player first steps guidance when login succeeds with an existing character', async () => {
        buildStartDom();
        installBrowserMocks();
        const sockets = [];
        class MockWebSocket {
            static OPEN = 1;
            constructor() {
                this.readyState = MockWebSocket.OPEN;
                this.sent = [];
                sockets.push(this);
            }
            send(message) {
                this.sent.push(JSON.parse(message));
            }
        }

        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            value: MockWebSocket
        });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        document.getElementById('btn-login').click();
        expect(sockets).toHaveLength(1);
        sockets[0].onmessage({
            data: JSON.stringify({
                type: 'login_success',
                payload: {
                    hasCharacter: true,
                    characterType: 'Fighter',
                    message: 'Logged in!'
                }
            })
        });

        expect(document.getElementById('start-flow-title').textContent).toContain('Continue your character');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Enter world as Fighter');
        expect(document.getElementById('start-flow-steps').textContent).toContain('Open quests');
        expect(document.getElementById('btn-play-character').textContent).toContain('ENTER WORLD (Fighter)');
    });

    test('shows new-player first steps guidance when login succeeds without a character', async () => {
        buildStartDom();
        installBrowserMocks();
        const sockets = [];
        class MockWebSocket {
            static OPEN = 1;
            constructor() {
                this.readyState = MockWebSocket.OPEN;
                this.sent = [];
                sockets.push(this);
            }
            send(message) {
                this.sent.push(JSON.parse(message));
            }
        }

        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            value: MockWebSocket
        });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        document.getElementById('btn-login').click();
        expect(sockets).toHaveLength(1);
        sockets[0].onmessage({
            data: JSON.stringify({
                type: 'login_success',
                payload: {
                    hasCharacter: false,
                    message: 'Logged in!'
                }
            })
        });

        expect(document.getElementById('start-flow-title').textContent).toContain('Create your first character');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Choose a class');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Fighter for frontline control');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Rogue for burst and tricks');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Wizard for ranged spell pressure');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Cleric for healing and support');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Quest Giver');
        expect(document.getElementById('start-flow-copy').textContent).toContain('Forge');
        expect(document.getElementById('start-flow-steps').textContent).toContain('Skill Tree (K)');
        expect(document.getElementById('start-flow-steps').textContent).toContain('World Map (M)');
        expect(document.getElementById('start-flow-steps').textContent).toContain('Quest Giver by the Forge');
        expect(document.getElementById('start-flow-steps').textContent).toContain('vendor obvious junk');
        expect(document.getElementById('start-flow-steps').textContent).toContain('save Shards, Hearts, and Gems');
        expect(document.getElementById('start-flow-steps').textContent).toContain('level 30');
        expect(document.getElementById('start-flow-steps').textContent).toContain('Heroic and Mythic');
    });

    test('replaces a failed auth socket and sends the pending login after reconnect', async () => {
        jest.useFakeTimers();
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            buildStartDom();
            installBrowserMocks();
            const sockets = [];
            class MockWebSocket {
                static CONNECTING = 0;
                static OPEN = 1;
                static CLOSED = 3;
                constructor() {
                    this.readyState = MockWebSocket.CONNECTING;
                    this.sent = [];
                    sockets.push(this);
                }
                send(message) {
                    this.sent.push(JSON.parse(message));
                }
            }

            Object.defineProperty(globalThis, 'WebSocket', {
                configurable: true,
                value: MockWebSocket
            });

            await import('../src/main.js');
            window.dispatchEvent(new Event('DOMContentLoaded'));
            await Promise.resolve();

            document.getElementById('btn-login').click();
            expect(sockets).toHaveLength(1);
            sockets[0].readyState = MockWebSocket.CLOSED;
            sockets[0].onerror(new Event('error'));
            sockets[0].onclose(new Event('close'));

            await jest.advanceTimersByTimeAsync(500);
            expect(sockets).toHaveLength(2);
            sockets[1].readyState = MockWebSocket.OPEN;
            sockets[1].onopen();

            expect(sockets[1].sent).toEqual([{
                type: 'login',
                payload: { username: 'test', password: 'secret' }
            }]);
        } finally {
            errorSpy.mockRestore();
            jest.useRealTimers();
        }
    });

    test('persisted fullscreen preference applies when the loading screen starts, not on login', async () => {
        buildStartDom();
        installBrowserMocks();
        localStorage.setItem('eidolon.fullscreenEnabled', 'true');
        const sockets = [];

        class MockWebSocket {
            static OPEN = 1;
            constructor() {
                this.readyState = MockWebSocket.OPEN;
                sockets.push(this);
            }
            send() {}
        }

        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            value: MockWebSocket
        });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled();
        document.getElementById('btn-login').click();
        sockets[0].onmessage({
            data: JSON.stringify({
                type: 'login_success',
                payload: {
                    hasCharacter: false,
                    message: 'Logged in!'
                }
            })
        });

        document.querySelector('.class-btn')?.click();
        await Promise.resolve();

        expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    test('browser fullscreen exit during gameplay routes through escape handling so the menu still opens', async () => {
        buildStartDom();
        installBrowserMocks();
        localStorage.setItem('eidolon.fullscreenEnabled', 'true');
        const sockets = [];

        class MockWebSocket {
            static OPEN = 1;
            constructor() {
                this.readyState = MockWebSocket.OPEN;
                sockets.push(this);
            }
            send() {}
        }

        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            value: MockWebSocket
        });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        document.getElementById('btn-login').click();
        sockets[0].onmessage({
            data: JSON.stringify({
                type: 'login_success',
                payload: {
                    hasCharacter: false,
                    message: 'Logged in!'
                }
            })
        });

        document.querySelector('.class-btn')?.click();
        await Promise.resolve();

        document.fullscreenElement = document.documentElement;
        document.dispatchEvent(new Event('fullscreenchange'));
        document.fullscreenElement = null;
        document.dispatchEvent(new Event('fullscreenchange'));

        expect(window.game.uiManager.handleEscape).toHaveBeenCalledTimes(1);
    });

    test('closing the esc menu re-enters fullscreen when the setting is enabled', async () => {
        buildStartDom();
        installBrowserMocks();
        localStorage.setItem('eidolon.fullscreenEnabled', 'true');
        const sockets = [];

        class MockWebSocket {
            static OPEN = 1;
            constructor() {
                this.readyState = MockWebSocket.OPEN;
                sockets.push(this);
            }
            send() {}
        }

        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            value: MockWebSocket
        });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        document.getElementById('btn-login').click();
        sockets[0].onmessage({
            data: JSON.stringify({
                type: 'login_success',
                payload: {
                    hasCharacter: false,
                    message: 'Logged in!'
                }
            })
        });

        document.querySelector('.class-btn')?.click();
        await Promise.resolve();
        document.documentElement.requestFullscreen.mockClear();
        document.fullscreenElement = null;

        window.game.uiManager.onEscMenuChange(false);
        await Promise.resolve();

        expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    test('escape-closing the esc menu re-enters fullscreen when the setting is enabled', async () => {
        buildStartDom();
        installBrowserMocks();
        localStorage.setItem('eidolon.fullscreenEnabled', 'true');
        const sockets = [];

        class MockWebSocket {
            static OPEN = 1;
            constructor() {
                this.readyState = MockWebSocket.OPEN;
                sockets.push(this);
            }
            send() {}
        }

        Object.defineProperty(globalThis, 'WebSocket', {
            configurable: true,
            value: MockWebSocket
        });

        await import('../src/main.js');
        window.dispatchEvent(new Event('DOMContentLoaded'));
        await Promise.resolve();

        document.getElementById('btn-login').click();
        sockets[0].onmessage({
            data: JSON.stringify({
                type: 'login_success',
                payload: {
                    hasCharacter: false,
                    message: 'Logged in!'
                }
            })
        });

        document.querySelector('.class-btn')?.click();
        await Promise.resolve();
        document.documentElement.requestFullscreen.mockClear();
        document.fullscreenElement = null;

        window.game.uiManager.onEscMenuClosedByEscape();
        await Promise.resolve();

        expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    });
});
