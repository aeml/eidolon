# Party kill credit — requested September 10

The user requires every party member inside a dungeon to receive kill credit,
and overworld party XP to share within roughly two gameplay screens. This is
independent of which member deals damage or the killing blow.

## Rules

- Dungeon/raid party credit covers the entire same instance, including downed
  members. Being in another instance, recalling before the kill, or being
  disconnected does not qualify.
- Overworld party credit uses a server-owned110-unit radial distance from the
  enemy's death position. Two default16:9 desktop widths are
  `2 * (2 * camera zoom15 * 16/9) = 106.67` units, rounded to110. Zoom, phone
  orientation and resolution cannot enlarge this radius. Downed members still
  in range count; disconnected members do not.
- The existing shared kill-reward pipeline uses these recipients for XP, Gold,
  kill objectives and existing boss rewards. Reward formulas/drop values are
  unchanged. Quest completion remains a manual NPC conversation for each player;
  the group crystal-raid gate still requires every member's completed chapter.
- Recipients are captured before asynchronous reward work. Leaving after the
  kill retains credit; arriving afterward cannot acquire it. An ineligible
  party source does not fall through into unrestricted solo rewards.
- Unknown/PvP instances are not silently treated as whole-instance dungeons.

## Implementation and evidence

The separate worktree`/tmp/eidolon-party-quest-credit-TWcbwr` branched from
primary7d8fb5bb while its browser run remained frozen. Runtime760d0ff8 introduces
the shared eligibility rule and prepared reward-pipeline regressions.

Baseline5059 passed the nearby four-role manual-turn-in regression2.080s.
Extending it to distant/downed members produced the expected red77255: only2/4
received rewards after5.326s. After the policy correction51954 passed1.440s.
The radius/death-pipeline repeat63070 passed three repetitions2.477s before
the final downed-overworld inclusion and kill-time capture changes.

Kill-time capture preserves explicit lock ownership: ordinary timed impacts
and world ticks do not own the world lock; direct ability dispatch does.
Whirlwind and chained explosions propagate that ownership. Recipient lookup
temporarily releases the already-dead corpse's lock and restores it afterward.
No combat damage, cooldown, healing or targeting behavior is changed.

55402 passed focused party/Whirlwind/explosion race coverage5.700s.90050 passed
three repetitions of current eligibility, actual overworld death rewards,
four-role manual quest/raid gates and delayed-reward snapshot cases3.772s.
The delayed-delivery test exercises both timed-impact and ability-dispatch
lock paths, pausing at an existing room-reward event before final kill payout.
Prepared reward tests do not constitute a browser dungeon clear or earned story.

Pending: release integration, native reward-sharing checks, versioned patch
notes and deployment. Primary development integration follows verification.
The first full four-player clear remains separately unproven; its healer input
controller still needs work around large-boss approach/targeting.

First full server49313 completed with one outdated expectation: the overworld
Chronicle party test excluded a downed nearby member. Root server28.792s and
game30.690s; no race warning. The new requirement intentionally includes that
member. Update that expectation and add disconnected exclusion, retaining all
unaccepted/completed/distance/instance and duplicate-kill assertions. Current
focused83708 then passed3.371s. The first full run used the unchanged dirty
kill-time source after a staging path error; it is not a clean-source pass.

Desktop party guidance now explains whole-instance versus two-screen sharing.
The existing bonus badge is explicitly an upper bound for the eligible-party
Gold pool, not a promised personal XP bonus. Phone has a collapsed reward-rules
disclosure with a44px minimum touch target. Focused47754 passed114client tests
across3suites3.9s plus lint; this is not physical-phone/browser layout approval.

## Final server verification

The clean0c86a625 full server attempt9852 failed with an unlocked-mutex panic
in `TestChronicleWorldDropsCannotExceedRemainingPersonalObjective`: that older
test called the death handler without owning the target lock. Auditing all
direct test call sites found the same omission in existing routine-loot,
progression-pacing, Well Rested and QA-reward fixtures. Commitdecb1693 makes
those calls honor the existing production lock contract, without weakening any
reward assertions, and documents that contract. It also updates invitation copy.

Full `go test -race ./...`32932 then passed: root server32.025s, game396.415s,
other tested packages passed/cached, no race warning. The compiled test set
preceded the additional tests in5f323d41; production source remained unchanged.
Those additions exercise actual `PerformAbility` dispatch for Whirlwind,
Frost Nova, Rain of Arrows and Smite, plus a Smite-triggered explosive chain.
All four recipients include distant and downed allies, with unclaimed objectives
and positive XP/Gold. Focused58185 passed three repetitions3.713s; final40190
repeated the combined eligibility, delayed-reward, real ability, overworld
death and manual chapter-turn-in tests three times, passing7.262s. Manual
turn-in assertions now use detached snapshots so a failed assertion cannot
strand an entity read lock. These are mechanical server proofs, not a clear.

Complete client regression/lint83603 passed on clean5f323d41:311 suites,
4,272 tests,160.012s, and zero-warning lint. Archive
`/tmp/eidolon-party-credit-proof-h2Ko7l` contains full server/client/lint and final
focused race logs. All local test handles are terminal. No push, version
assignment, native sharing proof or production acceptance is implied.
## Proposed player-facing patch note

Party members in the same dungeon now share kill credit regardless of distance,
including downed teammates. Overworld parties share nearby kill rewards within
roughly two normal screens. Credit is recorded when the enemy dies, and quests
still require each player to return to the quest giver to complete them.
