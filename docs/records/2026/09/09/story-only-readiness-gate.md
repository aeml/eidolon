# Story-only Earth readiness is a release gate

The coordinated story/balance candidate must support dungeon entry without
mandatory daily resets. Source review found that the old `fresh-ready` diagnostic
still adds Skeleton and Imp daily contracts with legacy reward expectations.
That path cannot establish this requirement. The existing complete Earth
collection diagnostic also correctly accepts a disabled Guide below30: useful
UI evidence, but not proof of a viable authored leveling route.

New `fresh-story-ready` uses the same ordinary complete Earth route—opening,
Mara's diary,40Skeleton Watch,8earned Seeds,60Imp Walking Ink, returning-scar
inspection and50DemonOrc Borrowed Oath—with the existing movement, combat,
death, town recovery, manual claims and saved-gear checks. It then requires:

- All seven pre-dungeon chapters manually completed.
- Earth dungeon chapter accepted, still uncompleted and with zero clear credit.
- No daily contract accepted or completed on this fresh character.
- An actually earned level of at least30, living HP and Normal30 Guide entry
  visibly enabled. Rootheart raid access remains sealed until the dungeon clear.

An underleveled result fails with the complete observed progression snapshot.
Do not top it up with a daily, extra grant, hidden reward or unbounded filler
hunt to make the test pass. Such a failure requires reviewing the coordinated
source/objective/curve budgets and ordinary exploration burden. Passing this
gate will establish entry readiness, not the full dungeon or campaign.

The complete isolated release chain now invokes `run_fresh_story_ready` in the
existing `fresh-collection` timing slot. It delegates to the existing four-class
collection driver with an explicit readiness flag. All35 stage positions and
every other command remain unchanged. The new flag rejects old daily/short-hunt/
early-preparation combinations before login. The existing focused collection and
legacy daily comparison routes remain separate diagnostics, not readiness proof.
The old daily diagnostics' hardcoded reward expectations remain a known follow-up;
they must not be reported as current coordinated-budget acceptance.

The executable timing integration tests now expect the stronger command at that
one position and still exercise all35 failure positions, original status19,
artifact scan and EXIT hook. Four additional shell tests execute the actual
collection/readiness wrapper bodies with a harmless failing npx stub, proving
all four class flags, full collection flag, absent daily mode and propagated19.

Initial93563 passed326tests/5suites/1.995s. Final27802 passed330tests/5suites/2.538s,
plus lint, shell syntax and diff checks, explicit Node24.18.0. The final pass adds
the actual four-class shell wrapper tests and explicit Normal difficulty selection.
Logs `/tmp/eidolon-primary-story-readiness-{tests,lint}.log` and
`/tmp/eidolon-primary-story-readiness-final-{tests,lint}.log`.

Full client regression and an actual story-only playthrough remain required.
No new production gameplay, reward, curve, version or release queue changed.
This applies only to the preserved coordinated-story candidate, not standalone58,
whose frozen complete gameplay run continues separately. Do not claim a full
Earth readiness pass from the older first40-hunt Wizard/Fighter results.
