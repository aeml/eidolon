# Earned Earth acceptance — first attempt stopped; travel correction pending native verification

Latest checkpoint: session31615 is **TERMINAL FAILURE**,16.1minutes, zero retries.
Opening/watch/seeds passed; Imps stopped after71.280s and one earned kill with
`No reachable Imp level20+ after bounded ordinary travel`. The character was
alive, level9, full374HP/253mana, x=-189.54/z185.37 after a normal town recovery.
This is not an accepted Imp chapter or Earth-readiness result. Wrapper cleanup
completed; owned18285/18286/4187 listeners absent and own containers removed.
Original log, screenshots and sanitized Playwright report are preserved under
`/tmp/eidolon-earned-earth-20260914-i96Zm2/`. Do not poll/restart31615.

The helper issued12-unit ground moves but accepted each after only one unit of
observed displacement. A100-step town return could therefore end before the
western Imp sector, without ever being stuck against a world obstacle. A focused
regression with partial strides reproduces the same no-reachable-Imp failure;
waiting for up to8units of each stride resolves it within the SAME100-step cap.
The existing phase/encounter deadlines, real move-only clicks, death checks,
target level filter and all game mechanics remain unchanged. New movement wait
is bounded at2.5seconds; no teleport, grant or weaker quest requirement.

Focused result:32tests/3suites PASS0.682s, including the new traversal regression,
expired deadline/death rejection and existing target input/eligibility coverage;
changed-file lint and whitespace checks pass. The initial test adapter needed
its Playwright assertion signature corrected before the meaningful red/green
comparison. This modeled movement regression is not native proof of the repair.
Next action: verify corrected travel in native gameplay before accepting readiness.

## Original attempt contract

One existing strict `fresh-story-ready` attempt, started after Alpha1.9.9 passed
every deployment gate. Clean sourceee03850487b34d6241365494b49260092e635a85
(runtime3481f89a), ordinary fresh Wizard, town recovery enabled, no daily quests,
grants or legacy comparison routes. Normal earned gear and training are allowed.
Persistence checkpoints reconnect; do not describe this as uninterrupted play.

Session **31615** is now terminal as recorded above. Log outside Playwright's cleared output:
`/tmp/eidolon-earned-earth-20260914-i96Zm2/run.log`. Owned isolated runID
`earthready0914i96`, API18285/Mongo18286/Web4187. The wrapper cleaned up its
disposable services. No runtime or route module changed during the attempt.

## Completed phases so far

- Opening plus diary: **104.098s**, no deaths. Ordinary level1/all base stats10
  and rested regeneration0.11 verified. Opening manually pays100Gold/100XP;
  diary pays25Gold/200XP. Diary completion persists across reconnect, level3.
- Earth watch: **605.076s**,40/40 server-credited kills, no deaths,19 ordinary
  town-rest stops. No training stop; nine gear slots filled with earned drops.
  Immediately before claim: level6,372XP toward725,695Gold. Explicitly asserted
  quest was not completed and paid nothing before clicking **Complete Quest**.
  Manual Ilyra turn-in then grants100Gold/1593XP, shows exact authored completion
  dialogue, and results in level8,240XP toward1325,795Gold. Both character snapshot
  and complete quest receipt are identical after reconnect; next chapter was not
  silently accepted. Unsold180Gold vendor value is inventory, not realized income.

- Seeds: **186.042s**,8/8items after20observed target deaths, no player deaths.
  Exact eight-item bag count and consumption at manual turn-in passed; no surplus
  fragments. The next Imp chapter started at level9/465XP/1077Gold.

Repeated logged town recoveries restore
mana and bank Well Rested through ordinary movement; the route has not fabricated
resource recovery. These timings include automation/recall/return overhead and
are not measured human chapter-completion times.

## Still open

Imp hunt, second investigation, Orc hunt, handoff and earned level30
readiness. This attempt only proves Earth readiness if all eight phases pass;
it cannot close all-realm campaign, dungeon, raid or physical-phone requirements.
Retain the already accepted prepared four-player Verdant result separately.
