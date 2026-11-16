# Preserve the phone reading-surface fix in 1.1.0

Ported exactly the CSS, focused unit contract and four responsive browser
assertions from65commit1f5fe935 onto primary5ab1b96e. Primary still had the
old96%-opaque reading surface; shipping it would have reintroduced background
text ghosting despite the corrected65 candidate. No panel dimensions, controls,
scroll budget or navigation changed, and no historical version label or65
patch-note entry was imported over the development branch.

The65implementation was accepted by hostedCI34670196359 at1de18e03; its
portrait390 and landscape568 artifacts were visually inspected. This is source
provenance, not a claim that the new primary integration has been browser-tested.
Frozen integrated rehearsal e2cd42f2/CI34670988965 predates this port and remains
unchanged. Record local unit/lint results and later integrated browser evidence
in the execution ledger. No native browser was started over64 live acceptance.

Local integration PASS11unit tests1.231s, changed-file lint and diff whitespace.
Logs `/tmp/eidolon-1-1-phone-surface-port-{tests,lint}-20260912.log`.

This belongs to the consolidated1.1.0 baseline and preserves the intended phone
visual improvement; no extra1.0.x release or completed mobile milestone is
claimed. Keep all roadmap gates and the positive real-phone user feedback with
its documented device/browser/build limits.
