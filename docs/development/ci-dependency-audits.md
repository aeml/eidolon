# Dependency audit policy

CI runs `node scripts/audit-dependencies.mjs`, which executes the full
`npm audit --json --audit-level=low` scan, including development dependencies.
Every active source advisory blocks CI. Registry errors, unknown report schemas,
missing advisory provenance and unexpected subprocess failures also block CI.

The sole excluded report is GHSA-gcqx-w48m-w2h4 for deepmerge, corresponding to
CVE-2026-93753. Its assigning authority, VulnCheck, changed the official CVE
record to **REJECTED** on November 2, 2026 because it does not describe a security
vulnerability. npm still reports that rejected CVE through Jest's config dependency.
The policy matches the exact advisory URL and package name; another advisory
against deepmerge, or the same URL against another package, remains blocking.
No package, severity level or class of findings is generally exempted.

Authority record: https://cveawg.mitre.org/api/cve/CVE-2026-93753

Upstream discussion and rejection receipt:
https://github.com/TehShrike/deepmerge/issues/273

November 15 qualification updates glob to 14.0.6, minimatch to 11.0.8 and
markdown-it to 14.3.3 through pinned npm overrides. The Jest major version stays
unchanged. The Go module, CI, Docker and isolated QA toolchains use Go 1.27.4,
and the Mongo driver's compression dependency uses klauspost/compress 1.20.2.
The existing reachable-symbol govulncheck gate remains in place.

These are tooling/dependency changes, not a new gameplay acceptance or deployment.
Run the full Jest suite, content checks, Go tests and browser checks after the
lockfile or toolchain changes. The raw npm command still exits nonzero for the
stale rejected advisory; use the wrapper to reproduce the CI decision.
