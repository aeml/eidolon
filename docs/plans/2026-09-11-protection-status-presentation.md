# Shared protection status — unreleased

> Release65 provenance: this imported investigation records the original
> development branch, not acceptance of the scoped release integration. Original
> hashes, broader campaign/raid behavior and native results are historical. See
> [release65 scope and gates](2026-09-12-release65-wizard-training.md) for current
> integration evidence and remaining publication requirements.

Based on full-regression-accepted ae938843 in
`/tmp/eidolon-protection-status-20260911` (`work/protection-status`).

## Behavior and scope

The existing InvulnerableEndTime is used by Teleport Phase, Cleric protection
and PvP opening protection. A Phase-only label would misidentify the latter
cases. The new shared status is named **Protected**, with its remaining timer
and the description “Temporarily immune to damage.” The gameplay deadline and
damage resolution are unchanged; replicated visual state cannot grant immunity.

The active bit and remaining duration use new protobuf fields 118/119. Full
state, duration refresh and explicit expiry deltas derive from the existing
deadline, including a final expiry smaller than the ordinary 50ms duration
threshold. Dead entities expose no protection. Both detached entity-copy paths
preserve the deadline, so new observers do not lose or restart it. The existing
protocol-generation script regenerated the Go and browser bindings.

Local and remote support synchronization uses the actual duration with no
fabricated fallback. Offline Phase shares the attached visual through its
existing timer. Thin silver-blue seals and small orbiting shards preserve the
character silhouette; no box, sphere or opaque body shell is introduced. The
effect follows the actor, supports High/Low detail, expires during stun, and is
cleared on death and respawn. The tracked buff entry uses the same countdown.

## Focused evidence

- Initial client regression: all 11 tests failed in 0.586s, reproducing missing
  protocol fields, status synchronization and offline Phase presentation.
- Initial server protection checks caught a missing deadline in GetEntityCopy
  after the separate replicated-state copy path had been updated. Both now
  preserve it; the existing real GetStateForPlayer authority test also covers it.
- Final client run7237: 8 suites / 143 tests, 1.591s, plus full lint. Includes
  actual protobuf round-trips/defaults, local/remote effect lifecycle, High/Low
  geometry, timer-only refresh, tracked buff, death/respawn cleanup, expiry under
  stun, no visual-granted immunity, and existing Phase/buff/Teleport regressions.
- Server56665: root protection wire/snapshot tests passed1.306s with race
  detection; focused game protection/Teleport/PvP checks passed5.279s.
- Expanded74366: actual Arena and Duel tests (including real 2v2 attacks),
  Teleport Phase duration and replicated-state authority passed three repetitions
  with the race detector in42.356s.
- Logs: `/tmp/eidolon-protection-status-{red,green,final,lint}-20260911.log`,
  `/tmp/eidolon-protection-server-{green,final}-20260911.log`,
  `/tmp/eidolon-protection-pvp-race-20260911.log`.

## Still required

Full integration for this newer protocol/status change, native two-client
gameplay and screenshot inspection, actual earned Phase/set use, saved builds
and versioned publication remain due. These focused meshes are not native
visual acceptance. This does not close Teleport, all 160 talents or 1.1.

The parent Teleport Warp/charge candidate ae938843 separately passed full69259:
360 suites / 5,177 client tests (103.576s), lint and the complete Go race suite
(root14.419s; game265.620s; database1.082s; lifecycle1.018s). Primary development
was fast-forwarded to that accepted parent, not to this newer status change.
Full logs: `/tmp/eidolon-teleport-visual-full-{prepare,client,lint,server}-20260911.log`.

Release63 CI34658209958 remains a separate publication track. At23:41 it had
passed hosted client/server and two browser shards; one browser shard was still
running before the required self-hosted gates. Neither this status change nor
its Teleport parent is included in63. The soak remains cancelled.
