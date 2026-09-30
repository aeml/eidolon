import { jest } from '@jest/globals';
import { ownedEvent, disposeOwnedEvents } from '../src/ui/OwnedEvents.js';

test('retiring an owner removes only its own persistent and global handlers', () => {
    const button = document.createElement('button'), old = {}, current = {};
    const first = jest.fn(), replacement = jest.fn(), external = jest.fn();
    button.addEventListener('click', external);
    ownedEvent(old, button, 'click', first); ownedEvent(current, button, 'click', replacement);
    disposeOwnedEvents(old); disposeOwnedEvents(old);
    button.click();
    expect(first).not.toHaveBeenCalled(); expect(replacement).toHaveBeenCalledTimes(1);
    expect(external).toHaveBeenCalledTimes(1);
    disposeOwnedEvents(current); button.click();
    expect(replacement).toHaveBeenCalledTimes(1); expect(external).toHaveBeenCalledTimes(2);
});

test.each([true, { capture: true }, { passive: true }, undefined])('capture/options %j are correctly removed', options => {
    const owner = {}, callback = jest.fn();
    ownedEvent(owner, document, 'lifetime-test', callback, options);
    document.dispatchEvent(new Event('lifetime-test')); expect(callback).toHaveBeenCalledTimes(1);
    disposeOwnedEvents(owner); document.dispatchEvent(new Event('lifetime-test'));
    expect(callback).toHaveBeenCalledTimes(1);
});

test('null controls and late registrations after disposal remain inert', () => {
    const owner = {}, callback = jest.fn();
    ownedEvent(owner, null, 'click', callback);
    disposeOwnedEvents(owner); ownedEvent(owner, window, 'lifetime-test', callback);
    window.dispatchEvent(new Event('lifetime-test')); expect(callback).not.toHaveBeenCalled();
});
