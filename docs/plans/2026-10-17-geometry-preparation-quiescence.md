# Geometry preparation finishes without an empty callback

Qualified runtime source: `97f07191e6112c58c9542af6077ebc2d433ce2f1`.

Removing the last actor or finishing its final preparation could leave an empty
pump scheduled after the queue had drained. Disposal cancelled the timer but
retained its handle in the delivery state. The delivery now schedules only
queued work, cancels an empty queued pump, and clears its handle on disposal.
An active worker keeps its existing deadline and stale-generation guards.

Four new regressions fail against the original implementation. The complete
focused geometry delivery/owner/runtime checks pass: 89 cases across three
suites, plus changed-file lint. They cover removal before dispatch, preserving
another actor's queued work, reattachment, disposal, and the existing worker
failure and deadline paths.

The same real-model native fixture routes the exact accepted 1.79.75 delivery
as a negative control, then uses the fixed delivery. Both runs use AMD/RADV,
four supplied classes with fourteen equipped slots, and the canonical geometry
worker. The old delivery retains a scheduled callback after all four measured
release cycles and all four queued cancellations. The fixed delivery passes
with zero roots, jobs, queue entries, active work and scheduled callbacks.
Cancelling a newly attached actor dispatches no additional worker job. All four
cycles and the cancellations return to the retained 128-geometry/90-texture pool.
The renderer stays High while body/equipment assets alternate High and Low;
this is resource and queue ownership proof, not both graphics profiles or a
physical-device/frame-time certificate.

The initial positive command matched zero tests because its title selector
was anchored before Playwright's filename prefix. Its discovery failure is
retained; the corrected selector executes the one intended native case once.

Private evidence: `/home/aeml/.local/share/eidolon-geometry-quiescence-review-20261017/.qa-quiescence`.
Frozen eight-file qualification inventory SHA-256:
`47d0a5bd572a065bb3b2cbc3bfce78ae58ad2c079c28016276ab051e626cbc4e`.
Its crosswalk verifies the three-file CPU negative, twelve-file native negative,
four-file discovery record and eleven-file positive native packet. Original
failures are preserved. The geometry worker remains byte-exact at
`28b738eaf5aa3a9ba5df513fbd8c400f3d82a5f0f2624d529731c57b80a95f03`.

Expected integrated client count: 802 suites / 12,427 cases. The existing native
pool case is strengthened, so browser/native case counts do not increase.
Publication and its exact CI/live verification remain pending. This does not
select skeleton borrowing or the separate lighting experiment, resolve the
legacy Cleric source-comparison finding, or close full world/art/performance,
operations, owner review, feature-freeze, beta or release-readiness gates.
Human campaign/phone feedback and soak/stress remain deferred.
