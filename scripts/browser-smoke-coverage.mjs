export function discoveredCaseIdentities(report) {
    if (report.errors?.length) throw new Error('Browser discovery reported errors');
    const cases = [];
    const visit = (suites, parents = []) => {
        for (const suite of suites || []) {
            const titles = [...parents, suite.title];
            for (const spec of suite.specs || []) {
                for (const test of spec.tests || []) {
                    cases.push(JSON.stringify([spec.file, ...titles, spec.title, test.projectName || '']));
                }
            }
            visit(suite.suites, titles);
        }
    };
    visit(report.suites);
    if (!cases.length) throw new Error('Empty required browser discovery');
    return cases;
}

export function verifyDiscoveredPartition(baseline, groups) {
    if (!baseline.length || !groups.length || groups.some(group => !group.length)) throw new Error('Empty required browser group');
    if (new Set(baseline).size !== baseline.length) throw new Error('Duplicate baseline case');
    const combined = groups.flat();
    if (new Set(combined).size !== combined.length) throw new Error('Duplicate partition case');
    const expected = new Set(baseline), actual = new Set(combined);
    const missing = baseline.filter(id => !actual.has(id));
    const unexpected = combined.filter(id => !expected.has(id));
    if (missing.length || unexpected.length) throw new Error(`Browser coverage mismatch: missing=${missing.length}, unexpected=${unexpected.length}`);
    return combined.length;
}
