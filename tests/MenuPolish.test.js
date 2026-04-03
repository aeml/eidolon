import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import { UIManager } from '../src/ui/UIManager.js';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

const windowsCssPath = new URL('../src/styles/windows.css', import.meta.url).pathname;

function createTouchLikeEvent(type, options = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', {
        configurable: true,
        value: options.touches || [{ clientX: 100, clientY: 120 }]
    });
    return event;
}

describe('menu polish regressions', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        delete window.game;
    });

    test('window headers do not start dragging when close controls are pressed', () => {
        const uiManager = Object.create(UIManager.prototype);
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.innerHTML = `
            <div class="window-header">
                <span>Inventory</span>
                <span class="close-btn">×</span>
            </div>
            <div>Body</div>
        `;
        document.body.appendChild(windowEl);

        uiManager.setupWindow(windowEl);

        const closeBtn = windowEl.querySelector('.close-btn');
        closeBtn.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 160,
            clientY: 60
        }));

        expect(windowEl.style.position).toBe('');
        expect(windowEl.style.left).toBe('');
        expect(windowEl.style.top).toBe('');
    });

    test('window headers do not start dragging when close controls are tapped', () => {
        const uiManager = Object.create(UIManager.prototype);
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.innerHTML = `
            <div class="window-header">
                <span>Inventory</span>
                <span class="close-btn">×</span>
            </div>
            <div>Body</div>
        `;
        document.body.appendChild(windowEl);

        uiManager.setupWindow(windowEl);

        const closeBtn = windowEl.querySelector('.close-btn');
        closeBtn.dispatchEvent(createTouchLikeEvent('touchstart', {
            touches: [{ clientX: 180, clientY: 80 }]
        }));

        expect(windowEl.style.position).toBe('');
        expect(windowEl.style.left).toBe('');
        expect(windowEl.style.top).toBe('');
    });

    test('dungeon menu renders as a dismissible modal with header close and backdrop close', () => {
        const uiManager = Object.create(UIManager.prototype);
        window.game = { socket: { send: jest.fn() } };

        uiManager.showDungeonMenu({ hasInstance: false, isLeader: false });

        const backdrop = document.getElementById('dungeon-menu-backdrop');
        const menu = document.getElementById('dungeon-menu');
        const closeBtn = document.getElementById('btn-close-dungeon-menu');

        expect(backdrop).not.toBeNull();
        expect(menu).not.toBeNull();
        expect(closeBtn).not.toBeNull();

        closeBtn.click();
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();

        uiManager.showDungeonMenu({ hasInstance: false, isLeader: false });
        document.getElementById('dungeon-menu-backdrop').click();
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();
    });

    test('respec menu renders as a dismissible modal with header close and backdrop close', () => {
        const skillTree = new SkillTreeUI({
            getLastPlayer: () => ({ level: 12, gold: 9999 }),
            sendRespec: jest.fn()
        });

        skillTree.showRespecMenu();

        const backdrop = document.getElementById('respec-menu-backdrop');
        const menu = document.getElementById('respec-menu');
        const closeBtn = document.getElementById('btn-close-respec-menu');

        expect(backdrop).not.toBeNull();
        expect(menu).not.toBeNull();
        expect(closeBtn).not.toBeNull();

        closeBtn.click();
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();

        skillTree.showRespecMenu();
        document.getElementById('respec-menu-backdrop').click();
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();
    });

    test('dungeon and respec menus close on Escape and mark body text as non-selectable', () => {
        const uiManager = Object.create(UIManager.prototype);
        window.game = { socket: { send: jest.fn() } };

        uiManager.showDungeonMenu({ hasInstance: false, isLeader: false });
        const dungeonMenu = document.getElementById('dungeon-menu');
        expect(dungeonMenu).not.toBeNull();
        expect(dungeonMenu.style.userSelect).toBe('none');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();

        const skillTree = new SkillTreeUI({
            getLastPlayer: () => ({ level: 12, gold: 9999 }),
            sendRespec: jest.fn()
        });
        skillTree.showRespecMenu();

        const respecMenu = document.getElementById('respec-menu');
        expect(respecMenu).not.toBeNull();
        expect(respecMenu.style.userSelect).toBe('none');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();
    });

    test('window chrome disables accidental selection while preserving text selection inside form fields', () => {
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(css).toContain('user-select: none;');
        expect(css).toContain('.window input,');
        expect(css).toContain('user-select: text;');
        expect(css).toContain('.close-btn');
    });
});
