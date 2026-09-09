# Campaign callout semantics — unpublished follow-up

Separate from urgent recovery58. The shared combat callout interpreted a notice's
display lifetime as an attack countdown and labeled it Boss Telegraph/Threat
Warning. That is appropriate for a telegraph, but false for already-applied
Eidolon aid, a completed Vigil or a manually turned-in chapter. Phase4 also used
victory styling while Malachar was still alive, and Neris/Aeral dialogue appeared
under a Dark King sender label.

The candidate gives campaign notices explicit metadata and category labels:
active raid phase/element and Eidolon Aid; live Vigil wave or restored-crystal
return-to-Ilyra instruction; and confirmed manual Chronicle turn-in. All four
active phases use boss styling, not a premature victory. Actual ritual/finale
completion retains victory styling. Dialogue is grouped as Fourfold Covenant,
preserving each speaker's authored text rather than attributing Eidolons to the
Dark King. Ordinary attack telegraphs retain their countdowns/default labels.

Initial78695 regression failed6/73. Three failures established the old category,
phase3 and chapter metadata; three new fixtures also omitted the player required
by the real message handler and therefore were not valid behavioral reproductions.
25966 after the implementation still failed those three incomplete fixtures.
Correcting only fixture player identity gave80664 PASS73tests/2suites/1.22s plus
lint. Logs `/tmp/eidolon-campaign-callout-labels-{before,after,fixed-fixture,lint}.log`.

No timers, authority, rewards, phase damage or phone layout changed. The existing
phone layout hides secondary metadata; phase titles/effects and chat still use
the shared delivery path. These tests prove message and DOM label behavior, not
actual raid pacing, rendered phone readability or a completed campaign release.
Full merged client regression and real-group visual verification remain due.
