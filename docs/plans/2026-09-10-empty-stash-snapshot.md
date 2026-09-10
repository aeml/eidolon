# Explicit empty stash snapshots — native verified, unpublished

## Fresh-account failure and cause

Strict fresh Wizard96446 on clean98f757f9 failed after15.4minutes, zero retries.
Opening/diary passed87.532seconds,40kill watch606.250seconds, eight-seed collection
176.275seconds. Watch had0deaths and16ordinary town recovery stops. The subsequent
Imp phase failed after50.912seconds at first stored-equipment preparation:
"Read actual opened storage before preparation" expected an array but found none.
No dungeon was entered. Do not relabel this as a boss or pacing failure.

The stash NPC and window existed. The server's shared join/resume snapshot path
sent stash data only when`len(entity.Stash) > 0`. A new, genuinely empty account
therefore had no authoritative stash snapshot at all. The earlier seeded native
equipment fixture had stored items, so its success did not cover this case.
The strict reader correctly distinguished absent state from observed emptiness.

Archive`/tmp/eidolon-fresh-empty-stash-failure-KyAEhw` retains full reports/results
and the failed log. Actual wrapper credential scan0; copied redirected log was
additionally sanitized with the existing scanner (one file, zero remaining QA
username prefixes). Text scanning does not redact usernames in screenshot pixels.
Owned`stash-earned-story-0910` containers/image and18580/18581/41980listeners were
verified absent before the next browser run. Original full budgets are unchanged.

## Correction and evidence

- d70e5acc always sends exactly one authoritative stash array from the actual
  initial-state path used by join/resume. Nil storage serializes as`[]`, not
  `null`, without changing server-owned storage. Existing nonempty contents are
  preserved. The existing client handler pads empty storage to100null slots and
  refreshes the display, including clearing stale prior contents.
-19446 RED: the actual snapshot-path test failed for nil and empty storage,
  reporting0stash messages; populated storage passed.0.188seconds total.
  Background work is explicitly drained before restoring test globals.
-20073 PASS focused server race2.438seconds: nil/empty/populated snapshots,
  unchanged stored state, rejected transfers and ordinary all-class defaults.
-27370 PASS37client tests/5suites1.357seconds plus lint/diff. Explicit empty
  messages replace absent or stale display state without changing inventory,
  equipment, Gold or XP. Existing stash preparation/failure contracts retained.
- fcdfa366 extends the native four-class parity route: every real first login
  and relogin must receive an array and produce exactly100empty slots before
  moving on. No fallback turns missing data into fabricated empty storage.
-96721 TERMINAL0 on cleanfcdfa366:4native cases12.6/11.9/12.6/12.0seconds,
  51.0seconds total, zero retries. Actual new Fighter/Rogue/Wizard/Cleric login,
  relogin and later relogin after the visibly explicit QA level override pass.
  This is empty-storage/initial-stat proof, not earned leveling or dungeon success.
- Archive`/tmp/eidolon-empty-stash-login-proof-br5CY4` retains report/results and
  native/focused logs. Actual wrapper scan0; copied native log has0QA username
  prefixes. Owned`empty-stash-login-0910` containers/image and18580/18581/41980
  listeners absent after cleanup.

## Remaining acceptance

Full Go race/client regressions after this server change remain pending, followed
by the strict earned campaign using actual storage and unchanged budgets. No
new balance values, item grants, passive regeneration or encounter changes.
Canonical release acceptance, isolated successor integration, versioned patch
notes/CI and live verification remain separate requirements; nothing deployed.
