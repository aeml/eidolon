import { assessDependencyAudit } from '../scripts/dependency-audit-policy.mjs';

const rejected = { name: 'deepmerge', title: 'Prototype poisoning', severity: 'low',
    url: 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4' };
const report = vulnerabilities => ({ auditReportVersion: 2, vulnerabilities,
    metadata: { vulnerabilities: { total: Object.keys(vulnerabilities).length } } });

test('a clean audit and the exact officially rejected CVE pass', () => {
    expect(assessDependencyAudit(report({}))).toEqual({ rejected: [], active: [] });
    expect(assessDependencyAudit(report({ deepmerge: { via: [rejected] },
        'jest-config': { via: ['deepmerge'] } }))).toEqual({ rejected: [rejected.url], active: [] });
});

test('new advisories, including low-severity findings in deepmerge, still block CI', () => {
    const active = { ...rejected, url: 'https://github.com/advisories/GHSA-new-finding' };
    expect(assessDependencyAudit(report({ deepmerge: { via: [rejected, active] } })).active).toEqual([active]);
    const otherPackage = { ...rejected, name: 'another-package' };
    expect(assessDependencyAudit(report({ other: { via: [otherPackage] } })).active).toEqual([otherPackage]);
});

test('registry errors, report drift and missing provenance fail closed', () => {
    for (const input of [{}, { error: { code: 'ENOTFOUND' } }, { ...report({}), auditReportVersion: 3 },
        { ...report({}), metadata: {} }, report({ a: { via: [] } }), report({ a: { via: ['missing'] } }),
        report({ a: { via: [{}] } }), report({ a: { via: ['a'] } })]) {
        expect(() => assessDependencyAudit(input)).toThrow();
    }
});
