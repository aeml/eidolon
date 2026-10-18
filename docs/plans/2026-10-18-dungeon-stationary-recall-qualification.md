# Dungeon recall qualification for the stationary-cast release

CI39122629755/source966d5639a passed the server, client and all three hosted
browser jobs. Its System Chrome release smoke failed in the second portal
visit: the old fixture pressed B during a Ctrl-click jump and expected the
former immediate teleport. The following inventory case inherited that dungeon
save and could not use its overworld combat waypoint. Deployments were skipped;
public frontend/backend remain Alpha1.79.80. This failed attempt is retained.

A disposable reproduction at aa3487f764f79eb90236b281a2be212eee9af422 preserves
all original inputs and assertions and observes bounded key/send/receive/state
snapshots. Standing recall completes twice. In the airborne attempt the server
starts a three-second recall and then cancels it when the jump arrives; the
player lands in the same dungeon. All observer wrappers restore. The route
reproduces both failures, with two passes and the existing separately selected
long-jump case skipped. Its24-file private inventory SHA256 is
`5f31d861e5171f4d05eb9cfc62e2115552988039f64a1626959c06c1a31df81b`.

The selected test correction at848496e38388b5432c917c56ed7d6be6eb680bd7 keeps
both actual portal visits and the native Ctrl-click jump. It requires the
in-flight B request to be cancelled or rejected by the server. Either outcome
is valid: a jump already active at admission rejects the cast; a jump arriving
after cast admission cancels it. A started/cancelled pair must retain the same
cast ID and three-second duration. The player must land, clear pending recall,
and remain in the dungeon beyond the cancelled cast's deadline. The fixture
then retries B while standing and retains the original complete town scenery,
collision, position and stale-jump recovery assertions, including stable arrival
1.1seconds later. Both successful recalls must take at least three seconds.
Only an observed deliberate airborne rejection can account for its exact
stand-still console error; all unrelated browser errors remain fatal.

The complete corrected private System Chrome release-smoke route passes all
four enabled cases in1.9minutes, retries0. The existing explicit long-jump
selection stays skipped and is not counted as passed. The portal audit records
three actual B requests: standing completion in3014ms, airborne
started/cancelled, and standing completion in3012.1ms. Both observation methods
restore. Combat/loot, fresh-login persistence, reconnect, menus, bag drag-out,
manual ground recovery and saved Journal tracking also pass through the
original route. The21-file private inventory SHA256 is
`33980471263dbac941f143b5ecc54b5d5da69f494e59b14148dcd9a1406178e2`.
Evidence is under `.qa-dungeon-recall-diagnosis/native-v1` and `native-v2` in the
owned diagnosis worktree; the original diagnostic commit is archived separately.
Its disposable services, account and network are removed after each terminal run.

This changes the fixture's obsolete instant-recall expectation to the requested
stationary cast. It does not change game/server behavior, deadlines, movement
geometry, the six original roof routes, performance budgets or campaign scope.
The combined selected QA source also includes the separately qualified JSON
reporter attachment privacy correction. All491focused checks across five
suites pass in17.884seconds, including helper policy, native stage selection,
privacy and synchronized release/patch-note presentation. Alpha1.79.81 still
requires its own complete CI, deployment and public-byte verification. The full
roadmap remains active; soak/stress and human feedback remain deferred.
