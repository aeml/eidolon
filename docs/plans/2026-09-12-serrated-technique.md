# Serrated Edges Technique — useful training without double critical rolls

Serrated Edges derives bleed from the actual Piercing Throw/Fan of Knives hit.
The production inherited-wound path deliberately retains that hit's critical,
equipment and generic damage modifiers once; it never rolls named Serrated
critical chance. ROG_14's separate critical bonus therefore had no consumer.

Keep saved ID/rank cap and3% cooldown reduction per rank, replacing the unused
2% critical chance with2% mana-cost reduction per rank, matching other Rogue
utility Techniques. Base cost30 becomes29 at rank1 and27 at rank5 before any
equipment-specific composition; integer equipment-first rounding is unchanged.
Client metadata/copy and server definition agree. ROG_13 Mastery, inherited
bleed damage, tick timing, original-hit critical chance and effect duration are
unchanged; this is not a second critical roll or damage buff.

## Evidence

- Actual offline paid cast and tooltip tests first failed2cases (7passed).
  Server paid rank0/1/5 boundary tests also reproduced the unusable bonus and
  insufficient discounted mana. Initial server invocation incorrectly used
  `-p1`; corrected `-p 1` actually ran the intended test and failed in0.611s.
- Final focused client8suites151tests PASS8.263s, covering shared economy and
  critical contracts, paid offline casts, inherited wounds, raw damage consumers,
  observer delivery, native gate enrollment and stage timing.
- Server focused race PASS33.324s: real purchased paid casts, exact/insufficient
  mana, cooldown rejection, unchanged effect windows, economy scope, critical
  consumers and inherited/raw wounds.
- Expanded client checks caught the old hardcoded12critical-talents count.
  Replaced it with the explicit11remaining valid IDs, retaining numeric/copy
  checks for every real critical consumer. Earlier command named two nonexistent
  tests and ran only2suites15cases; the final8suite result supersedes it.
- Full lint, prepared assets and diff checks passed. Logs use
  `/tmp/eidolon-serrated-technique-*-20260912.log`.

## Native and release gates still open

The existing utility route gains an explicitly isolated `serrated-technique`
mode/account, enrolled once in the full gate with zero retries. It reuses normal
branch selection, paid0/1/5 purchases/casts, actual mana/cooldown receipts,
replicated timer/attached status/expiry, High/Low and saved-rank checks.
Only this mode tests Serrated, avoiding an illegal25point combined build at100:
Serrated Technique5 + generic CDR5 spends10 of20points. Other utility modes still
spend their original20points and retain Cloak's saved rune check. Serrated is not
assigned a nonexistent Cloak rune. Observer fixtures include actual Serrated
replication fields. Full CI and native execution remain required; no integration
or production release is claimed. The four-player dungeon clear and all wider
1.1–1.10 milestones remain open.

## Draft 1.1.0 patch note

- Serrated Edges Technique now reduces mana cost as well as cooldown. Its
  previous critical-chance bonus did not affect the inherited bleed damage.
