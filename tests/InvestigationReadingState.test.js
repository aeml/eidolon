import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { approachInvestigationReading, resumeInvestigationReading } from './e2e/investigation-reading-state.js';

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

test('a pending ordinary inspection acknowledged during movement resumes the exact reading', async () => {
    const f = fixture();
    const move = jest.fn(async () => {
        f.evidence.isVisible.mockResolvedValue(true);
        f.evidence.getAttribute.mockResolvedValue('');
        throw new Error('The lore window interrupted ordinary approach');
    });
    expect(await approachInvestigationReading(f.evidence, move)).toBe('already-open');
    expect(move).toHaveBeenCalledTimes(1);
    expect(f.close).not.toHaveBeenCalled();
});

test('an open reading prevents another movement command', async () => {
    const f = fixture({ visible: true, open: '' });
    const move = jest.fn();
    expect(await approachInvestigationReading(f.evidence, move)).toBe('already-open');
    expect(move).not.toHaveBeenCalled();
});

test.each([{}, { visible: true, open: null }, { visible: false, open: '' }])(
    'blocked travel without this exact visible open entry still fails: %j', async state => {
        const f = fixture(state);
        const failure = new Error('ordinary travel blocked');
        await expect(approachInvestigationReading(f.evidence, jest.fn().mockRejectedValue(failure))).rejects.toBe(failure);
    });

test('ordinary movement success alone is not proof of an inspection', async () => {
    const f = fixture();
    expect(await approachInvestigationReading(f.evidence, f.inspect)).toBe('approached');
    expect(f.evidence.getAttribute).not.toHaveBeenCalled();
});

test('entry acknowledgement after successful movement also prevents another world click', async () => {
    const f = fixture();
    const move = async () => {
        f.evidence.isVisible.mockResolvedValue(true);
        f.evidence.getAttribute.mockResolvedValue('');
    };
    f.inspect.mockImplementation(() => approachInvestigationReading(f.evidence, move));
    expect(await resumeInvestigationReading(f.page, f.evidence, f.inspect)).toBe('already-open');
});

test('the actual route guards resumed travel without dropping lore, credit or manual claim checks', () => {
    const source = readFileSync('tests/e2e/chronicle-investigation-route.js', 'utf8');
    expect(source).toContain('approachInvestigationReading(reading, move)');
    expect(source).toContain('walkTo(page, site.x, site.z + 3, evidence)');
    expect(source).toContain("await expect(evidence).toHaveAttribute('open', '')");
    expect(source).toContain('await expect(evidence).toContainText(site.title)');
    expect(source).toContain('expect(before.count).toBe(chapter.sites.length)');
    expect(source).toContain("name: 'Complete Quest', exact: true");
});
