# Equipment explosion geometry and receiving damage

Required combat/dungeon correction discovered while reviewing release64.
Not a completed1.1 or full1.1–1.10 gate, and not yet published.

The existing on-kill effect used a grid-cell query as if it were an exact
five-unit circle. Real scheduled killing-attack tests reproduced500damage
through a closed dungeon wall and outside circular/body reach. The receiving
state/threat case also failed; open-door/same-side and enemy-only controls passed.
Initial release-candidate race run failed1.580s; log
`/tmp/eidolon-release64-gear-explosion-red-20260912.log`.

The fix captures canonical floor geometry without holding actor locks and checks
circular body overlap before damage. It preserves the stored50% attack budget,
uses current receiving defenses without rerolling critical/outgoing bonuses,
records threat, and flushes retaliation outside actor locks. Chained deaths keep
their existing once-per-death party-credit behavior. Targeting remains enemy-only.

Release implementationd890b830 is integrated here as4a49c83c. The development
branch's additional Dark King phase cap remains in receiveDamageLocked; it was
not discarded or applied twice when replacing the direct HP subtraction.
Three-repeat focused race PASS10.021s covers the new gear cases, paid Smite
lethal reflection/cast receipt, party explosive chains, and existing real Dark
King explosion/chain/concurrent phase cases. Log
`/tmp/eidolon-development-gear-explosion-20260912.log`.

This candidate extends208b0aa3; the primary worktree remains frozen there while
native four-player session77501 continues. Merge only after that run ends, then
retain the full integration gate. These prepared tests do not prove earned gear,
native dungeon completion or the upcoming release's production acceptance.
