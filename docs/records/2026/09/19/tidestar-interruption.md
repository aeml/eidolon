# Tidestar — interrupted five-player attempt

Native session1809 (`waterraid0919a`) returned exit143 on September19.
The last log event was at21:02:50 UTC, after28.8minutes of expedition time.
No assertion failure, test verdict or full completion record was produced.
Process inspection found no remaining raid/browser worker; the isolated API,
Mongo and static server were orphaned. The signal's sender is not established.
This is an interrupted test, not evidence of a gameplay defect or a raid pass.

## Evidence retained

- Clean starting source `6ace7407909d1cb234936496d774282e723df01a`.
  Subsequent edits were documentation and CI filtering, not gameplay or inputs.
- Five legal level70 role builds, five Rare/nine Uncommon pieces each; ordinary
  formation, readiness and entry. No stat scaling or mid-run grants.
- Original140,250HP Tidebound Tyrant defeated. Fighter39,748, Wizard43,046,
  Rogue57,594 recorded boss damage; Clerics19,983/17,959 effective ally healing.
- One ordinary town recovery/re-entry and subsequent repair-enemy kills.
  Full three-wave memory-carry ritual, personal claims and saved re-login remain
  unverified. Do not use this prepared group as earned-campaign pacing proof.
- Log and sanitized screenshots retained at
  `/tmp/eidolon-water-raid-20260919-ZLnP7l/`; credential scan sanitized0 files.
- Writer stopped before private Mongo archive capture:
  `/tmp/eidolon-party-checkpoint-waterraid0919a-wf8rh1/save.archive.gz`.
  SHA256 `662ae91dda0809e970090a47d5cb256c8d1c43e877067e527ef6d863342b773f`.
  This is an archive, not permission to bypass the15-minute logout policy.

Owned containers/image and orphaned static server were cleaned up after capture.
Production was not changed. Use a detached, logged process for the next attempt
so chat-session termination does not kill the long-running test. Keep normal
timeouts, zero retries, legal role gear and all ritual/reward requirements.
