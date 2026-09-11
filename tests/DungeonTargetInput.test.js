import { jest } from '@jest/globals';
import { aimDungeonCombatTarget } from './dungeonTargetInput.js';

const makeInput = () => ({
    project: jest.fn().mockResolvedValue({ x: 100, y: 200, visible: true }),
    move: jest.fn(), settle: jest.fn(), hoveredId: jest.fn().mockResolvedValue('boss')
});

test('solo aiming keeps its existing center projection and settle', async () => {
    const input = makeInput();
    expect(await aimDungeonCombatTarget(input, 'boss')).toEqual({ x: 100, y: 200, visible: true });
    expect(input.project).toHaveBeenCalledWith('boss');
    expect(input.move).toHaveBeenCalledWith(100, 200);
    expect(input.settle).toHaveBeenCalledTimes(1);
    expect(input.hoveredId).not.toHaveBeenCalled();
});
test('party tank uses the exposed boss point instead of returning its covered center', async () => {
    const input = makeInput();
    const exposed = { x: 110, y: 170, visible: true };
    input.project.mockResolvedValueOnce({ x: 100, y: 200, visible: true }).mockResolvedValue(exposed);
    input.hoveredId.mockResolvedValueOnce('Cleric').mockResolvedValue('boss');
    expect(await aimDungeonCombatTarget(input, 'boss', true)).toBe(exposed);
    expect(input.project.mock.calls[1]).toEqual(['boss', { x: .5, y: .85, z: .5 }]);
    expect(input.move.mock.calls).toEqual([[100, 200], [110, 170]]);
    expect(input.settle).toHaveBeenCalledTimes(2);
});
test('completely covered target yields no attack point after bounded hitbox search', async () => {
    const input = makeInput();
    input.hoveredId.mockResolvedValue('Cleric');
    expect(await aimDungeonCombatTarget(input, 'boss', true)).toBeNull();
    expect(input.project).toHaveBeenCalledTimes(6);
});
test.each([false, true])('offscreen target cannot become an attack point, party=%s', async party => {
    const input = makeInput(); input.project.mockResolvedValue({ visible: false });
    expect(await aimDungeonCombatTarget(input, 'boss', party)).toBeNull();
    expect(input.move).not.toHaveBeenCalled();
    expect(input.hoveredId).not.toHaveBeenCalled();
});
test('projection failures propagate rather than fabricate acquisition', async () => {
    const input = makeInput(); input.project.mockRejectedValue(new Error('projection failed'));
    await expect(aimDungeonCombatTarget(input, 'boss', true)).rejects.toThrow('projection failed');
});
