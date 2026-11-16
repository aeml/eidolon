# Recovery candidate: moving-cast frame evidence

The complete run49970 on028f23b failed at the Cleric moving-cast frame count:
10samples in a650ms request against the existing>10requirement. Earlier checks
passed, including all duels and the first three class matrices, but remaining
Cleric/multiplayer/nameplate/native-rest checks did not run. Original evidence:
`/tmp/eidolon-rest58-cleric-frame-failure-02mQPZ`; scan0/exact cleanup verified.

The animation test disables automatic recording. Diagnostic e5d7bd4 now attaches
the actual frame timing/positions, renderer, initial target and movement metrics
before that assertion. No duration, threshold, retry or runtime change was made.

Cleric-only95652 PASSED the complete matrix1.0m on e5d7bd4. Its attachment records
25frames, sustained MOVING, the actual Spirit Guardians animation, and the AMD
RADV hardware renderer. All original later movement/ability/rune assertions also
passed. Archive `/tmp/eidolon-rest58-cleric-frame-proof-8ORFWQ` includes HTML with
embedded moving-base-cast JSON, screenshot and log. Scan0/exact temporary cleanup
verified. Log `/tmp/eidolon-rest58-cleric-frame-diagnostic.log`.

The original10-frame sample had no retained frame timeline, so this replay does
not establish its cause. A passing focused replay is not a full-run pass or
sustained performance acceptance. Run the complete unchanged gameplay chain with
the added evidence before publication. Preserve any subsequent failures instead
of lowering the frame threshold or treating this diagnostic as a replacement.
