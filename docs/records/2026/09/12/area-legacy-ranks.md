# Saved area-talent aliases — 1.1.0 candidate

The shared client area reader previously looked up only padded talent IDs.
Old saves containing `FTR_4`, `FTR_6`, or `CLR_7` therefore lost Whirlwind,
Shield Slam or Purifying Wave area training in offline casts and predicted
visuals. Server normalization already recognizes these unpadded aliases.

Reproduction: 12 failures and 88 passing controls in 1.608 seconds. Actual
paid Shield Slam missed the trained edge; actual paid Purifying Wave left the
edge ally bleeding. Resource assertions passed before those failures.

The reader now takes the highest finite, floored, bounded rank across canonical
and unpadded IDs, without adding duplicate ranks or modifying the saved map.
Named effects stay skill-specific; class filtering and ground placement range
are unchanged. This is a read-time consumer correction, not a new save migration
or evidence that every legacy talent consumer has been audited.

Focused verification: 12 suites, 489 tests pass in 5.667 seconds. This includes
all currently declared area-talents, rank 0/1/5, duplicate and malformed ranks,
immutable saves, real Shield Slam/Purifying Wave casts, Whirlwind's first and
second pulses after a build change, visible radii, and existing class area/range
regressions. Full lint and whitespace checks also pass. No server code, game
balance, currency, version number, or deployment configuration changes.

Logs: `/tmp/eidolon-area-legacy-{red,green,final,lint}-20260912.log`.
Full hosted regression and native acceptance remain pending; no live acceptance
or complete 1.1.0 milestone is claimed. Earthshaker area, remaining talent
consumers, earned progression and full four-role dungeon acceptance remain open.

Proposed 1.1.0 patch note: “Older saved talent IDs now preserve trained
Whirlwind, Shield Slam and Purifying Wave areas without stacking duplicate ranks.”
