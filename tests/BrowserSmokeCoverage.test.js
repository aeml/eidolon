import { discoveredCaseIdentities, verifyDiscoveredPartition } from '../scripts/browser-smoke-coverage.mjs';

test('discovery includes nested titles and projects in case identities', () => {
    const cases = discoveredCaseIdentities({ suites: [{ title: 'file', suites: [{ title: 'group', specs: [
        { file: 'a.spec.js', title: 'renders', tests: [{ projectName: 'chrome' }, { projectName: 'webkit' }] }
    ] }] }] });
    expect(cases).toEqual([
        JSON.stringify(['a.spec.js', 'file', 'group', 'renders', 'chrome']),
        JSON.stringify(['a.spec.js', 'file', 'group', 'renders', 'webkit'])
    ]);
});
test('discovery rejects errors and an empty group', () => {
    expect(() => discoveredCaseIdentities({ errors: [{ message: 'failed' }] })).toThrow('errors');
    expect(() => discoveredCaseIdentities({ suites: [] })).toThrow('Empty');
});
test('partition accepts only exact coverage independent of execution order', () => {
    expect(verifyDiscoveredPartition(['a', 'b', 'c'], [['c'], ['b', 'a']])).toBe(3);
    expect(() => verifyDiscoveredPartition(['a', 'b'], [['a']])).toThrow('missing=1');
    expect(() => verifyDiscoveredPartition(['a'], [['a', 'extra']])).toThrow('unexpected=1');
    expect(() => verifyDiscoveredPartition(['a'], [['a'], ['a']])).toThrow('Duplicate partition');
    expect(() => verifyDiscoveredPartition(['a', 'a'], [['a']])).toThrow('Duplicate baseline');
    expect(() => verifyDiscoveredPartition(['a'], [['a'], []])).toThrow('Empty');
});
