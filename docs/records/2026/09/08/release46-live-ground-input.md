# Release46 final live-QA ground-input correction

CI34226360903 on6e556c4 deployed both services successfully, with matching
public release.json, ready healthz, login version and main.js query identity.
Final live QA failed7PASS/1FAIL in4.6m: both Verdant attempts had no clear
ground-input target (attempts[], maximumDisplacement0), while alive. The retry
had actually damaged RootboundWarden15000→6444 before the helper threw.
Failure log `/tmp/eidolon-release46-final-live-failure.log`.

af8f88a changes only test input handling. It distinguishes no issued input
from a click/key that failed to move. Only the former returns to ordinary
combat and records blockedRetreats; the latter still throws. Combat deadlines,
death bounds, successful movement receipts, rewards and resources are unchanged.
The game/server/runtime/version and46 patch notes are unchanged.

89719 focused45tests/0.948s and lint/diff passed. Actual97726 on cleanaf8f88a
passed1/4.3m, explicit QA_SCRIPT_EXIT=0 and normal exit0. Generated Verdant
seed-4899557939214400244, version2, normal level30, prepared Wizard100. Both
15000/16800HP bosses died through ordinary combat; later mobs/cleared-room,
gold and town-return assertions passed. Last Matron sample2408HP/484mana;
no combat refill, reconnect or changed preparation was added. Scan0 and
independent absence of release46-live-ground containers passed.
Log `/tmp/eidolon-release46-live-ground-gameplay.log`.

This is prepared local functional evidence, not full campaign or earned balance
approval. Republish the QA-only46 correction by normal fast-forward, then require
its complete new CI and live gates before47. The future47 branch additionally
removes a browser-side /tests import absent from Pages; that distinct correction
is not imported into this46 patch. Preserve it when carrying ancestry forward.
