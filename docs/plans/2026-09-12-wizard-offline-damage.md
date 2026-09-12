# Wizard named damage and offline base parity — unreleased

> Release65 provenance: this imported investigation records the original
> development branch, not acceptance of the scoped release integration. Original
> hashes, broader campaign/raid behavior and native results are historical. See
> [release65 scope and gates](2026-09-12-release65-wizard-training.md) for current
> integration evidence and remaining publication requirements.

Based on Time Warp Mastery3a003536, not yet merged into primary97cd447b.
The nine damaging Wizard Masteries were calculated on the server but absent
from offline damage. The repaired paid-cast path snapshots the named multiplier
once, composes the stored Focus charge once, and retains it on delayed missiles,
projectiles and fields. Shield, Time Warp and Teleport keep their distinct
training consumers. Padded/unpadded saved IDs use the highest bounded rank,
without double counting or mutating the save.

The same pass found five outdated offline base formulas. A shared test fixture
now validates all nine profiles against actual paid server casts and offline
impacts. The client profiles use the server's existing base coefficients and
integer conversion boundary. No online base-damage rebalance is introduced.

At40 Intelligence, before training or Focus:

| Skill | Previous offline | Authoritative / repaired offline |
|---|---:|---:|
| Flame Whip | 80 | 105 |
| Flame Tornado | 110 | 150 |
| Scorch Beam | 125 | 105 |
| Arcane Missiles, each | 50 | 55 |
| Dragonfire Lance | 210 | 300 |

Fireball100, Meteor170, Inferno70 and Gravity Well60 retain their base values.
Delayed missiles now retain cast-time Intelligence as well as training, even if
the caster changes before a scheduled missile appears. Existing resource,
geometry, rune, critical and receiver paths remain in place.

## Evidence

- Initial48565:28failures/33controls in0.707s, reproducing missing Mastery on
  all nine paid casts and missing Fireball Mastery alongside trained Focus.
- Initial multiplier repair92349:3suites109tests passed1.047s. Expanded actual
  projectile impacts and rank/alias/isolation checks passed72tests0.692s.
- Canonical base/rounding contract36742 then reproduced33offline failures,
  50controls0.762s. The first server contract76635 used changing MaxHealth to
  measure Gravity Well damage; its stat recalculation made that fixture invalid.
  Measuring actual pre-cast minus post-cast Health corrected the test, without
  changing the server implementation.
- Server61539: all54actual cast cases (nine spells,0/1/5ranks, ordinary/focused)
  passed three times with race detection in16.175s. Instant spells measure HP
  loss; projectile/field cases verify spawned damage and count. This does not
  establish every server projectile's eventual impact or every rune interaction.
- Initial base repair left one old offline Focus expectation for Dragonfire
  Lance's obsolete50+4I formula. It now expects the authoritative100+5I formula.
  The remaining149checks in that batch already passed.
- Final12084:15suites/588tests passed3.457s plus full lint. Includes paid casts,
  real offline instant/projectile/field impacts across bounded and malformed
  ranks, paid Focus composition for all nine spells, post-cast rank/Intelligence
  changes, exact integer damage, actual critical shield absorption, rejection
  and authoritative isolation, and surrounding targeting/geometry/presentation/
  resource/Time Warp regression tests.

Logs:
`/tmp/eidolon-wizard-offline-mastery-{red,green,impacts,final}-20260912.log`,
`/tmp/eidolon-wizard-base-parity-{red,green}-20260912.log`,
`/tmp/eidolon-wizard-base-contract-server{-green,}-20260912.log`,
`/tmp/eidolon-wizard-damage-{family,final,lint-final}-20260912.log`.

## Remaining work

Full integration of this candidate and its Time Warp parent, the expanded
native Time Warp route and relevant browser gameplay, measured progression/
balance, and a versioned release with patch notes are still due. Other Wizard
differences (runes, status durations, generic talent effects and legacy ability
fallbacks) remain audit scope. This is not complete combat parity, full160-talent
acceptance, physical-phone acceptance or a deployment.

Release63 CI34660899212 remains active on separatef866df68 in required self-hosted
full-character gameplay. No competing local full/native run was started. Soak
remains cancelled; the full1.1–1.10 roadmap and four-role dungeon gate stay open.
