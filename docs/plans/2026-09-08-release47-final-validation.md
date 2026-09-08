# Release47 combined candidate validation

The final candidate carries release46's paced training/size-aware prepared
dungeon QA and combines the existing collection pacing, starter encounter,
enemy-impact, basic-cadence, PvP scene and CI shard changes. All prior version
notes remain; login/package/runtime defaults identify Alpha1.0.47. This is a
candidate behind46, not a claim that1.1 or the full roadmap is complete.

90204 actual four-class practice duels on clean8945856 passed4/1.5m with explicit
QA_SCRIPT_EXIT=0. Scene entry, normal attacks, forfeit, departure coordinates
and unchanged ranked/XP/gold rewards were all asserted. Paved court captures
were inspected; details/limits remain in the PvP scene handoff document.

After docs closure,85296ee was fast-forwarded into work/starter-cadence-20260908
at `/tmp/eidolon-starter-cadence-xCyOrR`. Final17075 client passed229suites/
3306tests/128.203s. Full50135 Go race passed root10.867s/database1.025s/
game257.014s and every other package. Both returned terminal exit0; runtime
was frozen for these checks. Existing full lint/targeted version/shard checks
and ordinary four-class collection evidence are retained in companion records.

The original-campaign level17-to30 gap, expanded31-chapter progression and
broader class/gear/reward balance remain open. Duel evidence does not establish
ranked/party/disconnect or physical-phone sign-off. Oversized existing combat
labels also remain in the later visual queue. These are not silently removed
from the1.1–1.10 goal.

Do not publish over active46 CI34226360903. Require its full success and fresh
matching public frontend/backend identity, then publish this47 candidate with
its own complete CI/live gate. Never push root master or an older47 branch.
