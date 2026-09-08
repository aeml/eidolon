import { GroundInputUnavailableError, movementFailure } from './groundInputFailure.js';

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
