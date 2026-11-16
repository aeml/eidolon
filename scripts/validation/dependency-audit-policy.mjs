const rejectedDeepmergeAdvisory = 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4';

// CVE-2026-93753 was REJECTED by its assigning authority on 2026-11-02:
// https://cveawg.mitre.org/api/cve/CVE-2026-93753
// Keep enforcing every active advisory, including new findings in deepmerge.
export function assessDependencyAudit(report) {
    if (report?.error || report?.auditReportVersion !== 2 || !report.vulnerabilities ||
        typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities) ||
        report.metadata?.vulnerabilities?.total !== Object.keys(report.vulnerabilities).length) {
        throw new Error('Unrecognized or incomplete npm audit report');
    }
    const rejected = new Set(), active = new Map();
    for (const vulnerability of Object.values(report.vulnerabilities)) {
        if (!Array.isArray(vulnerability.via) || !vulnerability.via.length) {
            throw new Error('Missing npm advisory provenance');
        }
        for (const advisory of vulnerability.via) {
            if (typeof advisory === 'string') {
                if (!Object.hasOwn(report.vulnerabilities, advisory)) throw new Error('Missing transitive advisory');
            } else if (advisory?.name && advisory.url && advisory.title && advisory.severity) {
                if (advisory.name === 'deepmerge' && advisory.url === rejectedDeepmergeAdvisory) {
                    rejected.add(advisory.url);
                } else {
                    active.set(advisory.url, advisory);
                }
            } else throw new Error('Malformed npm advisory');
        }
    }
    if (Object.keys(report.vulnerabilities).length && !rejected.size && !active.size) {
        throw new Error('No source advisories in nonempty npm audit report');
    }
    return { rejected: [...rejected], active: [...active.values()] };
}
