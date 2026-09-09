import { jest } from '@jest/globals';
import { resumeInvestigationReading } from './e2e/investigation-reading-state.js';

function fixture({ visible = false, open = null, journalVisible = false } = {}) {
    const close = jest.fn();
    const inspect = jest.fn();
    const evidence = { isVisible: jest.fn().mockResolvedValue(visible),
        getAttribute: jest.fn().mockResolvedValue(open) };
    const page = { locator: selector => selector === '#quest-journal'
        ? { isVisible: jest.fn().mockResolvedValue(journalVisible) }
        : { click: close } };
    return { page, evidence, inspect, close };
}

test('an exact entry opened by ordinary combat input is read without another world click', async () => {
    const f = fixture({ visible: true, open: '', journalVisible: true });
    expect(await resumeInvestigationReading(f.page, f.evidence, f.inspect)).toBe('already-open');
    expect(f.evidence.getAttribute).toHaveBeenCalledWith('open');
    expect(f.inspect).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled();
});

test.each([
    { visible: true, open: null, journalVisible: true },
    { visible: false, open: '', journalVisible: true }
])('a closed or hidden entry cannot replace deliberate inspection: %j', async state => {
    const f = fixture(state);
    expect(await resumeInvestigationReading(f.page, f.evidence, f.inspect)).toBe('inspected');
    expect(f.close).toHaveBeenCalledTimes(1);
    expect(f.close.mock.invocationCallOrder[0]).toBeLessThan(f.inspect.mock.invocationCallOrder[0]);
    expect(f.inspect).toHaveBeenCalledTimes(1);
});

test('an unopened journal does not require a nonexistent close button', async () => {
    const f = fixture();
    await resumeInvestigationReading(f.page, f.evidence, f.inspect);
    expect(f.close).not.toHaveBeenCalled();
    expect(f.inspect).toHaveBeenCalledTimes(1);
});

test('inspection failure propagates without inventing evidence or retrying', async () => {
    const f = fixture();
    f.inspect.mockRejectedValue(new Error('ordinary approach blocked'));
    await expect(resumeInvestigationReading(f.page, f.evidence, f.inspect)).rejects.toThrow('ordinary approach blocked');
    expect(f.inspect).toHaveBeenCalledTimes(1);
});
