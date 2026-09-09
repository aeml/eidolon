import { GroundInputUnavailableError, GroundPointerInterceptedError, movementFailure } from './groundInputFailure.js';

test('unavailable ground is distinct from a command that did not move', () => {
    const error = movementFailure('covered terrain', false, false);
    expect(error).toBeInstanceOf(GroundInputUnavailableError);
    expect(error.message).toBe('covered terrain');
});

test.each([[true, false], [false, true], [true, true]])(
    'issued pointer=%s keyboard=%s input cannot be silently skipped', (pointer, keyboard) => {
        const error = movementFailure('movement failed', pointer, keyboard);
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(GroundInputUnavailableError);
    });

const enemy = { id: 'crossing-enemy', active: true, hostile: true, state: 'MOVING' };
const interceptedAttempt = { clickProbe: { result: true, dom: 'CANVAS', mobile: false,
    after: enemy, stack: [enemy], pending: enemy } };

test('all clicks proven to target crossing enemies are not claimed as movement or no input', () => {
    const error = movementFailure('enemy crossed', true, false, [interceptedAttempt, interceptedAttempt]);
    expect(error).toBeInstanceOf(GroundPointerInterceptedError);
    expect(error).not.toBeInstanceOf(GroundInputUnavailableError);
});

test.each([
    [false, true, [interceptedAttempt]],
    [true, true, [interceptedAttempt]],
    [true, false, []],
    [true, false, [interceptedAttempt, {}]],
    [true, false, [{}, interceptedAttempt]],
    [true, false, [{ clickProbe: { ...interceptedAttempt.clickProbe, pending: null } }]]
])('any missing/failed movement or keyboard evidence remains a hard failure (%#)', (pointer, keyboard, attempts) => {
    const error = movementFailure('movement failed', pointer, keyboard, attempts);
    expect(error).not.toBeInstanceOf(GroundPointerInterceptedError);
    expect(error).not.toBeInstanceOf(GroundInputUnavailableError);
});
