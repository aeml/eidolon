# Explicit desktop party healing

The four-player diagnostic44940 on09f137f0 failed before the first room clear.
All four hotbar preflights passed. The healer's decision record shows it reaching
7.003 units from the Fighter with Healing Light and Guardian Embrace available,
555 mana, the ally loaded and keyboard focus on BODY. All six sampled hitbox
points still selected a Skeleton. The Fighter fell from268HP to45HP and died.
This is direct evidence of cursor-target occlusion, not missing skills, cooldown,
mana, focus or an out-of-range heal. No balance conclusion follows from an
inactive healer. The archive is `/tmp/eidolon-four-role-heal-evidence-proof-rk0iZK`;
wrapper and copied-log scans left zero QA prefixes, and owned services/listeners
were absent after terminal cleanup.

## Player-facing change

Desktop party name/health rows become explicit healing-target buttons. Choose
an ally or yourself, then cast Healing Light or Divine Intervention normally.
The selected row is highlighted; the mode button clears selection and restores
cursor aiming. Offensive skills and normal hostile-pointer priority do not
change. This builds on the existing phone support-target resolver.

An unavailable or out-of-range selected ally produces feedback, not a silent
self-heal, resource spend or automatic chase. Leaving the party, switching
characters or changing groups clears stale selection. Downed selected allies
remain visibly disabled until available or deliberately cleared; they are not
silently replaced with someone else. Live roster updates preserve button
identity and keyboard focus. No server combat, healing, mana or gear changes.

Focused55389 passed138 tests/4suites plus lint, covering desktop/mobile routing,
both support skills, self/clear, dead/missing/departed/hostile/distant targets,
unchanged attack targeting, stable controls/focus and party/character changes.
Earlier focused runs caught a test-double setup error and aliased party-ID
tracking; both were corrected, without weakening the assertions.

The four-player route now clicks the actual roster button and presses the
hotbar key. It retains the healer decision log, ordinary movement, original
equipment/difficulty/deadlines and all clear/reward checks. Pending full client
regression, native roster/cast/render proof, successful four-player clear,
manual turn-in/relogin, release integration, version notes and deployment.

Proposed patch note: Desktop party portraits can now select the recipient of
Healing Light and Divine Intervention, so enemies covering a teammate no longer
intercept a deliberately targeted party heal. Clear the selection to return to
normal cursor aiming.
