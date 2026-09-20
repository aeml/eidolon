# Alpha 1.9.21 — the whole raid in view

Status: pushed as44061ffe368597dd09373720329ffbaee8240d92; CI35483868157
is monitored by Luna `/root/watch_release_1_9_21`. Public identity verification
passes; final live-character QA is still pending. No further push is needed for
this local status note or diagnostics.

Independent public reads confirmed HTTP200 on the frontend release manifest
and backend health endpoint, both reporting the exact commit above/Alpha1.9.21,
with backend statusok/database ready. Public HTML contains the updated login
label, new notes and retained1.9.20 entry. Served party CSS exactly matches the
committed candidate, and served SocialUI contains its raid layout/title switch.
This proves publication, not completion of the final workflow job or full1.10.

Desktop groups larger than four use a two-column roster. Ten health bars fit
above default chat at1280×720 without scrolling, with the healing-clear button
beside the heading. Name, HP, role, readiness and separate leader actions remain
available. Leaving or shrinking the raid restores the ordinary party layout;
phone-specific controls and combat targeting are unchanged.

The existing UI-only browser fixture now covers four, five and ten members at
1280×720 and1440×900, including actual last-member healing selection, clearing,
zero roster scroll, chat separation and tracked-quest scrolling. Both cases
passed in19.9seconds; the ten-player720p screenshot was visually inspected.
The fixture disables WebGL and is not dungeon-combat or physical-phone proof.
Sixty SocialUI/phone-targeting unit checks passed in2.522seconds.

This release also includes the already-reviewed hosted scheduling improvements
in `2026-09-20-ci-hosted-parallelism.md`: independent browser jobs start alongside
Go/Jest; predeploy still explicitly requires all three. Rotated browser partitions
retain all129 discovered cases. No gate, coverage or test retry policy is removed.
Elapsed deployment improvement is an estimate until this release finishes.

Login, package/lock, release manifest and backend/deployment defaults are updated
with an additive patch-note entry; all prior notes remain.
All270 version/history checks and42 browser-scheduling checks pass; changed-file
lint and diff checks pass. Initial local verification caught stale version-test
expectations, which were updated before publication.

The Fire raid failure is preserved separately in
`2026-09-20-ember-crown-party-validation.md`. Water/Fire/Air full acceptance,
remaining dungeon families, the earned campaign and other final1.10 checks are
still open. This UI release does not claim those requirements are completed.
