import { jest } from '@jest/globals';
import { PhoneMenuUI } from '../src/ui/PhoneMenuUI.js';

describe('phone menu composition', () => {
    let menu, close;
    beforeEach(() => {
        document.body.innerHTML = `<div id="mobile-top-right">
            <button id="btn-mobile-inv">Bag</button><button id="btn-mobile-char">Hero</button>
            <button id="btn-mobile-quest">Quests</button><button id="btn-mobile-map">Map</button>
            <button id="btn-mobile-social">Social</button><button id="btn-mobile-menu">Menu</button></div>
            <div id="esc-menu"><div class="window-header">PAUSED</div><div class="pause-menu__actions">
                <button id="btn-resume">Resume Game</button><button id="btn-settings">Settings</button></div></div>`;
        menu = document.getElementById('esc-menu'); close = jest.fn();
    });
    test('moves live navigation into one menu and keeps only Menu over the world', () => {
        const original = document.getElementById('btn-mobile-inv');
        new PhoneMenuUI(menu, close);
        expect(document.querySelectorAll('#mobile-top-right button')).toHaveLength(1);
        expect(menu.querySelectorAll('.phone-navigation button')).toHaveLength(5);
        expect(document.getElementById('btn-mobile-inv')).toBe(original);
        expect(menu.querySelector('.phone-navigation').getAttribute('aria-label')).toBe('Adventure menus');
        expect(menu.getAttribute('role')).toBe('dialog');
        expect(document.getElementById('btn-mobile-menu').getAttribute('aria-controls')).toBe('esc-menu');
    });
    test('keeps Back outside the scroller and retains its bound action', () => {
        const resume = document.getElementById('btn-resume'), action = jest.fn();
        resume.addEventListener('click', action);
        new PhoneMenuUI(menu, close);
        expect(menu.querySelector('.pause-menu__actions').contains(resume)).toBe(false);
        expect(resume.textContent).toBe('Back to game'); resume.click();
        expect(action).toHaveBeenCalledTimes(1);
        expect(menu.querySelector('.window-header').textContent).not.toContain('PAUSED');
    });
    test.each(['touchstart', 'click'])('closes the hub before the existing %s navigation handler', event => {
        const button = document.getElementById('btn-mobile-inv'), sequence = [];
        button.addEventListener(event, () => sequence.push('open bag'));
        new PhoneMenuUI(menu, () => sequence.push('close menu'));
        button.dispatchEvent(new Event(event, { bubbles: true }));
        expect(sequence).toEqual(['close menu', 'open bag']);
    });
    test('reinitialization retains one route and calls the current owner', () => {
        new PhoneMenuUI(menu, close);
        const next = jest.fn(); new PhoneMenuUI(menu, next);
        document.getElementById('btn-mobile-inv').click();
        expect(close).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledTimes(1);
        expect(menu.querySelectorAll('.phone-navigation')).toHaveLength(1);
        expect(document.querySelectorAll('#btn-resume')).toHaveLength(1);
    });
});
