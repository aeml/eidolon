# Practice-duel mana assertion and rested expiry

Recovery58 runtime is unchanged by this correction. Full gameplay82037 on1fd0d35
failed four class duel cases after earlier dungeon, resources, phone, collection
and maximum-speed movement batches passed. Each expected110 mana from town but
observed100 during combat. The class animation/multiplayer/nameplate/rest suffix
had NOT run. Original log `/tmp/eidolon-rest58-all-node24-rerun-0935.log`, archived
with report and screenshots at `/tmp/eidolon-rest58-duel-mana-failure-BMUpaP`.
Credential scan passed0; exact disposable containers/image/network and ports
were independently absent after the terminal failure. No production data removed.

Diagnostic-only f3b944f retained maxima and rest clocks BEFORE the original
assertions.16108 repeated all four original failures, with both sides of every
duel showing mana110/max110 and2.28–6.60 earned seconds in town, then mana100/
max100 and bank0 in the arena. Actual accepted attacks/positive damage preceded
the check. This proves expiry, not mana spending by basic attacks. Server expiry
recalculates stats and clamps resources to the lower maximum. The old fighter
capture also visibly showed100/100 mana, but does not establish long-run FPS.

Diagnostic log `/tmp/eidolon-rest58-duel-diagnostic.log`; retained archive
`/tmp/eidolon-rest58-duel-expiry-proof-SeqVF5`. Both runs remain FAILED, not
retrospectively passed. Diagnostic scan0 and exact cleanup verified.

d96ab83 (primary23a4df2) now requires full mana before combat, the expected current
level-one maximum100/110 for the observed rested state, and full CURRENT mana
during the duel. Attack counts/intervals, real positive hit receipts, damage,+scene entry/exit, forfeit, saved rating and zero ranked/economic rewards remain
unchanged. No buff, PvP, clock, retry, timeout or gameplay change was made.

4c2654e adds an opt-in recovery-tail rehearsal containing the exact final five
steps of the unchanged full route. Harness58502 passed18tests/4suites/0.889s,
lint and shell syntax. Logs `/tmp/eidolon-rest58-duel-tail-{harness,lint}.log`.
This shorter rehearsal is diagnostic preparation, NOT a replacement for the full
all-route acceptance. Corrected real browser replay, complete full regression,
ordered releases56–58 and exact live recovery verification remain due.
