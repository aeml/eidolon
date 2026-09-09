# Town recovery release acceptance — Alpha 1.0.58

Status at September 9, 05:55 UTC: **unpublished candidate**, not delivered.
Candidate worktree `/tmp/eidolon-standalone-town-recovery-QJ6Drv`, frozen source
`5a17be147ce527bae556663cc452ecae10e87785`, includes canonical57/cc6e419 ancestry.
Public client/server last independently verified52/a36d1e7 at05:42;53CI is active.
The complete roadmap remains open. Expanded story and coordinated balance are
separate preserved work, not removed or declared complete by this release.

## Supported-toolchain regression and ordinary earned play

Local npm/Playwright uses Node24.18.0 explicitly inside `sg render`; the login
shell's default Node18 is not supported acceptance. Full client57780 passed
245suites/3466tests/187.057s plus lint. Full Go race75384 passed root23.243s and
game327.779s; server/go.mod selects Go1.24.5. Logs:
`/tmp/eidolon-rest58-node24-full-client.log`,
`/tmp/eidolon-rest58-node24-lint.log`,
`/tmp/eidolon-rest58-full-server.log`.

All four ordinary fresh-class routes passed on the frozen source, with no grants,
forced kills, extended encounter deadlines or removed console/network assertions.
The existing eight-seed collection, manual turn-in, saved earned gear and locked
level30 dungeon were checked. The wrappers removed their exact temporary
containers/images; absence was independently verified. Credential scans changed
zero files, and ready-to-claim screenshots were inspected after archival.

| Class / handle | Total test | Collection | Observed target deaths / player deaths | Full-pool town stops | Stop time including travel |
|---|---|---|---|---|---|
| Wizard69597 | 4.7m | 213s | 19 / 0 | 4 | 83.664s |
| Fighter58871 | 6.7m | 289s | 17 / 0 | 4 | 86.038s |
| Rogue34088 | 4.2m | 212s | 23 / 0 | 3 | 63.975s |
| Cleric21402 | 3.7m | 174s | 20 / 0 | 2 | 39.157s |

Observed target deaths are not an exhaustive kill census or a drop-rate estimate.
These routes use current legacy payouts:500XP opening and8000XP collection,
100gold each. Collection still jumps characters to17; that is a known balance
issue for the coordinated successor, not something58 fixes. Rogue reached8 before
the claim; the other three reached7. Each stopped to recover at its actual
class/gear-adjusted ability cost, not a universal Wizard30mana assumption.

Logs and retained screenshots:

- Wizard: `/tmp/eidolon-rest58-wizard-node24-rerun-0528.log`;
  `/tmp/eidolon-rest58-wizard24-proof-c7jLU7/test-results`.
- Fighter: `/tmp/eidolon-rest58-fighter-node24-0535.log`;
  `/tmp/eidolon-rest58-fighter24-proof-h4p5PS/test-results`.
- Rogue: `/tmp/eidolon-rest58-rogue-node24-0545.log`;
  `/tmp/eidolon-rest58-rogue24-proof-mvJ29A/test-results`.
- Cleric: `/tmp/eidolon-rest58-cleric-collection-0515.log`;
  `/tmp/eidolon-rest58-cleric-proof-TKN8ET/test-results`.

## Failures remain part of the evidence

Wizard97055 failed the final console/network assertion with
`net::ERR_NETWORK_CHANGED`; its unchanged repeat69597 passed. The cause is not
proven. A later read-only monitor observed unrelated virtual-network churn, also
during passing play. No unrelated workload was changed and no errors were filtered.
See the execution ledger for original log/archive and the closed monitor.

Native rest32952 terminated143 after a passing natural-expiry test37.3s, before
journey and party completion. Bank14.81542373s expired naturally to0 outside town,
strength11→10 and maxima110→100, icon/aura removed; normal Recall earned1.750368119s
and restored the rested stats/aura. Do not count the whole invocation as passed.
Original log `/tmp/eidolon-rest58-native-node24-0548.log`; credential-scanned
partial screenshots `/tmp/eidolon-rest58-native24-interrupted-SZjDjQ/`.

The wrapper/test processes were absent after terminal143, but an orphan static
server and its exact disposable API/Mongo remained. The web server's candidate
cwd, start time and process ancestry were verified before stopping only248702;
its parent shells exited. The exact run-specific containers, temporary Mongo
volume and image were removed. Port41960, process family and resources were
independently confirmed absent. No production data or CI process was touched.
No matching OOM event was found in the accessible kernel log; termination cause
remains unknown. **81669 unchanged native24 repeat passed**, project
rest58-native24-r1-0552, log
`/tmp/eidolon-rest58-native-node24-rerun-0552.log`: expiry36.3s and journey31.0s
(first CLI2tests/1.1m), actual party24.1s (second CLI1test/25.9s). The wrapper
exited0, credential scan0, and exact owned containers/image are absent.

Natural expiry14.617466611s→0 removed strength11→10, maxima110→100 and icon/aura;
ordinary Recall earned1.617247573s and restored them. The journey registered an
actual42damage Wizard spell hit with30mana spent, then Recall and reconnect:
returned MP94, rejoined MP110 through normal town recovery. Reconnect bank
14.744371348s retained/continued legitimate online town earnings. Two actual
party members moved through the native joystick and rendered19visible parts each
at High,10each at Low, without opaque box geometry.

Both output folders are archived at `/tmp/eidolon-rest58-native24-proof-n1IyTo/`.
Desktop reconnect, portrait390 High status/aura and short landscape568 Low status
were visually inspected. The desktop reconnect capture shows16FPS while other
captures show higher rates under concurrent CI load: this is not sustained
performance approval or proof that the aura caused a slowdown. Physical-device
and sustained gameplay performance remain open roadmap gates.

**57389 complete58 isolated gameplay ACTIVE** on unchanged5a17be1/Node24.18.0,
projectrest58-all24-0909-0554, API18560/Mongo18561/web41960; log
`/tmp/eidolon-rest58-all-node24-0554.log`. No second owned local browser or source
edit while this runs. The complete inherited command chain plus native rest
routes is being exercised, not a shortened subset.

## Remaining delivery gates

- Finish the complete unchanged58 isolated gameplay chain, including all prior
  dungeon/combat/equipment/phone/animation checks and the added native rest routes.
- Publish each preceding53–57 only after its complete CI/deploy/final live QA
  and independent exact client manifest, runtime script and server identities.
- Publish58 through that same gate, with its existing58 login/patch notes.
- Independently verify public58 identities, then use fresh dedicated ordinary
  QA characters against the public client and WebSocket. Verify actual combat
  depletion, normal Recall, full HP/MP recovery, earned/resting buff display,
  outside countdown/expiry and reconnect. Do not use a prepared resource grant
  as proof of live healing; do not use a localhost-only clock predicate remotely.
- Record exact live source, observed values and retained sanitized evidence.
  Only then report town recovery delivered. Keep the larger roadmap active.
