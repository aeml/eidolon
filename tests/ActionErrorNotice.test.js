import { jest } from '@jest/globals';
import { ActionErrorNotice } from '../src/ui/ActionErrorNotice.js';

describe('nonblocking action error notice', () => {
    let notice;
    beforeEach(() => { jest.useFakeTimers(); document.body.replaceChildren(); notice = new ActionErrorNotice(); });
    afterEach(() => { notice.dispose(); jest.useRealTimers(); });

    test('renders text safely, bounds messages and replaces instead of stacking', () => {
        notice.show('<img src=x onerror=alert(1)>');
        expect(document.querySelector('[role="alert"] p').textContent).toBe('<img src=x onerror=alert(1)>');
        expect(document.querySelector('img')).toBeNull();
        expect(notice.show('<img src=x onerror=alert(1)>')).toBe(false);
        notice.show('x'.repeat(2000));
        expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
        expect(document.querySelector('[role="alert"] p').textContent).toHaveLength(500);
        jest.advanceTimersByTime(6000);
        expect(document.querySelector('[role="alert"]')).toBeNull();
    });

    test('can dismiss, rejects malformed input and clears owned timer/DOM on disposal', () => {
        expect(notice.show({ message: 'not text' })).toBe(false);
        expect(notice.show(' ')).toBe(false);
        notice.show('Not enough Gold');
        document.querySelector('button[aria-label="Dismiss error"]').click();
        expect(document.querySelector('[role="alert"]')).toBeNull();
        notice.show('Too far from merchant');
        notice.dispose();
        expect(document.querySelector('[role="alert"]')).toBeNull();
        expect(jest.getTimerCount()).toBe(0);
    });
});
