# Immediate keyboard return after modal closure — October 17

Qualified private source: `09135c04463923fbe0682b32ef01a08b85f8d6a9`. Runtime repair changes only
`UIManagerWindows.js`; native-control suppression in InputManager is unchanged.
This remains unselected pending ordinary integration in the next coherent release.

Alpha 1.79.71 CI 39024004286 reports 450 clean hosted browser passes, 13 skips and
one flaky 1280 keyboard-remapping case. Its first attempt expected one hotbar cast
after Settings closed, but received none; the automatic retry passed. The original
job log and result remain retained. Green workflow status is not 451 clean passes.
The count assertion rejected acceptance before writing any frozen inventory or
changing release documentation. No unchanged CI job or gameplay was replayed.

A hidden native button/select can retain DOM focus until the next browser layout.
InputManager correctly reserves such controls' keys, so closing a modal without
releasing its focus can suppress the next gameplay key. This mechanism reproduces
the same empty-cast failure, although the original CI log alone does not uniquely
identify its active element. Twelve deterministic same-task cases fail before the
repair across direct/backdrop/switch/toggle/managed/all exits; a thirteenth case
protects focus in a different visible control.

Closing these windows now blurs only their own focused descendant before hiding.
Native controls retain input while open; remapped hotbar input resumes immediately
after closure, and the old numeric binding stays inert. Existing password/recovery
clearing, backdrop and sound paths remain. All 54 focused cases / three suites pass,
including existing keyboard and credential-lifetime checks; scoped lint passes.

The original unchanged desktop 1280 / phone-width 390 keyboard-remapping browser cases
pass once in 7.8 seconds using system Chrome, workers 1 / retries 0. No waits, relaxed assertions,
test renaming or account mutations. Viewports are not physical-phone evidence.
This targeted proof repairs the input finding; it does not turn the earlier
flaky attempt into a clean pass or establish final interface/device acceptance.

Private evidence: `/home/aeml/.local/share/eidolon-modal-focus-review-20261017/.qa-modal-focus`.
Frozen 13-file inventory SHA-256: `2b1f6d447377b19f73c5084190ae6ea9ee1bffc31ccce4d4ebdedfa6a9eadb49`. Mutable continuation and
execution stdout are excluded. Never rerun the processor or mutate listed files.
Full original world/game/art/performance/device/operations/owner/beta/1.99/handoff
goal remains active. Human campaign/phone feedback and soak/stress remain deferred.
