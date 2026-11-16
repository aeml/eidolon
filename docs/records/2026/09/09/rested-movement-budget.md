# Rested movement QA budget

The complete58 replay52270 failed the unchanged one-world-unit render-step bound
on45797ee. Original log `/tmp/eidolon-rest58-all-node24-rerun-0843.log`, retained
report/frame attachment `/tmp/eidolon-rest58-movement-speed-failure-rlccng`.
Scan0 and exact run-specific API/Mongo/image absence/free ports were verified.
Later movement assertions, PvP/animations and final native rest stages did not run.

Unlike the earlier uninstrumented failure, this report contains75 captured frames.
Speed is31.68000030517578, maximum step1.0560000101725278, and each largest step
contains exactly two fixed updates. The server caps un-rested speed at28.8, then
applies the requested1.10 Well Rested multiplier. At fixed1/60 seconds per update,
31.68 ×2/60 is1.056. The failure is an obsolete distance assumption, not evidence
of extra simulation catch-up or a teleport. Slow sample intervals are observed;
this does not constitute a sustained frame-rate or phone performance pass.

Replace only the fixed distance assertion with a speed-aware simulation check:
at most two updates between captured render frames, no rendered distance beyond
the observed speed × actual updates/60 (1e-5 numeric tolerance), and no malformed
samples. Keep raw maximum distance in diagnostics. Preserve every other travel,
backtracking, camera, render/logical gap, arrival, correction and acknowledgment
assertion. No runtime speed, recovery/stat multiplier, simulation timing, gameplay
deadline or retry changes. The runtime constant's explanatory comment is updated.

Replay of the exact retained attachment reports2 maximum updates,0 invalid frames
and1.7763568394002505e-15 maximum distance excess. Synthetic tests also reject a
0.7-unit jump at10.56 speed (the old one-unit assertion would allow it), a1.2-unit
jump at31.68, one-tick overtravel, three-update catch-up, movement without an
update and malformed evidence. The initial invalid-sample table incorrectly
spread arrays as Jest arguments; corrected before acceptance, not a runtime bug.

An opt-in `movement-fast` isolated route uses the existing server-authorized
level preparation on its dedicated disposable account and verifies31.68 actual
rested speed before testing. The default movement route never adds that grant.
Run both ordinary fresh speed and prepared maximum speed through real controls,
then the exact live-recovery wrapper rehearsal and complete58 gate. None of those
new browser passes is claimed merely from the retained-frame or unit replay.
