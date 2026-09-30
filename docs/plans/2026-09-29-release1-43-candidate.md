# Alpha 1.43 — combat presentation preview

Unreleased integrated candidate on the prepared1.42 branch. Runtime/package/
login/CI/default build identities and cumulative notes now identify1.43.0.
Ordered publication waits for preceding accepted deployments. Human campaign/
phone observations remain playtest-owned; they are not a new permission gate.

## Draft patch notes

- Retained supporting1.42 contact shadows for phones and Low graphics, grounding
  characters without enabling expensive directional shadows. Contacts follow
  movement and fade during jumps; hidden/stealthed actors remain unrevealed.
  See the [connected route and rendered-floor checks](2026-09-29-low-quality-actor-grounding.md).

- Corrected the four player classes' floating walk/run poses. Walks now make
  ground contact and runs retain stance and flight, including equipped boots
  and moving casts. Movement speed and combat timing are unchanged. See the
  [gait contact review](2026-09-29-humanoid-gait-contact.md).

- Seven creature attacks now use distinct gores, pecks, bites and a javelin
  thrust with anticipation and recovery, aligned to the existing hit timing.
  Planted feet and actual contact anatomy are checked throughout the motion.
  See the [creature pose review](2026-09-29-creature-attack-poses.md).

- Corrected forward basic swings and hit-time alignment for26 additional armed
  regional enemies and dungeon bosses, including Rootbound Warden. Distinct
  bird/bite rigs are not given an assumed weapon animation. See the
  [regional strike review](2026-09-29-regional-strike-contact.md).

- Skeletons, Demon Orcs, Imps, Constructs and Inferno Titans swing toward their
  targets, with the visible strike aligned to the existing basic-attack damage
  time. Damage and cooldowns are unchanged. See the
  [strike direction and timing checks](2026-09-29-legacy-enemy-strike-contact.md).

- Corrected below-floor death poses for22 more regional enemy and boss models,
  including Constructs, Moonfrost enemies and several dungeon bosses. Attack
  animations, collision bounds and encounter timing remain unchanged. See
  [regional death grounding](2026-09-29-regional-death-grounding.md).

- Enemy corpses hold after their death animation and fade instead of abruptly
  disappearing. Skeletons now fall above the floor rather than sinking below
  it. Loot, combat and server respawn timing are unchanged. See the
  [death-presentation checks](2026-09-29-enemy-death-presentation.md).

- Enemy health bars follow camera/movement smoothly and account for model
  height. Wounded and selected foes remain readable without hover, including
  phone targets and PvP opponents. A brief loss segment clarifies hits and
  honors reduced motion; friendly services do not get enemy bars. See the
  [health feedback checks](2026-09-29-enemy-health-feedback.md).

- Periodic damage and healing use smaller body-level cues instead of additional
  decorative ground rings and large particle bursts. Reduced motion retains
  feedback without particle travel. Actual danger/healing ranges and combat
  values are unchanged. See [verification](2026-09-29-periodic-combat-feedback.md).

Supporting1.42 warning/terrain presentation remains integrated:

- Boss danger circles, their shaded areas and regional motifs now sit above
  dungeon floors instead of being hidden underneath them.
- Fireball, Meteor and Explosive Trap impact areas remain visible on dungeon
  floors, without changing their damage radius.
- Guardian Embrace's healing-range circle and ground-level buff rings are no
  longer buried under dungeon floors. Character and body-aura positions stay put.
- Boss warnings respect the device's reduced-motion preference: decorative
  pulsing/rotation stops while the warning edge, label and countdown remain.

No combat balance, encounter timing, rewards, character saves or network
protocol changes. Camera shake already respects reduced motion and its own
strength setting; this preview does not claim universal motion suppression.

See [combat presentation preflight](2026-09-29-1-43-combat-presentation-preflight.md)
for before/after rendering evidence, focused lifecycle/cast checks and crowded
High/Low warning review. Earlier release gates and public deployment remain
outstanding; no live release or complete 1.43 milestone is claimed.

