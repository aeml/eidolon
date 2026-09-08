# Alpha1.0.52 death resource recovery — pending release

Built on the preserved sequential51 save-bridge release, with only the
dead-only mana recovery fix7440ccd and its focused regression tests added.
The later curve2, expanded campaign and starter encounter candidates are not
included. All package/login/build/deployment/QA identities are52; actual patch
notes preserve51 and all prior history and explain the unchanged0.01 rate.

Death restores both resource bars. Living unstuck and Recall do not refill mana;
PvP and invalid movement-context requests cannot bypass their existing gates.
Cooldowns, progress and owned assets stay intact. No new potion/rest system.
See the component evidence document for focused source tests. Full checks of
this exact package and actual browser recovery remain required before approval.

This is an unreleased candidate behind45–51. Publish sequentially only after
each predecessor passes all normal CI and exact public release checks. A local
version number is not evidence that the version has deployed.

Focused84093 passes233 presentation/resource tests across three suites (2.935s)
and lint. Browser dependency preparation, lint and shell syntax42302 pass.
The new death-resources route uses its own allowlisted fresh Wizard, separate
from dungeon-recovery fixtures. Existing QA places the character near a hostile
at one HP; an ordinary Fireball first spends mana while waypoint protection is
still active. Protection is then disabled, a real hostile hit causes death,
and the normal death button must yield a full-mana server state receipt. A
second ordinary cast followed by Recall must leave mana depleted. This is a
functional fixture, not evidence of earned campaign pacing. The full disposable
predeploy route also includes this check. No browser result is claimed yet.
