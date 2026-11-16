# Regional enemy death grounding

Continuation after6791e000 corpse fade/Skeleton fix. Full ordered roadmap active;
local candidate only, no deployment/version bump or release-gate waiver.

Audited the actual rigid-mesh death clips for38 models across the Legacy,
Moonfrost, Overworld, Thorncrypt, Molten, Tempest and Abyssal families.22 additional
models had visible vertices more than0.04m below their local floor during the
fall; the worst was InfernoTitan at about-2.415m. This affected small enemies,
large constructs, birds and several bosses, not only the Skeleton.

Added reviewed body-height tracks for those22 models. Each uses33 equally spaced
keys measured from the existing animated mesh, keeping the initial pose and
lifting subsequent samples only enough for shallow floor clearance. Factory
rest-ground offsets are included. Every other animation track, duration, model,
combat radius and collider stays unchanged. There is no runtime vertex sampling,
per-frame physics correction, new geometry/material or floating ground offset
applied to the logical actor. Imported actors and types without a correction
retain their clips. The source table/helper is6,534 bytes.

## Evidence and limits

-173 focused grounding and seven-family regressions pass6.512s. The floor check
  evaluates every visible vertex over91 samples/model, deliberately between
  the33 authored correction keys; all38 stay above-0.03m relative to their local
  flat floor. Existing attack/state/rig/reset/bounds checks also pass.
-Two existing combat-health browser cases pass17.1s. Extended the prepared
  corpse view to include the actual Construct death clip alongside Skeleton.
  Desktop/phone images inspected at `/tmp/eidolon-enemy-grounding-0929`.
-Scoped ESLint and whitespace pass. No new browser cases, long encounter run,
  reward grants or live gameplay mutation.

The captures verify two models visually, not all38. Numeric floor clearance does
not establish polished animation, earned encounter behavior, ground contact on
arbitrary slopes, imported/remaining actor coverage or final art acceptance.
No server death/removal/loot/respawn change. The pending1.39/1.40 acceptance
policy is unchanged; these checks do not waive ordered publication gates.
