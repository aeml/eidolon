# Alpha 1.35 — Forge progression review

Local partial candidate; no version bump, publication or economy changes.

## Character-level requirements and live feedback

The server already rejects upgrades beyond the character's level, but the
Forge offered those buttons whenever materials were sufficient. The menu now
disables only the unavailable choice and shows its required level. A character
at 35 can upgrade a level-30 item by one, but cannot yet purchase the ten-level
batch. Level-only network deltas refresh that eligibility without reopening.
Near the item cap, the quote names the actual batch size (95→100 is five).

Two initial regressions failed. Testing actual level packets then exposed the
missing level-only refresh trigger. The expanded fixture needed its normal
level-up feedback mock; that failed test invocation is not a passing receipt.
Final Forge/preview/comparison coverage passed 31 tests in 1.426s; scoped lint
and whitespace passed. Existing server basis persistence, rejected-purchase,
scaling, material and cost checks passed (main 0.257s, game 0.402s, forging
0.004s). No additional full dungeon, raid or campaign run was performed.

## Existing cost curve, unchanged

Summing the current production preview gives these cumulative Heart costs per
piece: +5 = 31; +8 = 255; +10 = 831; +15 = 5,631; +20 = 21,631. Fourteen pieces
at +20 would require 302,834 Hearts, excluding sockets and other expenditure.
That is a cost model, not an estimate of earned hours. Each individual purchase
still fits normal inventory capacity; retained fractional stat progress and
saved Forge basis avoid lost gains from repeated small upgrades or reconnects.

The owner wants moderate story potency and +20 as a long-term endgame goal.
Actual material-earning pace and that endgame target still need player evidence;
no price change is justified solely by the totals above.

## Quoted level and potency purchases

Four real-dispatch regressions reproduced that level/potency requests could
purchase again when replayed, or upgrade replacement gear occupying the same
slot. Two client regressions reproduced the missing displayed-state payload.
The preview now captures item ID, level and potency; callbacks preserve that
quote instead of looking up potentially newer gear at click time. The server
checks it under the same world/player locks used for spending, before changing
materials, stats, equipment or its revision. Stale requests explain that the
player should review the current preview. Refreshed quotes can buy normally.

Client Forge/binding/preview checks passed 35 tests in 2.357s, with scoped lint.
Actual dispatch and existing persistence/progression checks passed (main
0.390s; game 0.450s). Sixteen concurrent requests for each of level and potency
settle exactly one purchase, one material charge and one equipment revision;
the scoped race-detector check passed in 1.553s. No cost or scaling changes.
Older clients omitting quotes remain compatible during rolling deployment;
their requests do not gain the new stale-preview protection. Existing saved
level/potency persistence remains covered, not replaced with a new journal.

## Socket and gem safety

Four more actual-dispatch regressions failed for stale socket, insertion,
combination and removal requests. Quotes now include socket contents and the
selected loose gem IDs/counts. Checks and mutations share the world/player
locks; replies read inventory under the player lock. Changed or repeated
requests cannot consume a different stack or destroy the next socketed gem.
Equipment mutations clone the previous item rather than editing its gem array
in place. The unchanged older-client caveat above still applies.

Two actual insertion/removal regressions also showed stale combat bonuses.
These actions now recalculate stats immediately. Three stack reproductions
showed whole-stack loss on insertion, whole-stack loss on combination, and
rejection of an otherwise valid three-unit recipe from one stack. Insertion
now consumes one unit; combination consumes three, selected across one or more
stacks. The UI selects up to three available units from a clicked stack and
captures their identities and quantities. Used-up slots become empty without
shifting neighboring bag items. Combination plans its output before spending;
full-bag or insufficient-unit rejection preserves all inputs. This corrects
erroneous consumption, not the intended three-to-one recipe or drop rates.

Latest client Forge/binding/preview coverage passed 39 checks in 1.291s with
scoped lint. Server dispatch/progression/stack checks passed (main 0.481s,
game 0.625s), followed by full-bag/insufficient-unit and immediate-stat checks
in 0.241s. Earlier socket/gem dispatch and concurrent-snapshot race checks passed
(main 2.774s, game 2.715s); that race receipt predates the final stack-consumption
change and is not claimed as final race coverage of the new recipe planning.

The isolated two-player Forge socket route passed in 33.1s (31.3s test body)
against the dirty local candidate: run forge135-0928, session18645 terminal0.
It used ordinary removal/insertion, checked owner and observer appearance, bag
icon and fresh-login saved gear. Credential scan passed with zero sanitized
files; exact temporary containers/image were verified absent after cleanup.
No production accounts or long campaign were involved. The final scoped race
run also passed against the stack planner and quote changes (main 2.683s,
game 2.591s). Remaining: final package and CI/live verification. These guards
do not establish journaled exactly-once crash recovery for every economy action.

## Removal selection during an authoritative refresh — September 29

Two live-panel regressions reproduced a remaining client gap: replacement
equipment, or a shifted socket array, retained the previously selected socket
index while refreshing the quote. That could authorize destruction of a gem
the player had not selected. Refresh now clears the destructive selection when
the item identity or socket contents change, disables removal, and prompts a
fresh gem selection. Unrelated equipment changes preserve the selection.

The two reproductions failed before the fix. Final Forge refresh/UI/progression
and bindings selection passed 42 tests in 1.182s; scoped lint and whitespace
checks passed. An intermediate invocation named a nonexistent preview test
file and failed; the final run uses the existing ForgeUI/ForgeProgression files.
Server behavior is unchanged; the prior server and reconnect receipts remain
applicable. This client fix is local 1.35 work, not part of the pushed 1.33.
