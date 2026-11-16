# Inspect garment poses in the VIP Outfitter

Veyra's preview gains a Pose selector and Moment slider. Players can inspect
standing, combat stance, running, attacks, blocking, supported skill poses,
jumping and death, scrub their progress, rotate the model, and compare with
their equipped look without changing gear or sending an appearance request.
The Rogue's dual-wield preview also offers its actual offhand strike. Applying
a selected look still uses the existing explicit Apply button and server rules.
The character equipment portrait and centered garment-slot row retain their
existing behavior. The Player Guide explains the new controls.

The inspector uses each private preview model's supported clips and actual
clip duration. Choosing a pose samples35percent; the slider supports0–100percent,
including a held final frame. Animation-name resolution supplies the current
state so inspecting a dual-wield strike cannot consume the live actor's attack
alternation. Precise posed bounds frame the model after bone/equipment updates.
An equipment/appearance refresh keeps the selected pose and fraction when it
remains supported. Controls disable during loading and disappear when there is
no selected look. Disposal removes their listeners and the existing private
mixer/renderer ownership; there is no new animation loop or timer.

Component source is dc49a6d6bc5401d30654a1fa81276b0d6b341c73. All85focused checks
across six suites pass in3.378seconds, including actual mixer endpoints,
dual-wield main/offhand resolution, preview loading/disposal, cosmetic ownership,
existing full-outfit behavior and browser/native stage enrollment. Changed-file
lint and diff checks pass. The existing vendor file still contains24case
identities; they are also enrolled in the required native equipment stage.
Hosted/native executions of those identities are not counted as distinct cases.

All24existing vendor cases pass in1.9minutes with workers1, retries0 and skips0.
The renderer is native AMD Radeon through ANGLE/Vulkan/RADV; software fallback
is explicitly rejected. The cases cover12outfits in High/1280px and Low/390px
viewports: each of the four class outfits uses its matching supplied rig, while
the eight universal outfits use Fighter. Prepared preview actors use actual
catalogue assets and three equipment entries; this is an appearance fixture,
not an authenticated purchase or a saved fourteen-slot gameplay route.

The retained attachments contain290static pose samples, all at the intended
35percent, with exact class/quality, expected garment, finite camera and no
missing asset or model fallback. Native keyboard End/Home verifies the held
100percent endpoint and return to0. Inspecting poses sends no network command
or gear/appearance mutation. Comparison retains Run at0; the explicit Apply
sends the existing exact appearance selection. Empty-catalogue cleanup removes
the controls and final disposal removes the dialog. Existing versioned-asset
and horizontal-overflow assertions remain. Fighter desktop, Cleric phone and
Rogue attack images were inspected. Phone output is a browser viewport, not
physical-device acceptance; the scrollable preview remains part of the store.

The54-file private inventory SHA256 is
`65060d16f4fffce3998540dcd91676faa02fe7dd294746bc43ac7ff8e49b5740` under
`.qa-garment-pose-inspection/native-v1` in the owned inspection worktree. It
contains the48PNG captures, report, aggregate qualification, final CPU output,
case enumeration and terminal native log.

This qualified component remains isolated for the next coherent milestone.
Pending Alpha1.79.81 must finish its own CI/deployment/public verification first.
This inspection capability does not close universal outfits on every class,
all moving garment/combat poses, final owner art approval, physical devices,
performance budgets, campaign, operations, beta or the complete roadmap.
Movement-audio's incomplete full gameplay gate remains separate. Soak/stress
and human feedback remain deferred, not passed.
