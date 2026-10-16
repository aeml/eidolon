# Character garment row qualification

The character equipment screen now places Weapon Garment, Armor Garment and
Offhand Garment in one centered row directly below the character picture.
Each control displays the server-confirmed appearance or Original gear and
opens the matching owned Wardrobe selector. Applying or resetting still requires
the existing explicit action and server authorization. Actual gear, item stats,
independent hand appearances and full-outfit precedence remain unchanged.

The owned candidate is based on accepted Alpha1.79.58. Six focused suites with
66distinct checks pass, covering wardrobe custody/disposal/character switch,
preview, character stats, HUD diffing, private replies and equipment loadouts.
Scoped lint passes. Native Chrome153/GPU review passes at1280/900/390px: order,
center alignment, below-preview placement,44pxminimum controls, no horizontal
overflow, keyboard selector focus, current-look refresh and no automatic apply.
Desktop/tablet/phone captures were visually reviewed. These are emulated viewport
checks, not physical-device or final owner art acceptance.

The same coherent interface candidate improves returning Lore Book task context,
claimed-finale narration and memory focus/scroll.143distinct related focused
checks pass. Initial native run5passed/2failed: new memories reset list scroll to
zero while the parent detached the book. Capturing before detach and restoring
after visible reattachment fixes both original assertions; corrected2pass.
Original failures/traces remain retained. Final combined run is recorded below.

Evidence root:
`/home/aeml/.local/share/eidolon-lore-task-context-20261016/.qa-lore-task-context`.
Soak/stress remains deferred; the full game goal and original remaining gates
remain active. Publication is governed by the next release acceptance record.

Final combined native run: **7passed**, workers1/retries0, on the corrected
source. All seven distinct cases now pass; repeated runs are not additional
coverage.209distinct focused checks across13suites pass. All original failures
and their traces remain retained. Qualified for ordinary master selection.
