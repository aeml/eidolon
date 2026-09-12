# Ranged positioning in the four-player dungeon playtest

Independent-input run8533 failed at the first Warden on seed7159223432214705865:
Rogue took repeated184damage melee hits at7.44–7.48units without active warnings;
the healer was20.344units away at death with387mana. Retained archive
`/tmp/eidolon-party-independent-failure-5Qgzuf`. Earlier received heal events
already disproved the suspected missing-heal-packet explanation. Neither run
proves a clear or acceptable final balancing.

This candidate changes only playtest movement. After an actual Fighter damage
receipt, Wizard/Rogue seek a firing position inside their real target-padded
basic range and the living Cleric's actual heal range. They hold that position
until the boss closes or healer falls out of reach. Candidate destinations and
complete walking segments must pass encounter, floor and body collision checks;
no verified path means no invented movement. New warnings retain priority.
Moves are ordinary move-only ground clicks within each player's existing serial
worker, with no jump fallback, forced input, damage/stat grant or boss changes.
Recent planned and observed positions are retained separately from success.

Unit tests cover melee departure, support reach, stable firing positions,
obstacles, blocked geometry and invalid inputs. Initial tests caught overly
restricted destination rings and one fixture whose joint destination required
more than the allowed12unit step. The search now includes its full two-unit
holding band; the reachable-support fixture uses a genuinely reachable start.
The12unit bound and full-path rejection are unchanged. Six expanded suites
146tests passed2.054s; lint/assets/diff results are recorded in
`/tmp/eidolon-party-ranged-spacing-{tests,expanded,lint,assets}-20260912.log`.
Full native four-player replay is required; no clear/quest-credit/Water-handoff
acceptance follows from these planning tests.

Replay7792 on3b63d861 terminatedFAILED17.5m, seed-7740520249466063783/gen2/
attempt0/no fallback. Two Skeleton packs and two all-member town recoveries/
saved reentries passed. The first Warden remained alive (last periodic12291HP)
when a Wizard spacing step failed44.342s into combat. All four survived; final
Fighter786HP, Cleric768HP, Wizard/Rogue855HP. Actual0.95545unit walking toward a
1.05766unit destination ended normally near the destination, but the default
movement helper demanded more than one unit. This is input verification failure,
not proof of a blocked character or viable final boss balance.
Archive `/tmp/eidolon-party-ranged-failure-cxYrjI`; original native log above.
Credential scan sanitized2files; owned containers and ports cleared.

Spacing now supplies the existing explicit same-instance arrival region used by
party formation. The0.25unit radius is unchanged; no larger range, forced click,
movement assignment or encounter-boundary relaxation. The recorded numeric
failure is covered alongside wrong-position/instance/death rejection. A fresh
full native replay is still required; this does not turn the failed run green.

Corrected arrival integration: five suites120tests passed1.080s, full lint/diff
passed. Logs `/tmp/eidolon-party-ranged-arrival-{tests,lint}-20260912.log`.

Corrected native57909 on0bf10df6 FAILED7.3m, seed7129785442564118738/gen2/
attempt0/no fallback. The prior short-step assertion did not recur. First pack,
all-four town recovery and saved reentry passed; first Warden combat reached
last periodic1476/15000HP before Fighter died. Final log shows an automatic
town respawn (940HP/610mana), but retained sawDeath=true and the actual fatal
183damage receipt prevent that snapshot from disguising the failure.

Totals: Fighter6864damage/5750taken; Cleric4886effective ally healing/0taken;
Wizard4913damage/0taken; Rogue8125damage/304taken. Other three remained alive,
with9/8/7mana. Fighter had5mana at death and all listed cooldowns ready. These
are low-resource combat observations, not proof that regen should be increased
or that any particular boss value is wrong. Preserve the requested0.01 passive
regen and town recovery loop while auditing sustainable combat and role inputs.

Archive `/tmp/eidolon-party-arrival-failure-PYFrok`; original
`/tmp/eidolon-party-ranged-arrival-native-20260912.log`. Credential scan0 and
owned services/ports clear. No complete dungeon, final quest credit or Water
handoff acceptance. The shared seeded level30/common-gear/5-rank fixture is not
earned first-hour evidence (normal level30 budget is6talent points).

## Tank resource priority correction — not yet native verified

Source inspection after57909 confirms that the contact rotation skipped an
unaffordable40mana Fortress and spent every newly accumulated25mana on Slam.
Even when Fortress was ready, it could never reach its cost. The party-only
hotbar policy now retains the resolved Fortress cost before any lower-priority
cast, including while Fortress is cooling down. Optional Whirlwind also reserves
the next Slam. Fortress itself can spend its protected budget. Unequipped skills
create no reservation; resolved reductions apply; normal solo policy is unchanged.
Basic attacks, gap-closing inputs, all actual game resources, enemies and dungeon
survival/credit gates remain unchanged. This is improved playtest resource use,
not a runtime balance adjustment or proof of a sustainable complete dungeon.

New priority regressions RED5failed/28passed before the change. Final focused
results are in `/tmp/eidolon-party-fortress-reserve-final-20260912.log`; full lint
and diff pass. The old Whirlwind affordability test now requires its actual
combined Fortress+Slam budget; separate unequipped-Fortress coverage retains the
old Slam-only threshold. Corrected native party replay is still required.

## Reserved-mana replay and bounded healer triage

Native70658 on4203d254 FAILED15.7m, seed-3583300797726629916/gen2/attempt0/
no fallback. Early rooms/Skeleton/DemonOrc and two all-four town recovery/saved
reentries passed. First Warden remained alive (last periodic3622/15000HP) when
Rogue died. Tank survived; final F6104damage/3439taken/5Fortress casts,
C5969effective ally healing (4704boss)/184taken, W5313damage/799taken,
R8669damage/2944taken. This is not a full-clear or final-balance result.
Archive `/tmp/eidolon-party-reserve-failure-TzBG9t`; original
`/tmp/eidolon-party-fortress-reserve-native-20260912.log`. Scan0/owned cleanupPASS.

Final receipts explain why35mana/7.5unit healer proximity did not yield a final
heal: Healing Light was still cooling down. At1789221594605 the healer spent it
on tank674/855HP, then approached Rogue312/855HP at14.1501units (planning range14).
Rogue fell to129HP; ready mana34–35 could not bypass cooldown2.82→0.67s before
the fatal attack. Repeated184physical hits at7.45–7.49units and no active warnings
are also retained. Do not infer a missing heal packet or increase regeneration.

The test triage now chooses a below40% ally within a two-unit approach margin
before spending the cooldown on a reachable ally above60%, only if movement is
allowed. It does NOT extend spell range or bypass normal walking/collision.
Urgent reachable targets and the prior far-away-Matron regression keep their
immediate-heal priority; warning holds keep the reachable-target behavior.
Recorded values, exact approach boundary, urgent/self-healing and unavailable
targets are covered. RED2fail33pass; final5suites122PASS1.341s/lint/diffPASS.
Logs `/tmp/eidolon-party-critical-triage-{red,tests,lint}-20260912.log`.
The corrected full party replay remains queued; no runtime/balance or gate
acceptance follows from input-planning tests alone.
