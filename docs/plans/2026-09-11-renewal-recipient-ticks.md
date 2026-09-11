# Renewal recipient ticks

Unpublished follow-up to recipient-support source31a2f05c. This is separate
from deployed Alpha1.0.62 and does not close native party or full-tree gates.

## Reproduction

Actual paid, duration-trained Healing Light with Renewal reproduced four
failures0.023s: friendly NPCs received no periodic healing with/without stun;
an expired player effect could deliver another overdue tick, and an expired
NPC effect retained its entire budget. Player nonexpired controls passed.
Log `/tmp/eidolon-renewal-recipient-red.log`.

Renewal processing was in the player-only update branch and checked whether a
tick was due before checking whether the effect had expired.

## Repair and focused proof

Shared recipient tick handling now runs for NPCs as well as players, after
damage-over-time and before NPC stun/AI returns. Corpse/empty/expired checks
precede healing. Keep the paid cast snapshot, at-most-one tick per update,
one-second cadence, trained whole-tick budget, recipient healing penalties,
health cap and source/target/instance-tagged heal events. A final tick exactly
at the deadline remains eligible. Completion clears the stored effect state.

- Initial focused three-repeat race1.445s PASS; expanded13.735s PASS.
- Final three-repeat race12.969s PASS including actual paid player/NPC
  recipients with/without stun, seven trained ticks after rank changes, no
  duplicate tick on immediate update, exact/missing/expired deadlines, poison,
  capped/full health, corpse protection and event amount/count/source checks.
- A normal parallel World.Update delivers simultaneous paid player/NPC Renewal
  ticks and events under the race detector. No substitute update implementation.
- Strengthened the existing reflected-Whirlwind-death fixture: its pending
  Renewal now comes from a real paid Cleric cast, with a valid future deadline
  and due tick. This keeps same-frame/no-next-frame resurrection assertions
  meaningful under stricter expiry; no fabricated deadline-free effect.
- Final log `/tmp/eidolon-renewal-recipient-final.log`; initial/expanded logs
  `/tmp/eidolon-renewal-recipient-{green,broad}.log`.

No client/protocol/save-schema changes. Full server regression remains required
before acceptance; parent support-expiry full95191 is still running, so do not
start a second heavy suite. Its accepted client/lint evidence can apply only
after confirming the client and toolchain inputs are unchanged. Native
four-role dungeon, saved builds, earned pacing, phone and full talent/rune
requirements remain open. The soak stays cancelled; release Chrome has the GPU.

## Unreleased patch-note draft

Healing Light's Renewal now heals friendly NPCs over time, including while
stunned. Expired Renewal effects no longer deliver late healing, and healing
cannot revive a recipient killed by an earlier effect in the same update.

## Full server regression accepted ond5b6d3a6

44937 terminated exit0 on unchanged d5b6d3a609a8651005966f06072910d9af256473.
Go race passed root21.725s/game315.975s/loadtest1.028s/database1.122s/
lifecycle1.023s. Log `/tmp/eidolon-renewal-recipient-full-server.log`.
The exact diff against accepted parent8254288d contains only this plan and four
server Go files; client, dependencies and toolchain inputs are unchanged. Thus
the parent's full349suites/4896tests169.442s and lint PASS cover identical client
inputs, alongside this new full server pass. No native party/save/phone or
publication acceptance is inferred from these checks.
