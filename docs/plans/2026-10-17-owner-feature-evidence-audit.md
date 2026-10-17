# Owner-added features: implementation and remaining acceptance

Read-only audit of master `b75b0d621320a2b99f03cdb0590d351ee6c8d221`.
Observed2026-10-17T19:00:22.853Z; the states below describe that checkpoint,
and later release acceptances take precedence.
The accepted public reference is Alpha1.79.75/source`baf7839f`, verified at
2026-10-17T17:33:01.217826+00:00. Alpha1.79.76 deployment acceptance is pending.
This audit reconciles the garment, quest/menu and road-overlay requests without
closing their original full acceptance checklists or the larger game goal.

## Garments

A current-source inspection verifies18distinct modeled designs:12full outfits
and6held families. There are96body GLBs (every outfit, all four supplied classes,
High/Low) and12held GLBs. All108files match their complete catalog SHA256 and byte
length, registered version prefix, committed source and retained public75 hash.
Every body model contains geometry for all seven body coverage slots; all four
class fits and both qualities exist. All eighteen designs have matching server
offers. This is actual GLB geometry, not a count of palette variations.

| Owner requirement | Current evidence | Still required |
| --- | --- | --- |
| One armor choice replaces all body gear | `applyFittedEquipment` retains only active hands when an outfit is selected; the garment covers head/chest/legs/feet/gloves/shoulders/belt. Accessories are suppressed with underlying body equipment. | Final outfit/gear clipping review; no new implementation gap found here. |
| Independent weapon and offhand looks | Six held models match sword/dagger/staff/mace/shield/tome server offers; real empty/illegal hands remain filtered through active equipment rules. | Final grip/dual-wield visual review; new families must extend coverage. |
| Four class-themed and eight universal outfits | Iron Oath, Nightglass, Dawn Reliquary and Astral Sovereign, plus Winterthorn/Hollow/Rosebound/Lantern/Springbloom/Solstice/Harvest/Masque. All12have all four class fits. Class theme does not add an equip restriction. | Owner collection art approval, including whether the looks meet the requested style. |
| Preserve actual gear, stats and old individual looks | Render-only appearance projection and underlying real equipment remain separate; accepted saved-session proof buys/applies/clears looks through sockets and three server lifetimes. | Broader final returning-save review; hashes do not prove every possible save state. |
| Vendor, character, local and remote consistency | Actual-model preview proof; accepted63rendered session and64four-class wardrobe sessions exercise local/remote outfits, hands, real gear and restoration. | Final integrated collection/device review; representative proof is not every possible combination. |
| Three centered garment slots below the portrait | Delivered59 and retained64; scoped character-row qualification covers desktop/phone layout and owned selection. | Final owner usability review. |
| Motion, swap and teardown | Existing outfit matrix samples27class/state combinations and90Run frames, with strict three-cycle restore/resource checks for each selected High/Low fixture. | The matrix names CombatIdle/Run/Attack/Block/Jump/Cast/Death; it does not establish a separately named Dodge clip. Reconcile the contract's dodge wording with supported movement/jump behavior before full acceptance. Do not add or claim a new dodge mechanic from this audit. |
| Model/asset rights | Source and provenance records exist; this audit verifies bytes only. | Owner rights decisions and final shipped notices remain separate. |

Current source and retained qualification support implementation delivery.
They do not substitute for owner art approval, whole-world frame time or actual
phone hardware. [Catalog contract](2026-10-15-garment-catalog-and-full-outfits.md),
[model/fit evidence](2026-10-16-universal-garment-qualification.json),
[saved-session evidence](2026-10-16-garment-saved-session-qualification.json),
[four-class wardrobe sessions](2026-10-16-wardrobe-class-sessions-qualification.md).

## Quest, Lore Book and windows

| Owner requirement | Current evidence | Still required |
| --- | --- | --- |
| Clear tracker, selected task and manual conversations | Source includes tracking choices, current objectives, explicit acceptance/turn-in and pending/acknowledged/rejected action states. Accepted55quest experience and later continuity fixes retain the manual rules. | Final fresh/returning player usability and playtest findings. |
| Story so far and current task | Dedicated searchable earned-memory book, current quest/map links, optional tasks and claimed-finale context are delivered;74adds earned People/Places and read/return continuity. | Candidate77fixes focused heading loss during newly earned context updates; deployment acceptance is still pending. Full owner story/UI review stays open. |
| Tracking choices survive reconnect | Character-scoped local preferences use the stable `player-username` identity on both client and server; source is unchanged from accepted75. | A dedicated actual fresh-login tracking proof was not located in the inspected connected quest route. A fixture extension is being prepared; syntax/lint/discovery alone are not execution evidence. |
| Dragged windows retain positions | Durable wide/compact desktop preferences, companion/reflow guards, resize recovery and Settings reset have94focused/five browser cases; unavailable storage degrades gracefully. | Physical-phone and final shared-menu usability review; phone uses responsive fixed placement, not desktop offsets. |
| Character, bag, stores and related windows look coordinated | Accepted55–64deliver character/bag/store and related forge/stash/trade surfaces, preview/search and return behavior. | Final owner quality review; avoid rebuilding existing previews or position storage. |
| Actual mouse, keyboard and touch | Retained quest/window/menu cases cover these input paths; candidate77adds desktop Enter/phone touch for reading continuity. | Full advertised device/browser acceptance and owner-deferred physical feedback. |

The general [quest/menu contract](2026-10-15-quest-lore-and-window-quality.md)
remains open at its full scope. The [window proof](2026-10-15-durable-window-layout-qualification.json)
and [candidate77qualification](2026-10-17-entry-finish-and-lore-reading.md) have
their own explicit limits. No campaign-duration or pacing pass is inferred.

## Roads, names and auras

The requested overlay ordering correction is delivered in accepted66 and is
retained by current source. Its native case covers player names, mob names and
auras with ordinary depth behavior. Future raised-terrain/road changes still
require applicable review; this is not a blanket pass for all future geometry.
[Release66acceptance](2026-10-16-release1-79-66-acceptance.md).

## Audit custody and next work

Frozen14file audit inventory:
`/home/aeml/.local/share/eidolon-master-20261011/.qa-owner-requirement-audit/qualified-evidence-inventory.json`,
SHA256 `19f4f0b7184f036d3faac5911350f8da696ecf5220c1c193ec9ec835085b0238`.
The108model inspection is
`d50421be537d04cf61dfafa69814932e7c926bcf28aa6e448003173bd15f34b6`.
Ten relevant model/appearance/quest/lore/window/catalog source files are byte
identical to accepted75. The audit verifies the existing40file accepted75
inventory; it adds no new rendering, official-validator, movement or live-public
request claim. Model geometry statistics and body-slot coverage are inspected
from the GLB JSON and accessors; topology alone is not visual quality.

Next software evidence task: exercise manual quest tracking controls, fresh
document/login, retained selections and unchanged personal quest receipts in the
disposable connected quest fixture. Run after current release GPU checks finish;
do not count the prepared fixture as passed. Continue actual world composition,
combat/audio/performance and operations work alongside the unresolved reviews.
All original goal/roadmap/F1–F5/beta/1.99 requirements remain active. Human
campaign/physical-phone feedback and soak/stress remain deferred, not passed.
