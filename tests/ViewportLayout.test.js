import { jest } from '@jest/globals';
import { ViewportLayout } from '../src/ui/ViewportLayout.js';

let layout;
const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
beforeEach(() => { document.body.replaceChildren(); });
afterEach(() => {
    layout?.dispose(); layout = null;
    if (previous) Object.defineProperty(window, 'visualViewport', previous); else delete window.visualViewport;
    document.body.replaceChildren();
});

function setup() {
    const viewport = Object.assign(new EventTarget(), { height: window.innerHeight - 300, scale: 1, offsetTop: 20 });
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    const ui = { isMobile: true, reflowVisibleWindows: jest.fn() };
    layout = new ViewportLayout(ui);
    const field = document.createElement('input'); document.body.append(field);
    return { ui, viewport, field };
}

test('a focused editor and keyboard-sized reduction reserve the visual bounds; blur restores the original UI', async () => {
    const { viewport, field } = setup();
    expect(document.body.dataset.phoneKeyboard).toBeUndefined();
    field.focus(); await Promise.resolve();
    expect(document.body.dataset.phoneKeyboard).toBe('true');
    expect(document.body.style.getPropertyValue('--phone-visible-height')).toBe(`${viewport.height}px`);
    expect(document.body.style.getPropertyValue('--phone-visible-top')).toBe('20px');
    field.blur(); await Promise.resolve();
    expect(document.body.dataset.phoneKeyboard).toBeUndefined();
    expect(document.body.style.getPropertyValue('--phone-visible-height')).toBe('');
});

test('browser zoom and small browser-chrome changes are not misidentified as a keyboard', async () => {
    const { viewport, field } = setup();
    viewport.scale = 2; field.focus(); await Promise.resolve();
    expect(document.body.dataset.phoneKeyboard).toBeUndefined();
    viewport.scale = 1; viewport.height = window.innerHeight - 70;
    viewport.dispatchEvent(new Event('resize'));
    expect(document.body.dataset.phoneKeyboard).toBeUndefined();
});

test('viewport resize/scroll reflow and disposal releases listeners and pending focus callbacks', async () => {
    const { ui, viewport, field } = setup();
    field.focus(); await Promise.resolve();
    viewport.offsetTop = 40; viewport.dispatchEvent(new Event('scroll'));
    expect(document.body.style.getPropertyValue('--phone-visible-top')).toBe('40px');
    const calls = ui.reflowVisibleWindows.mock.calls.length;
    field.blur(); layout.dispose(); await Promise.resolve();
    viewport.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize'));
    expect(ui.reflowVisibleWindows).toHaveBeenCalledTimes(calls);
    expect(document.body.dataset.phoneKeyboard).toBeUndefined();
});
