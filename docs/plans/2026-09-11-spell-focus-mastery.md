# Spell Focus Mastery — unreleased

> Release65 provenance: this imported investigation records the original
> development branch, not acceptance of the scoped release integration. Original
> hashes, broader campaign/raid behavior and native results are historical. See
> [release65 scope and gates](2026-09-12-release65-wizard-training.md) for current
> integration evidence and remaining publication requirements.

Based on protection-status candidate3b23c231 in
`/tmp/eidolon-focus-mastery-20260911` (`work/focus-mastery`). Primary development
remains at full-accepted ae938843; neither this change nor its protection-status
parent has passed full integration yet.

## Confirmed defect and repair

WIZ_15 already defines +4% Spell Focus damage per rank, but Spell Focus does not
directly deal damage. Its next-spell multiplier was hard-coded to2.5, ignoring
Mastery entirely. The repair applies the existing bonus to focused-spell damage:
2.5 at zero ranks, 2.6 at one, and3.0 at five (+20% relative focused-spell damage).
The untrained effect, mana cost, cooldown, duration and qualifying damage skills
are unchanged. This is not a new damage-over-time effect or a second charge.

The paid Focus cast stores its trained multiplier. Later rank changes cannot
retroactively alter that charge. Utility casts and rejected damage attempts
preserve it. The next accepted damaging spell consumes it exactly once; expiry
clears it. Fireball's own Mastery and empowered rune remain separate modifiers.
Warp-rune damage cannot borrow the stored Focus boost.

The server uses normalized training at activation and retains the original2.5
fallback for legacy active charges lacking stored strength. Offline casts use
the same canonical WIZ_15 metadata and rank bounds. Talent copy now explicitly
says “focused-spell damage” and that it is captured when Focus is cast.

New protobuf field120 carries the stored multiplier without exposing private
ranks. Both server copy paths, full state and scalar-change deltas preserve it.
Inactive charges publish zero without generating spurious deltas. Both client
support paths update the buff's displayed damage bonus, retain strength across
duration-only updates, and clear it after consumption/expiry. A scalar-only
packet cannot grant a charge. Legacy active packets retain their original
untrained display. Existing protocol-generation tooling regenerated bindings.

## Focused proof

- Initial server64581: three ranked failures,0.159s; initial client: three
  failures/34controls,0.605s. Both reproduced the unchanged2.5 multiplier at
  ranks1/5/99. Logs `/tmp/eidolon-focus-mastery-{client,server}-red-20260911.log`.
- Initial client37tests passed0.582s. Server72305 passed three repeated race
  runs in4.022s, including paid Focus, utility preservation and one-charge damage.
- Final20140:7client suites/152tests1.775s and full lint. Includes malformed/
  bounded ranks, cast-time rank changes, rejected/utility casts, next-projectile
  damage, real protobuf/defaults, both support paths, accurate buff display,
  scalar-only safety, legacy compatibility and surrounding protection/Warp/
  Time Warp/status regression tests.
- Final15331: root wire/snapshot/delta/copy race tests passed1.658s; game tests
  passed three repetitions with race detection9.839s. Actual paid casts verify
  ordinary and trained projectiles, one charge only, actual server world-tick
  expiry, Fireball Mastery/rune composition (20 *1.2 *3 *2 =144), and unchanged
  utility Warp damage with a trained3.0 Focus charge. Existing Arcane Shield
  defenses and Wizard duration checks remain included.
- Logs `/tmp/eidolon-focus-mastery-client-{green,final}-20260911.log`,
  `/tmp/eidolon-focus-mastery-server-{green,final}-20260911.log`,
  `/tmp/eidolon-focus-mastery-lint-20260911.log`.

## Remaining gates

Full client/server integration of both this candidate and its protection-status
parent; native earned purchase, actual hits/receiving defenses, both-client
display and fresh saved ranks; measured balance and a versioned deployment with
patch notes. Unit fixtures do not prove earned progression or live acceptance.
Other utility Masteries (especially non-damaging Time Warp and base Teleport),
the full160-talent audit and all1.1–1.10 roadmap requirements remain open.

At23:56, Alpha1.0.63 run34658209958 was still executing its required self-hosted
full-character gameplay. No competing local full/browser run was started.
This later Mastery/status work is not in63. The cancelled soak stays off.
