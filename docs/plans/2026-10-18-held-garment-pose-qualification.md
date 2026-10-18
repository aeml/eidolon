# Held garment pose coverage and the outfitter header

The existing outfitter already switches between inspecting a held item and
showing the full character. This work reuses that control. The existing twelve
held-preview cases now cover all six modeled weapon/offhand families in both
High1280px and Low390px viewports, using their matching supplied class, a
class-themed full outfit and fourteen actual catalogue equipment entries.
The dagger fixture uses the Rogue and its offhand sword. The original
compare/apply, versioned-model, overflow and authority checks remain.

Each supported pose is inspected at35percent in both full-character and
held-item modes. The actual pointer slider, keyboard End/Home and held final
frame are checked. Comparison retains the pose and moment; changing focus
restores framing. The independent body outfit remains visible while the held
look changes. No pose/focus input sends an appearance request or mutates real
gear/appearances. Applying still uses the existing explicit server selection.
These twelve existing identities join the required native equipment stage;
there are36preview identities across the two files, not duplicated counts for
hosted/native executions.

At e278c0b76160c9a221d67dc14960d5589dc1eb42, all twelve cases pass in3.9minutes,
retries0/skips0, on a bounded CPU-only browser. The292static samples retain
exact class/outfit/held model, finite camera and no missing/fallback asset.
The renderer explicitly reports SwiftShader. Docker admission was network-none,
one CPU on core14,2GiB, empty GPU devices/requests and no `/dev/dri`. This is
functional/layout feedback, not native GPU, authenticated purchase, live-motion,
physical-device or final-art acceptance. The72-file inventory SHA256 is
`2f062f7a5fd3cdabbe20cbe1d79de3f4e751504ab6815e16a640228a74942f04`.
The copied report preserves its original doubled relative reporter path;
there is no rerun or overwritten report. The packet records the exact e278
inputs; dungeon walls were selected only after that browser process ended.

Those phone captures expose a real sticky-header gap: scrolled catalogue text
can appear above the title. Two existing Tome cases with the new position
assertion reproduce24px desktop and16px phone gaps at a3943b40b. Both failures
remain frozen;22-file inventory SHA256
`cd8bdf687d2519aa001c06b1b96924f505a14bb3e6124468eb05fdc7f594d13d`.

The correction shares the dialog padding through one CSS variable and extends
the actual header box to the scrollport edges. Its background and hit area cover
the former gap; content remains scrollable and Close stays pinned. At
edccd0af84d6cf2024172b416de1b1dbd28dfa16 both unchanged Tome cases pass in42.8s,
retries0/skips0, including48static pose samples, pointer/endpoints, comparison,
framing and the less-than-half-CSS-pixel header alignment assertion. The phone
capture was inspected and no catalogue text appears above the header. This is
also CPU-only browser evidence. The18-file inventory SHA256 is
`d7217ac267cbf35d3f9902491057934da5efa0fddea7d4389b6685e20fd2b990`.
Evidence is under `.qa-garment-pose-inspection` in the owned inspection tree.

The existing four connected wardrobe cases additionally prepare pose-isolation
checks before purchasing their class outfit. They wait for actual outfit/idle
readiness, inspect Run at100percent and return to0, then verify the live
character stays idle with identical gear, appearances, stats, signature, Gold,
level and XP. These updated actual-server cases are linted/enumerated but have
not run yet. Their existing purchase/save/local/remote behavior is retained.

Accepted80/sourcef5401eb714d52055ce2fda52091a540109da6197 already passed the
original four class wardrobe cases in its native job117619348281,5.0minutes,
retries0. Fresh API job logs confirm Fighter, Rogue, Cleric and Wizard all ran.
That is prior raw-development-graph integration evidence. Current81 adds an
explicit copied-publication engine assertion; new82 adds pose isolation. Do
not treat the older pass as proof of either newly added requirement. Current
pipeline and final candidate hardware/connected checks remain required.

The full roadmap and owner-dependent art/device/campaign/operations/beta gates
remain open. Soak/stress and human feedback remain deferred, not passed.
