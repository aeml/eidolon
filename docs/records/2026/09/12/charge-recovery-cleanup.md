# Charge travel-state recovery — 1.1.0

Status: implemented and focused server-race verified; **not deployed, natively
accepted or included in the earlier frozen integrated rehearsal**. Built from
e2cd42f2 while CI34670988965 continues on that unchanged source. This is part
of consolidated1.1.0, not a new1.0.x release.

## Reproduction and repair

New paid Unstoppable tests reproduced orphan immunity after ordinary recall,
living respawn and an externally cleared movement flag. Death retained both
charging and immunity; normal impact cleared the boolean but left its deadline.
These five failure cases were confirmed before changing implementation.

Shared locked Charge cleanup now cancels the accepted rune's travel immunity
before discarding its identity, and clears movement, destination and captured
duration state. Scene recovery, death, completed impact and explicit death-QA
preparation use it. It does not reset the paid cooldown, remove unrelated
immunity or discard an already-earned armor buff during ordinary scene recovery.
Tests change the selected rune after casting to verify that the accepted cast,
not the current loadout, owns cleanup. Canceled travel cannot later damage an
enemy or award impact armor.

The explicit near-death QA preparation also retained newly functional temporary
armor, contrary to that helper's existing purpose of clearing mitigation for
its one-HP death check. A separate paid-armor test reproduced this; the QA-only
reset now clears that armor and its deadline. Ordinary recovery retains armor.
No new QA authority, protected gameplay actor or forced kill was introduced.

## Evidence and limits

- Lifecycle RED: four recovery/death cases plus the normal-impact deadline
  assertion failed, package0.059s; unrelated-immunity/earned-armor controls
  passed. Log`/tmp/eidolon-1-1-charge-recovery-red-20260912.log`.
- Explicit QA armor RED: one test failed0.035s;
  `/tmp/eidolon-1-1-charge-qa-armor-red-20260912.log`.
- Final focused race PASS12.870s, including Charge/Shattering and armor
  consumers, recovery, lethal-prevention and actual near-death QA coverage.
  Log`/tmp/eidolon-1-1-charge-recovery-final-20260912.log`. Diff whitespace PASS.

Full integrated regression and native recovery/combat remain required. The
running e2cd42f2 rehearsal cannot prove these later changes.64 production and65
candidate sources were not modified; no local native/full test was started.
All dungeon/party, first-hour, earned pacing, reconnect, balance and later
1.2–1.10 requirements remain open.

For the1.1.0 patch notes: returning to town or dying during Charge no longer
leaves its travel immunity or a pending impact behind.
