import { jest } from '@jest/globals';
import { InteractionCastUI } from '../src/ui/InteractionCastUI.js';

afterEach(() => { jest.useRealTimers(); document.body.replaceChildren(); });

test('cast timer displays progress and waits for server confirmation', () => {
    jest.useFakeTimers();
    const ui = new InteractionCastUI();
    ui.handle({ id: 1, kind: 'recall', state: 'started', duration: 3 });
    expect(ui.root.style.display).toBe('block');
    expect(ui.label.textContent).toContain('Lanternhold');
    expect(ui.hint.textContent).toBe('Move to cancel');
    jest.advanceTimersByTime(1500);
    expect(ui.progress.value).toBeCloseTo(.5);
    jest.advanceTimersByTime(4000);
    expect(ui.progress.value).toBe(1);
    expect(ui.root.style.display).toBe('block');
    ui.handle({ id: 1, kind: 'recall', state: 'completed' });
    expect(ui.root.style.display).toBe('none');
    expect(jest.getTimerCount()).toBe(0);
    ui.dispose();
});

test('stale cancellation cannot close a newer cast and dispose retires timers', () => {
    jest.useFakeTimers();
    const ui = new InteractionCastUI();
    ui.handle({ id: 1, kind: 'recall', state: 'started', duration: 3 });
    ui.handle({ id: 2, kind: 'chronicle_inspect', state: 'started', duration: 3 });
    ui.handle({ id: 1, kind: 'recall', state: 'cancelled' });
    expect(ui.root.style.display).toBe('block');
    expect(ui.id).toBe(2);
    expect(jest.getTimerCount()).toBe(1);
    ui.dispose();
    expect(jest.getTimerCount()).toBe(0);
    expect(document.getElementById('interaction-cast')).toBeNull();
});
