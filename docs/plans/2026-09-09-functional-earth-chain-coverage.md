# Prepared functional Earth route — complete authored prefix

Initially prepared separately on0691772, then integrated into primary6d9d8de;
still unpublished and awaiting actual prepared-route gameplay. The existing
prepared-level collection route omitted the three mandatory Earth hunts between
its diary, collection, scar and dungeon steps. This is not fresh-level evidence.

Dispatch inserted Earth hunts from their authored BeforeQuestID metadata. Verify
each predecessor, accept at Ilyra, earn actual qualifying kills, manually claim,
then continue. Preserve exact Seed consumption/immediate bag update and pre-clear
sealed raid checks. The old nearest-enemy QA waypoint remains limited to the
explicitly prepared opening/collection checks; hunts share ordinary enemy subtype,
minimum-level selection and bounded travel with the fresh route. Extracted that
unchanged selector into a shared module to avoid circular route dependencies.
Use existing conservative earned bag management between encounters, returning to
the field through normal jump inputs instead of granting capacity or deleting loot.

The functional route retains its current600s budget and per-encounter bounds.
Full actual timing/complete gameplay must be measured before deciding whether it
needs independently verified stages; no requirement is skipped to shorten it.

Initial35727 PASS67/4/1.361+lint. Extraction24741 exposed one old source assertion
expecting the bounded selector loop inline; retained that assertion against the
new imported shared module. Corrected37542 PASS67/4/1.314+lint. Logs
`/tmp/eidolon-functional-earth-{final-focused,corrected-focused,corrected-lint}.log`.
Tests cover all three authored eligibilities, propagation of an unearned hunt,
no unrelated/non-Earth dispatch and actual route wiring/manualclaim/Seed checks.

The actual prepared functional run remains required before release acceptance.
No server/runtime/currency/quest-rule changes.

Separate full57496 on644076d passed282suites3976tests94.532s and lint;
`/tmp/eidolon-functional-earth-full-{client,lint}.log`. Integrated into primary as
6d9d8de after its previous browser47584 terminated and artifacts were preserved.
The prepared combat loop also uses the new real-input safe-zone departure guard;
this does not turn its QA level/waypoint preparation into earned-level evidence.
Integrated37716 passed283suites3983tests97.767s+lint. Subsequent move-only travel
correction bac74f9 is covered by82812 (283suites3984tests101.714s+lint); see
[travel failure and correction](2026-09-09-expedition-travel-dialogue-recovery.md).
Actual prepared functional gameplay remains pending; fresh collection's partial
success does not prove this separate prepared route or complete Earth readiness.