## Ordered integration verification

Built on prepared1.42 commit18a53061; eleven remaining combat commits integrate
through34f32b14. Shared warning/contact/aura and terrain consumers were already
assembled in1.42, so their fixes are retained rather than reapplied. Art source
comparison against048aec6e now shows only the harmless batch-helper blank line.
Actor differs only by forthcoming1.44 audio skill-name arguments; runtime
differences are forthcoming audio and1.45 loot-label presentation. No final
audio/interface code was silently copied into this candidate.

Resolved documentation overlaps by preserving both scoped notes. Retained
newer class batching tests when adding skeleton coverage. The enemy-health
browser-stage conflict adds only its real new test file, not the five absent
future1.45 UI fixtures. Corpse presentation and contact-shadow rendering now
both have their valid imports. No source force-copy or test tolerance change.

Seven existing moving-cast/gait/ability-gesture/batch/health/corpse/basic-contact
seam suites pass79 checks in7.429s; full lint, shell syntax and whitespace pass.
Desktop four-class equipped moving-cast/walk/run/support rendering passes8.7s,
and prepared enemy health/camera/contact/death rendering passes16.7s. Inspected
moving-cast and enemy-contact captures at
/tmp/eidolon-1-43-integrated-cast-0930 and
/tmp/eidolon-1-43-integrated-health-0930. These checks use prepared actors,
not authenticated enemy clears or human combat-feel/pacing measurements.
Unchanged full actor-family/gallery evidence remains in the linked preflights.

Metadata-only synchronization was checked directly: all package/build/runtime
labels agree, cumulative entries are unique and ordered1.43 before1.42, old
1.0 history remains, and every registered explicit browser file exists. This
does not replace the standard CI required for eventual publication. Website
files still matchad22dea7; fetch/merge newer master before each push.

Final authored actors, human enjoyment, full modern-art acceptance and later
representative performance/capacity gates remain open. No additional campaign
soak, real-phone claim, save wipe, production terrain activation or beta access
change. The candidate is ready for ordered CI publication after predecessors
pass, not yet a live or fully accepted Q/CB release.

## Publication integration update

Merged current origin/master0dcb1fd3 into this prepared candidate after a fresh
fetch. Retained all1.42 required-fixture and explicit visible-jump corrections,
the accepted1.40/1.41 receipts, and the website agent's unchanged files. The
single README conflict retains1.43 source identity and the newer accepted1.41
baseline instead of rolling either back.1.42 CI36657023723 is still pending;
this merge does not authorize publication before its public acceptance.

Six changed-seam/version suites pass355 checks in2.879s. Scoped lint and
whitespace pass, and website diff against current master is empty. The
prepared combat gallery evidence above is unchanged and reused; no campaign
or encounter replay is claimed. Fetch/merge again immediately before pushing,
then require this exact candidate's own CI and public release checks.

Latest integration retains1.42 first-party Cinzel correction7ee8c07b and the
full license/source notice. The sole package-script conflict is resolved by
retaining both local-fonts and enemy-health-feedback exactly once in required
interface coverage, not choosing one side. Six font/version/asset/grounding/
resource suites349checks pass4.866s; whitespace passes and website diff remains
empty.1.42 CI36660471426 is pending; this prepared merge is unpublished and
still requires exact1.42 public acceptance before ordered1.43 publication.

Additional loader-seam review reproduced four stale catalog assertions: the
procedural player factories now include Cast/Channel/Guard/Shout/Bless, not
only the prior five basic states. Require the exact ten animation names for
all four classes; keep the emergency fallback and enemy expectations unchanged.
No production animation is removed and no subset assertion replaces the full
list. Loader and actual ability-clip suites122checks pass3.634s; whitespace
passes. This catches a known publication mismatch before1.43's required CI.
