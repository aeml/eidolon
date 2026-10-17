# Verified recovery-set transfer candidate

Qualified code: `c3d1d0f460a687e1d2bd080d6b36def6c85641d2`, based on77source
`f2d661454f7f0f124d1c40669c32d4fa9bb48ce8`. This is an isolated operator-tool
candidate. Current77 CI/deployment acceptance precedes another publication.
No production backup transfer, remote destination or schedule is activated.

`copy_upgrade_backup.sh` transfers one explicitly chosen completed recovery
point to a pinned SSH account/host and an existing private receiving directory.
The source verifier runs first. A fixed-file tar stream preserves the Mongo and
journal archives, previous-image identity/archive pair (or fresh-install marker),
checksums and completion metadata. Host-key checking is strict; agent/default-key
authentication replaces per-host config, connection sharing and forwarding.

The receiver accepts only fixed artifact names, regular files, source-pinned
manifest/marker/verifier hashes and the existing complete checksum/gzip/image
pair checks. Its new `--pending-transfer` verifier mode reads a pending marker;
ordinary restore callers still require `COMPLETE`. Copied payloads and selected
directories are flushed before promoting the marker and publishing the final
directory. These are individual file/directory syncs, not whole-filesystem flushes.
A failed barrier leaves no completed point or success receipt. Existing points
are never overwritten; private partial bytes remain for explicit inspection.
No source backup, other database, service, retention rule or admission changes.

23current Jest cases pass with changed-file lint and Bash syntax checks. They
exercise image/fresh sets, byte/mode preservation, exact SSH pin options, quoted
paths, interrupted/corrupt payloads, altered/linked verifier code, unsafe roots,
source/pin aliases, malformed inputs, repeated copies, all three durability
barriers and ordinary refusal of pending points. The transfer shim executes the
actual quoted receiver command but does not establish SSH transport by itself.
One regression reproduces escaped digest output for a backslash in the source's
parent directory; hashing stdin repairs it without relaxing path/host guards.
Its five-file negative packet is retained at
`ca96048c59024c6ac64f410bf6f05804988be742829bcba2e075d6d1c965a36c`.

Two existing standalone Go tests retain26verifier and8coordinated-restore refusal
scenarios. They execute real Bash with synthetic files and a Docker probe,
without accessing a database. The host Go1.22.2 stdlib-only file invocation is
not a build or qualification of the application's required Go1.27.2 toolchain.
Future exact-source full CI remains required.

Actual OpenSSH also passes on current durable code: a private nonroot loopback
server and private agent transfer synthetic gzip artifacts byte-for-byte. A wrong
host pin refuses before remote writes; the literal quoted destination remains
literal. This is one bounded transport circuit with positive and negative
connections. Its temporary key directory is absent and private sshd terminates.
No system SSH configuration, external host or real player archive is involved.
The earlier pre-durability transport result remains historical; current proof
uses the added barriers and repaired source-path digests.

Private evidence:
`/home/aeml/.local/share/eidolon-backup-transfer-review-20261017/.qa-backup-transfer`.
Frozen15-file inventory SHA-256:
`1c1b871c7e90def346e933df8c7f87e3afad0f240f63986ec7725e6dcc95c68d`.
If selected after77, expected client totals become803suites/12475tests. Engine
modules remain513; no browser cases, dependencies, schema or game rules change.

Recovery readiness still needs the owner's destination/access choice, acceptable
lost-progress interval and restoration target, plus the actual chosen off-machine
exercise and appropriate creation/retention policy. Transport integrity does not
establish archive authenticity, at-rest protection, save/image compatibility,
normal game restoration, staffing or those recovery objectives. No1.80freeze,
1.81completion, beta or1.99readiness is inferred. All original world/art/game/
combat/audio/performance/device/security/operations/owner/F1-F5/beta/handoff scope
remains active. Human campaign/phone feedback and soak/stress stay deferred.
