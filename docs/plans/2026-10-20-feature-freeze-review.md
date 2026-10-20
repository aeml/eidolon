# 1.80 feature-freeze review — October 20, 2026

Status: **F1–F5 feature freeze accepted and deployed as Alpha 1.80.0**.
Source `805e7219ce1d1595184ee030a115bdcb0ea00134` passes original CI 39356611063, all ten jobs,
both deployments/live QA and exact artifact/public verification. The owner
confirmed the operating baseline. [Release acceptance](2026-10-20-release1-80-0-acceptance.md) records the exact
evidence and limits; P01–P13 remain mandatory and beta has not opened.

This review supersedes stale pending implementation/deployment labels in earlier
freeze preparation, not the original requirements or historical failed results.
It separates missing foundations from the work already scheduled after freeze.
See the [promise register](2026-09-28-1-11-gap-register.md),
[full remaining work](2026-10-09-release-readiness-remaining.md),
[roadmap F checklist](2026-09-28-alpha1-11-to1-99-release-roadmap.md#f--feature-freeze-at-180)
and [confirmed operating baseline](2026-10-20-freeze-operating-proposal.md).

## Baseline reviewed before promotion

- Owned master at review: `72d1a98765a58cb787186daa3f2e7f27fb09ef28`.
- Accepted runtime: `4bfafdd62b81db2dd0037b33bf6947da8e811351`,
  Alpha 1.79.86, original CI 39301167062/attempt 1/all ten jobs successful.
- At the initial review, the master follow-up changed documentation only and
  client/server/build inputs matched that accepted source. Its existing 823 client suites /
  12,833 checks, 566 hosted, 184 native and 11 live passes retain their stated scopes;
  14/2/1 existing exclusions remain exclusions, not passes. There is no new claim
  of complete human campaign, physical-device, performance or capacity acceptance.
- Read-only generated-content verification passes all 17 groups on October 20,
  using supported Node 24 and two low-priority CPU cores while all five workflow
  status queries are empty. It regenerates nothing and changes no source/assets.
- All 85 retained promise IDs are reconciled below, including ten October 18–19
  additions missing from the former 75 row inventory. All 153 source/regression
  anchor paths exist. A path's existence establishes traceability, not correctness.
- Fresh normal-TLS frontend/backend identity checks match accepted 86 and a ready
  database; registration remains open and terrain remains `flat-v1`.
- The separate historical talent-consumer overlay passes unchanged on the
  baseline (Go 1.27.2/game package 1.158s), resolving the README's stale present-
  tense failure claim without changing skills, probes or assertions.
- The first 1.80 candidate changed release identity, cumulative notes and freeze/
  audit documentation. The corrected candidate also enforces the existing public
  monitor deadline after body reads, with six EOF-boundary regression cases.
  Its own release checks/CI/deployment remain mandatory;
  baseline functional evidence does not substitute for promotion qualification.
- No soak/stress, repeated full campaign, local GPU run, new dependencies, model
  replacement, production-data mutation or repository-setting change occurs.

## F1–F5 review and retained qualification conditions

| Gate | Accepted result | Retained limits and follow-up obligations |
| --- | --- | --- |
| F1: mandatory feature reconciliation | Accepted. All 85 promises and the 69 pre-freeze roadmap milestones have current foundation/remaining-work assignments. No newly identified absent core gameplay system; the separate historical talent probe passes. | Keep the reviewed feature set frozen. P01–P13 retain all mandatory quality/duration/operational work and the already scheduled raised-terrain delivery; none is a waived promise or beta acceptance. Any actual missing foundation still blocks release. |
| F2: threats and authority boundaries | Reviewed. Twelve current-source boundaries include invitations, garments, quest rewards/casts, roofs/melee, casino privacy/value and delivery guards; existing CI/race/socket scopes and failures remain. | Preserve the named 1.82 trust/repository policy and final threat review. No known critical authorization, dupe or save-loss defect may be dismissed as polish. No penetration certification is claimed. |
| F3: population, service budget, alerts | Owner confirmed the existing server/Postmark, no additional recurring spend, up to 100 invitees without a 100-concurrent promise, best-effort incidents and no uptime/response guarantee. Alert recipients/settings remain approved. | Keep actual concurrency/headroom unqualified until the deferred near-completion workload passes. Original named successes/failures and shared-host constraints remain explicit. |
| F4: privacy, administration and recovery owners | Owner and existing authorized admins now own support, moderation, incidents, account recovery and retention coordination. Existing manual privacy paths/settings and disabled erasure remain. | Detailed recovery objectives/off-machine destination and exercises remain assigned 1.81 work. Owner confirmation is not evidence of a rehearsed restore or staffed beta coverage. |
| F5: content/dependency baseline and exceptions | Accepted baseline locked to the reviewed feature/catalog set and unchanged dependency graph. Changes are release identity, cumulative notes/documentation and the scoped F2/P09 public-monitor deadline correction. Existing licenses/notices remain. | Source `805e7219ce1d1595184ee030a115bdcb0ea00134` is accepted by the linked own-run CI/deployment/public evidence. P01–P13 and the exception policy govern later changes; unsubstantiated rights/source inputs remain flagged 1.86/1.90 work. |

The owner answered both concrete questions: "Use this baseline; existing admins
and I own support/operations" and "No known issues; flag anything your audit
cannot substantiate." See the [confirmed operating baseline](2026-10-20-freeze-operating-proposal.md).
There is no remaining operating-responsibility question for this freeze.
No beta activation, extra spending, private-data transfer, repository setting or
new license grant follows from those answers. Original recovery, capacity,
rights and beta obligations remain scheduled and unaccepted until qualified.

## Connected feature foundations reviewed

The 85 owner-promise rows are not the entire roadmap. The 69 numbered milestones
from 1.11 through 1.79 were also reconciled by their delivery bands:

| Roadmap band | Foundation checked | Remaining work retained below |
| --- | --- | --- |
| 1.11–1.20 | Onboarding, account continuity, reports, physical portal, shared locations, world population and atlas | P01, P02, P04, P05, P09, P11, P13 |
| 1.21–1.30 | Voluntary progression feedback, four regional journeys, raids/Vigils, Dark Realm/Nexus/finale and campaign editing | P01, P06, P07 |
| 1.31–1.40 | Twelve class kits, enemy fairness, item/drop/crafting/trade/Resonance and party progression | P03, P06, P07 |
| 1.41–1.50 | Character/world/VFX/audio, shared interfaces, accessibility, phones, performance and resource lifetime | P01–P05, P07 |
| 1.51–1.60 | Community/guilds/recruitment, duels/arena/seasons, rotating events, endgame and moderation | P06, P07, P11 |
| 1.61–1.70 | Five casino games, wallets, cosmetics/VIP lifecycle, voluntary stop controls and commercial boundaries | P02, P05, P07, P11, P12 |
| 1.71–1.79 | Account/protocol security, valuable operations, administration/privacy, persistence, network/monitoring and capacity | P07–P11 |

These are coverage and remaining-work assignments, not 69 accepted milestones.
Original exit evidence and all inherited art/world/kit contracts remain required.

| Foundation | Current implementation / retained evidence | Remaining boundary |
| --- | --- | --- |
| Main story and earned tasks | Server Chronicle catalog, manual quest conversation save barrier, investigations/hunts/expeditions, personal rewards, tracker and earned lore/current-task links; `chronicle_test.go` includes ordered catalog advancement and manual turn-in. Accepted 77/80/81/83/86 retain the current UI/reward/cast corrections. | A prepared ordered-catalog test is not an earned 112-hour campaign or human pacing/finale review. |
| Classes and equipment | Four supplied rigs/motion banks, class/slot restrictions and dual cadence; twelve specialization kits, 52 learned skills/156 rune choices; level 10 guidance hides after confirmed selection. Accepted 51/80/83 and current 86 cover their named scopes. | Human solo/group/boss feel, audio, balance, full fitted catalog and actual-device review. |
| Items, crafting and value custody | Equipment drops, forge/socket/potency/respec, marketplace/trade/guild bank, saved operation identity/journals and replay/recovery paths. Quest offers are server-rolled/saved, six choices every two story chapters, green 55%/blue 35%/orange 10%, single claim after save. | Final candidate cross-feature/returning-save and earned economy/balance review. No reward inflation or grant-based pacing proof. |
| Parties, instances and finale | Personal gates, dungeon-before-raid sequence, four elemental raids/three-wave Vigils, resonance portal, level 100 Dark Realm/Nexus/four-phase finale, checkpoint return and 15-minute logout expiry. Current server CI includes actual room/boss/weekly reward crash/recovery paths. | Human role/timing/cohort findings and final source compatibility. No assumption that prepared characters establish campaign pacing. |
| World, atlas and traversal | Stable location/population registries and shared projections, 32 elemental points/eight optional readings, town residents/homes, map guidance, nineteen authoritative roofs, object-only three-second casts, three-second cancellable recall, contact-range admission/impact and height-aware jump camera. | Modern all-family composition/fit/readability; raised-Earth production delivery and original performance/device budgets. Existing Wizard/Rogue ranged basics are preserved. |
| Cosmetics and garments | Eighteen designs/108 GLBs, all four body fits/High–Low, full-body replacement with independent legal hands, saved unlocks/restore/local/remote sessions, three centered portrait slots. | Final collection art/grip/motion/rights/device review; no new dodge mechanic inferred from old checklist wording. |
| Social, PvP and events | Party/guild/chat/recruiting/calendar/report paths, duel/arena/lobby/season/event and long-term reward systems exist; current server CI includes actual consent/replacement, guild-bank recovery and event paths. | Cadence, sparse-population and real-cohort integration/balance findings. |
| Audio | `AudioManager`, `WorldAmbience`, danger prioritization, local contact/action cues and accepted83 grounded footsteps are implemented. Combat/interface/ambience controls and mute remain; procedural signals do not require nonexistent downloaded sound files. | Human listening, action/impact distinction, positional clarity and busy-group mix remain P03. Do not describe the older unselected footstep assembly as the current delivery state. |
| Accessibility and device settings | Keyboard remapping, UI/text scaling, non-color cues, reduced motion/effects, account/menu focus, phone settings/input and graphics-unavailable recovery have source and retained interface coverage. The [device matrix](../art/2026-09-28-beta-device-matrix.md) distinguishes actual Linux rendering, emulated layouts, owner phone feedback and other uncertified platforms. | Final supported-device/accessibility review stays P05. Existing phone deferral and limited Firefox interface evidence are not a general renderer certification. |
| Session/resource ownership | Scene/actor/appearance caches, owned UI events, reconnect/session fencing, transient-effect and casino-floor cleanup have current lifetime and native coverage. | Fix actual final-candidate leaks/regressions under P04/P07; no indefinite soak or universal memory claim. |
| Casino | All five games and two 46-station floors, shared seat/timer/round authority, saved settlement and separate Gold/EP wallets. Accepted 86 delivers the large draggable windows, Rules popups, baccarat reveal/scores/history, staged roulette and visible net results. Owner says current presentation looks much better. | Preserve wallet/privacy/authority and final actual-device/cohort behavior. No further casino redesign or payment feature is implied by an old open-quality label. |
| Accounts, persistence and operations | Email ownership recovery, durable roles/audits/reports, compatible journals/schema preflight, backup/restore/transfer tools, deployment pinning and installed local monitoring exist. Invitation admission is qualified but inactive. | Final exact-schema restore/rollback, off-machine coverage, owner staffing/settings, rights/notices and candidate approval; tools are not proof of staffed operations or whole-host recovery. |

## Current threats and remaining risks

The initial source review used accepted 86 evidence for unchanged runtime. The
scoped monitor correction now has its own complete accepted pipeline in the
[1.80 receipt](2026-10-20-release1-80-0-acceptance.md). Named suites retain their limits; no blanket security,
fault-injection or anti-cheat certification is claimed.

| Boundary | Current control / checked regression anchor | Explicit limit / scheduled action |
| --- | --- | --- |
| Origins and malformed/large transport input | `server/main.go` accepts one valid origin tuple; `origin_migration_test.go`, admission/frame/protocol guards and deadlines. | Native clients may forge/omit Origin; credentials/session authority still required. Host/proxy/DDoS coverage is separate. Old X01 local-only label is superseded by accepted delivery. |
| Account ownership, resume and emailed recovery | Credential work limits, current connection/account rechecks, single-use resume/recovery tokens and persisted reset/invalidation; actual-session CI routes. | Bearer-link/provider/privileged-host compromise remains a threat; preserve approved retention/settings. |
| Invitation admission | `internal/registrationinvites/policy.go`, pre-storage check in `client_dispatch.go`, exact-name roster/HMAC/expiry and persistent deployment guard; actual replay/startup/recovery CI cases. | New-account admission only, inactive/open in production. No grant of login/admin/QA/EP authority; no beta activation here. |
| Quest reward and item claims | `quest_conversation_handlers.go` checks bound character/current save, fixes offers before claim, persists exact bag/receipt before publish, rechecks connection. BSON/lost-ack and actual turn-in/reconnect/single-claim coverage exist. | Full bags retain choices; no client rolls or replay awards. Final economy/pacing review remains. |
| Cast, movement, roof and melee authority | `stationary_cast.go` owns action generation/deadline/location/session, rejects incompatible state; authoritative roof support and shared body-radius admission/impact/occlusion. Actual socket/cold-recovery cases exist. | Cosmetic UI cannot complete a cast. Future terrain/profile changes must requalify movement/saves. Preserve ranged class basics. |
| Garment/EP isolation | Vendor access/cost/current-save guards; saved unlocks/appearance projection preserve actual gear, class legality and stats. Actual returning wardrobe sessions and EP-isolation tests exist. | Final fitted art and rights remain; no empty-hand weapon, stat bonus or EP-to-Gold path. |
| Casino privacy and value | Server seat/round/session eligibility, immutable saved wagers/settlement and wallet receipts; baccarat future cards/results redacted until their reveal; prior-owner stake identity preserved. House/poker/slot actual and persistence CI routes. | No fairness or real-money certification. UI staging cannot choose outcomes or authorize payouts. |
| Private progression and lifecycle ownership | Owner-only fields/redaction/recipient snapshots, retired-session fences and owner-scoped effects/requests/disposal. | Public appearance/combat fields intentionally remain public. Original delivery abort/network findings are retained rather than claimed universally solved. |
| Admin mutations, reports and privacy exports | Durable current-role/session checks, closed operation schema, original audited replay identity, text-only untrusted display and manual bounded privacy workflows. | Compromised privileged operators are outside ordinary role protection. No automatic erasure or invented staffing. |
| Valuable operation crash/recovery | Current character journal/save barrier and immutable transaction plans; accepted 86 actual trade/item/quest/room/boss/weekly/guild-bank recovery checks. | Each fixture proves its named failure modes; final candidate migration/returning-save/restore remains 1.81/1.88 work. |
| Delivery endpoint and artifact trust | Current workflow has trusted public host pin/strict SSH, exact tested commit checkout and repository/ref/event guards; artifact privacy checks inspect encoded report attachments. Accepted 61/83/86 supersede old X02/X10 prepared-only labels. | Fresh read-only GitHub API: master is unprotected, rulesets empty. Owner/repository/runner policy remains 1.82 work; no settings changed. |
| Service availability and host survival | Installed local API/DB monitor, bounded transport/work/queue policies, pre-migration backup and separate CI queues. | Same-host checks do not cover whole-host failure. Capacity failures/shared-host headroom and off-machine backup/alerts remain open. |

## Scheduled work retained after freeze

These are original mandatory commitments, not waived promises or a new wishlist.
They are separated so completed foundations are not repeatedly rebuilt. Any
actual missing foundation or critical progression/save/security/value bug found
in the meantime is a freeze/release blocker and must be fixed at discovery.

| ID | Finite remaining work | Owner / target / acceptance |
| --- | --- | --- |
| P01 | Modern world/atlas composition across town, four realms/borders, all instance families, Dark Realm, casino and PvP; meaningful navigation, interiors, materials/lighting and final location review. | Implementation; final owner visual review before 1.90. Preserve the full world/art contracts and actual HUD/moving equipped-player review. |
| P02 | Final supplied actor/equipment/garment fit, grip, mixed/cosmetic/local/remote and supported-motion review across all classes/qualities. | Implementation; owner visual review before 1.90. Already delivered models remain; fix concrete clipping/readability findings rather than request new bodies or rebuild catalog blindly. |
| P03 | Twelve-kit combat/role feel, final contact/action/danger/ambience audio review and human listening/busy-party mix; essential cues accessible under reduced effects/mute. | Implementation and human playtests before 1.90; retain 52 skills/156 runes, delivered audio integration and legal class rules. Fix concrete findings; API/mixer counters are not listening approval. |
| P04 | Original dynamic/equipped-party frame/scene budgets and compatible raised-Earth production rollout. | Implementation at 1.87; current public `flat-v1` remains until qualified. Retain historical High 33.3–33.4/50–50.1 ms and worse route failures; no lower targets, hidden scenery or rejected experiment selection. |
| P05 | Declared browsers/viewports/accessibility/keyboard/touch/settings and actual physical-phone party/dungeon usability/resource review. | Implementation and owner/cohort before 1.90. Human phone work remains explicitly deferred, not passed or silently removed from support scope. |
| P06 | Earned story/level-band, economy/reward, party/raid/Vigil/finale and sparse-population PvP/event tuning from actual journeys. | Implementation and owner/cohort; preserve existing human campaign deferral. No automated 112-hour replacement or numerical forecast represented as human pacing proof. |
| P07 | Exact final candidate fresh/returning save, journal/value custody, migration/old-client/reconnect and cross-feature compatibility. | Implementation at 1.88 and final candidate; preserve actual accounts/earned receipts and reuse valid unchanged evidence. |
| P08 | Near-completion capacity/transport qualification and shared-host headroom for chosen actual beta admission. | Implementation with owner service scope before 1.90; soak/stress still deferred. Retain failed 41/48 results and elite-map fix shipped 50. Up to 100 invitees is not 100-concurrent acceptance. |
| P09 | Chosen off-machine backup/alert coverage, exact-schema isolated restore/rollback and incident/maintenance exercises. | Owner chooses destination/recovery objectives/coverage; implementation at 1.81–1.83 and final scope. Use disposable exercises, no unapproved private export or destructive live rehearsal. |
| P10 | Repository/workflow/runner policy and final changed-source threat/exploit/exception review. | Implementation and owner at 1.82; current master unprotected/rulesets empty. Preserve strict endpoint pinning/current guards; do not alter administrative settings without the actual policy decision. |
| P11 | Support/moderation/account-recovery/retention coordination, player help/known issues, content-update validation and exact shipped rights/notices review. Retain season/reset/reward/calendar procedure and audience/region decisions before relevant activation. | Implementation and owner at 1.84–1.86 and before 1.90. Existing license choices remain; source-specific unknowns include evidence for the Meshy paid-API pilot, original editable source/LFS availability and transitive/backend notices. No invented sublicense/rights certification. |
| P12 | Free-operation/commercial branch decision and any separately authorized commercial qualification. | Owner at 1.89; current game has no real-money checkout. Do not build commerce, select prices/benefits or expand EP utility without authorization. |
| P13 | Integrate exact candidate, resolve discovered blockers, approve cohort/support and then invitation admission. | Implementation and owner at 1.90. Invitations already coded/qualified/inactive; existing logins/progress stay. 1.91–1.98 are beta findings/stabilization;1.99 is later release/handoff, not a prerequisite to start beta. |

## Freeze rules

F1–F5 is accepted for source `805e7219ce1d1595184ee030a115bdcb0ea00134`. Preserve the reviewed
content/dependency catalog, current issue list and [release receipt](2026-10-20-release1-80-0-acceptance.md). Preserve cumulative notes and synchronized frontend/backend
versions, ordinary master integration and own CI/deployment/public acceptance.
The milestone earned its own complete pipeline and exact public identity;
the accepted 86 pipeline was not used as a substitute.

Bug fixes, balancing, performance, supported-device work and the named P01–P13
commitments continue with proportional source-specific verification. Every
catalog/dependency addition or substantive policy change names its original
requirement or approved exception, affected saves/authority/rendering, checks,
rollback strategy and exact release receipt. New unrelated systems remain out
of the frozen feature set unless explicitly approved and scheduled.

No existing failure, performance limit, required content, human review, supported
device or operational requirement is removed by this review. Rejected/unselected
worktrees stay isolated. A freeze is a feature boundary, not evidence of beta or
launch readiness.

## Pre-promotion catalog and evidence custody

Reviewed catalog: 8,257 tracked runtime/build/check inputs,
602,881,376 Git-blob bytes, anchored at accepted runtime
`4bfafdd62b81db2dd0037b33bf6947da8e811351`.
This is a Git input inventory, not expanded/LFS bytes, a new Pages artifact or
all-public-file revalidation. Source catalog SHA256:
`330cd82a6e4ac3bf34f32cde154752b13ef492b49f76c7970b1b122009123685`.

The exact accepted Pages tar retains its original receipt:
668,774,400 bytes, SHA256
`cdc1504968fc01e2f9435a682d33152753b2edfe5ef385c19a933764ca48ef72`.
The expanded artifact has been retired; no unchanged artifact was rebuilt or
redownloaded solely for this review. Its existing frozen four-receipt inventory
still verifies at SHA256`c28d92bc6a781ea2fc62552c2ab0ad351a81afc53c291438fa189c82913beb1c`.

Fresh public identity/readiness observation: `2026-10-20T01:01:42.433794+00:00`.
Source/regression anchor inventory: 153 files for 85 promises.
Private source/traceability inventories, generated-content log and bounded public
checks are retained under the owned freeze worktree's `.qa-freeze-closeout/`.
They contain no new player mutation, invitation roster, credentials or private
save export. This is the locked input baseline for the candidate. The accepted freeze release
commit and its own qualification are recorded separately after promotion.

| Historical baseline runtime tree | Git tree |
| --- | --- |
| `assets` | `6b421f883e1bbc9ecbff86df83f818da2bea5af9` |
| `src` | `2d42ed11d65081709460f44bdc164a3f36e56cc8` |
| `server` | `a047dc5f00602af00facfcb1d9fb9306dc3e9d9a` |
| `scripts` | `c4a0d0e0a86d365fbeb7d47d9ef61f03e64a793e` |
| `tests` | `ccb54283ae1b262db793b2def79323c5da07e706` |

Catalog/lock/notice anchors (accepted source SHA256; subsequent documentation
reconciliation does not change these deployed inputs):

| File | SHA256 |
| --- | --- |
| `index.html` | `a1daf5b04c07837796bcd190fa75d63c647e302fef0d60c1fad9f21939b8bc8f` |
| `package.json` | `a40e1283284015d3521d44ff7a49a6f27b09c97e93fe9bcf2e65017d2c82a20c` |
| `package-lock.json` | `874584e5cd426e756fae8c0f643adbf01eadc7cb9fce7b7b07ffdc5a6296e615` |
| `server/go.mod` | `6314021dc58c298702409f41a8059b51555fc74fa0ee614e01f36bfc8f5ec2b5` |
| `server/go.sum` | `dad7cba8c91c44943b60403bd33b59f755612f7f65c92bfa14018b6954bc3cbc` |
| `.github/workflows/ci.yml` | `213d576c084b8c1e687ba7f95070f3e1598b58ea714e9abf1211467a4b4f4f47` |
| `LICENSE` | `d8a6cc31abc16b6748c7a21f21611f5a1ec33f67d22ca23d7da1c19b95496bee` |
| `ASSET-LICENSE` | `6322b615b820ad5a0e60acc5237c0e92383c5629114a29c8d0f15c959549b90f` |
| `NOTICE` | `3f72c3777ae794624842f7c653016751cb37ff0299c46fc7f5bbd5692ede41de` |
| `src/assets/assetManifest.js` | `9da2681b9d9293da3e2f3648e93022c3beef31ffb92488ddcaa38242379ce3ce` |
| `src/assets/garments.generated.js` | `630787771058d77cce551a60dde586a672e1c4939e36eb658dbe914cf89e573a` |
| `src/assets/heldGarments.generated.js` | `6b9c53560ebe59a75b71aab5f8c97c405dafd9b4fafb5a428b836b456d28193f` |
| `assets/archetypes/runtime-selection.json` | `701f704bde7d73ad0334167294fbfc0feb05c8b067451fa13db9fa995923e3e5` |
| `assets/equipment/authored/manifest.json` | `4117c60435a68a31699f9aec9553215f6196cb2008cb887a64e8e8c2a6d9fd0f` |
| `assets/equipment/runtime/manifest.json` | `55b7b7bbc27198911f4205af0f1aff85887e21540935cd5c0b05ff9e9cdcbbb1` |
| `assets/archetypes/Fighter/meshy-pilot-manifest.json` | `875c631f60b54e9702fc168cfe1bc7d3b1cdb7826bf6794e0b06e3c251167a5c` |
| `assets/notices/index.html` | `db9882f29e365e98a06943ebc7fe0e4505ff552aca3f9a45cea1e296bb549a7f` |
| `docs/art/CONTENT_PROVENANCE.md` | `c215505a6e5b39a884f8ca9e239b09b0f79421ba0cdd1f390c4171c8e15040c8` |

## All 85 retained promises

Each row was reconciled with the current source and the named regression anchor.
The anchors below identify implementation and retained checks; they are not new
execution or whole-requirement acceptance claims. Current accepted 86 CI covers
the unchanged selected runtime. Remaining scope stays mandatory at its assigned
quality, operational, beta or launch gate.

| ID | Requirement | Implementation / regression anchors | Remaining scope |
| --- | --- | --- | --- |
| Q01 | Wizard-led main story, separate dailies, manual completion and dialogue | `src/ui/QuestUI.js`; `server/internal/game/chronicle_test.go` | Human story review |
| Q02 | Blue daily and gold story availability/turn-in markers; visible NPCs | `src/entities/QuestNPC.js`; `tests/ChronicleWitness.test.js` | Final visual review |
| Q03 | Select tracked quests; tracker stays readable with many accepted quests | `src/ui/QuestUI.js`; `tests/QuestTrackerContinuity.test.js` | Final usability/device review |
| Q04 | All quest items have bag icons; ordinary items can be dropped safely | `src/ui/InventoryUI.js`; `tests/e2e/quest-item-icons.spec.js` | Integrated item/recovery review |
| Q05 | XP/Gold rewards and useful max-level treatment | `server/internal/game/progression.go`; `server/internal/game/quest_rewards_test.go` | Earned balance/pacing |
| Q06 | Dungeons unlock elemental raid roads; all full raids + defended repair events restore crystals | `server/internal/game/elemental_raids.go`; `server/internal/game/chronicle_test.go` | Human group/Vigil review |
| Q07 | Four crystal resonance opens physical Dark Realm portal in town | `src/art/ResonancePortalModel.js`; `server/internal/game/chronicle_test.go` | Final navigation/art review |
| Q08 | Level 100 prerequisite, 8–12-hour Dark Realm lore/dungeon-to-raid arc | `server/internal/game/chronicle_expeditions.go`; `server/internal/game/chronicle_expeditions_test.go` | Human 8–12 h pacing unproven |
| Q09 | Dark King explains plan; four Eidolons assist four phases; geared group takes 5–10 minutes | `server/internal/game/raid_phases.go`; `server/internal/game/raid_phase_integrity_test.go` | Human finale feel/timing unproven |
| Q10 | More investigations/collection/kills with sensible drop rates, not excess rewards | `server/internal/game/chronicle_investigations.go`; `server/internal/game/chronicle_collection_balance_test.go` | Exploration depth/balance review |
| D01 | First boss attackable, later rooms spawn, abilities work and floor/hallway geometry is clean | `server/internal/game/dungeon_runtime.go`; `server/internal/game/dungeon_room_progression_test.go` | Final room/combat review |
| D02 | Leave dungeon to town and return to latest cleared checkpoint | `server/internal/game/dungeon_state.go`; `server/dungeon_resume_scene_test.go` | Final candidate compatibility |
| D03 | Keep 15-minute logout expiry | `server/client_dispatch.go`; `server/admin_operation_integration_test.go` | Preserve expiry/return policy |
| D04 | Party dungeon kill credit; nearby two-screen open-world XP sharing | `server/internal/game/progression.go`; `server/internal/game/party_chronicle_credit_test.go` | Party balance/recovery review |
| D05 | Class-appropriate Uncommon/Rare geared parties for diagnostics; no level stat multiplier | `server/internal/game/qa.go`; `tests/raidPartyFixture.js` | Diagnostics are not earned pacing |
| D06 | Correct guide levels and entry requirements | `server/internal/game/dungeon_progression.go`; `tests/DungeonProgressionRules.test.js` | Final map/usability review |
| F01 | Immediate Forge UI refresh; potency is long-term endgame, moderate in story | `src/ui/ForgeUI.js`; `tests/ForgeLiveRefresh.test.js` | Endgame cost/feel review |
| F02 | Reduced outside regen, town 10% HP/MP each second, 1:1 rested accrual capped at two hours | `server/internal/game/regeneration.go`; `server/internal/game/regeneration_test.go` | Preserve original recovery rules |
| F03 | Rested +10% stats/+25% kill XP, duration consumed only outside, visible aura | `server/internal/game/well_rested.go`; `tests/WellRestedPresentation.test.js` | Final scene/device readability |
| F04 | No persistent glowing respawn cube | `src/core/GameEngineEntitySync.js`; `tests/GameEngineRespawn.test.js` | Final changed-scene review |
| F05 | Air spells/projectiles visible and hitting, including Wizard fireball | `src/core/AbilityController.js`; `server/internal/game/ability_contract_test.go` | Class presentation/audio review |
| F06 | Permanent chat, sensible menu/input priorities | `src/ui/ChatUI.js`; `tests/ChatUI.test.js` | Final shared-input/device review |
| V01 | Modern Diablo/PoE-inspired anatomy, equipment models/fit, menus and movement | `src/art/AuthoredCharacters.js`; `tests/e2e/authored-class-equipment.spec.js` | Full modern-art/fit review |
| V02 | User supplies actor models only; code owns environments/equipment/materials/shaders | `src/world/WorldGenerator.js`; `tests/WorldGeneratorCanonicalGeometry.test.js` | Implementation owns world art; rights inventory |
| V03 | Improve every environment's materials, lighting, textures, foliage and effects | `src/art/ProceduralRealmTerrain.js`; `tests/e2e/world-elevation-preview.spec.js` | Raised production terrain/performance; final art |
| V04 | Actually populate the world with purposeful places and activities | `src/data/worldPopulation.js`; `tests/WorldPopulation.test.js` | Final exploration/composition review |
| V05 | Update world map/minimap to match actual geography, locations and progression | `src/ui/WorldMap.js`; `tests/AtlasNavigation.test.js` | Final atlas/device/geography review |
| V06 | Casino maps match expanded equal-size isolated floors and current games | `src/ui/CasinoMap.js`; `tests/CasinoMap.test.js` | Retain accepted selected-floor mapping |
| V07 | Stash west of casino, Trading House/Forge collisions, no duplicate roofs, clickable labeled casino door | `src/data/townRoofs.generated.js`; `tests/e2e/town-surface-visibility.spec.js` | Final town composition/performance |
| V08 | Named Mara/Hessa/Dain/Selen do not duplicate or route to unrelated service NPCs | `server/internal/game/chronicle_witnesses.go`; `server/internal/game/chronicle_witnesses_test.go` | Final named-actor visual review |
| V09 | Spirit guardians resemble small cherubic angels | `src/entities/SpiritGuardiansEffect.js`; `tests/SpiritGuardiansEffect.test.js` | Final angel anatomy/effect readability |
| V10 | Readable playable mobile UI/camera; real party/dungeon check deferred by user | `src/core/TouchAbilityAim.js`; `tests/e2e/mobile-combat-gameplay.spec.js` | Physical phone party/dungeon deferred |
| C01 | Shared casino zone, clickable entry dialogue, separate full-size floors with guard/stairs | `src/core/CasinoController.js`; `tests/CasinoController.test.js` | Final integrated venue/device review |
| C02 | Per floor: 4 blackjack, 4 Hold’em, 2 roulette, 4 baccarat and 32 slots | `server/internal/game/casino_seats.go`; `server/internal/game/casino_catalog_test.go` | Retain 46 stations/floor |
| C03 | Physical multiplayer seating/camera, blackjack alone or shared dealer, real-player-only poker | `server/casino_house_sessions.go`; `server/casino_house_socket_test.go` | Final multiplayer/cohort findings |
| C04 | Persistent table UI, visible cards, per-second timers between rounds, timed seat release | `src/ui/CasinoTableOrdering.js`; `server/casino_house_presentation_test.go` | Retain timer/seat/disconnect ownership |
| C05 | Blackjack natural 3:2, hand/count display and clear win/payout presentation | `server/internal/game/casino_blackjack.go`; `tests/CasinoRoundPresentation.test.js` | Final rule/settlement findings |
| C06 | Smooth slot reels, wager changes, queued spins, themed bonuses/free spins and escalating win pauses | `src/ui/SlotMachineUI.js`; `server/casino_slot_sessions_test.go` | Final per-machine/phone findings |
| C07 | Stakes capped at 100,000 Gold / 100 EP; wagers return their own currency | `server/casino_gold.go`; `server/casino_house_sessions_test.go` | Retain wallet/stake isolation |
| C08 | 1,000,000 Gold buys 1 EP; no reverse conversion; EP utility cosmetics only | `server/internal/game/cosmetic_vendor.go`; `server/internal/game/ep_cosmetic_value_isolation_test.go` | No EP-to-power or reverse exchange |
| C09 | Admins get VIP access + 100 monthly EP; regular VIP gets 100/month without duplicate grants | `server/internal/game/vip.go`; `server/vip_membership_test.go` | Retain monthly/admin receipts; no commerce |
| C10 | Rich VIP cosmetics/vendor/equipment skins; future premium acquisition without pay-to-win | `src/ui/CosmeticVendorUI.js`; `server/full_outfit_garment_session_integration_test.go` | Final fit/rights review; paid branch unapproved |
| C11 | Smooth full venue without hidden-floor work | `src/core/CasinoController.js`; `tests/CasinoController.test.js` | Representative device/frame qualification |
| S01 | Existing PvP, party/guild/social systems must remain functional | `src/ui/SocialUI.js`; `server/duel_consent_socket_test.go` | Final social/PvP/cohort findings |
| S02 | Realm events and optional long-term endgame direction | `server/internal/game/public_events.go`; `server/public_event_socket_test.go` | Final cadence/sparse-population review |
| O01 | Admin panel including online players/login/activity data | `src/ui/AdminUI.js`; `server/admin_console_socket_test.go` | Staffing/privacy/support ownership |
| O02 | Open-source GitHub link on login | `index.html`; `tests/ComponentNotices.test.js` | Retain source/attribution links |
| O03 | Every milestone/hotfix has patch notes and synchronized login/server version | `index.html`; `tests/VersionPresentation.test.js` | Ongoing synchronized milestone policy |
| O04 | Separate short CI and soak runner queues; systemd-managed runners | `.github/workflows/ci.yml`; `tests/DeploymentCheckout.test.js` | Queue/trust/headroom operating review |
| O05 | New play/server domains; IPv 6 follow-up deferred | `server/main.go`; `tests/NginxPagesRouting.test.js` | Public/address-family/whole-host coverage |
| O06 | Efficient testing; Luna watches deployment and long dungeon/raid jobs | `.github/workflows/ci.yml`; `tests/BrowserSmokePlan.test.js` | No redundant long runs; no agents requested |
| O07 | Roughly 2–3 h to level 30, 100 h to 100, ~112 h total | `server/internal/game/chronicle_hunts.go`; `server/internal/game/chronicle_regional_readiness_audit_test.go` | Human whole-campaign duration unproven |
| O08 | Closed-beta-ready then full-release-ready product, not just feature count | `goal.md`; `docs/plans/2026-09-28-alpha1-11-to1-99-release-roadmap.md` | Full beta/release gates remain; not a foundation checkbox |
| N01 | Every class/specialization has a full useful kit; combos work within one branch | `server/internal/game/ability_dispatch.go`; `server/internal/game/ability_contract_test.go` | Twelve-kit human feel/balance/audio |
| N02 | Use delivered four class bodies, wearable items and motion banks; dual-wield Rogue visibly attacks with both weapons | `src/art/AuthoredWeaponMotions.js`; `tests/e2e/authored-class-equipment.spec.js` | Final fitted catalog/motion review |
| N03 | Wizard cloth; Rogue cloth/leather and non-staff weapons, weapons-only offhand; Fighter/Cleric all armor/weapons; dual Rogue cadence is two-thirds normal | `server/internal/game/equipment_slots.go`; `server/internal/game/class_equipment_test.go` | Retain class/dual cadence and legacy behavior |
| N04 | Armor/weapon types shown in tooltips, red if incompatible with the character | `src/ui/EquipmentComparison.js`; `tests/EquipmentDecisions.test.js` | Final non-color/device readability |
| N05 | Ilyra has a permanent epic wizard outfit rather than an undressed class-body replacement | `src/art/AuthoredIlyra.js`; `tests/AuthoredIlyra.test.js` | Final NPC art/rights review |
| N06 | Forge attributes remain in fixed order during repeated authoritative refreshes | `src/ui/ItemStatOrder.js`; `tests/ForgeStatOrder.test.js` | Retain stable authoritative ordering |
| N07 | Sell All does not hit the ordinary selling limit; action errors stay in-game, not browser alerts | `src/ui/ActionErrorNotice.js`; `server/protocol_policy_test.go` | Retain bounded selling/protected custody |
| N08 | Administration separates test/automation identities from real-player activity and retains history across updates | `server/admin_console_handlers.go`; `server/admin_session_activity_test.go` | Whole-host history/recovery ownership |
| N09 | Stash remains between Forge/quest house; October 10 jump update requires approximately 1.5 seconds total click-to-landing | `src/core/GameEngineMovement.js`; `tests/GameEngineCtrlClickJump.test.js` | Approximate device/latency total; preserve location |
| N10 | Account recovery uses emailed links and configured Postmark, not arbitrary administrator ownership grants | `server/email_recovery.go`; `server/email_recovery_sessions_integration_test.go` | Provider/incident/support policy |
| N11 | Initial privacy exports/removal are administrator-reviewed and reversible; retain existing provider/data settings | `server/internal/database/removal_review.go`; `server/admin_removal_review_test.go` | Existing manual review; retention coordination |
| N12 | Approved ongoing outage alerts use existing admin recipients/self-hosting/Postmark,30 s polls/3 failures/2 recoveries/30 m reminders | `server/cmd/monitor/main.go`; `server/deploy_monitor_test.go` | Whole-host/off-machine public coverage |
| N13 | Takeoff, flight, landing and Well Rested walking aura move smoothly without initial backsteps or jitter | `src/core/GameEngineMovement.js`; `tests/AuthoritativeJump.test.js` | Final real-device motion review |
| N14 | Each quest pays a similar percentage of its content-level XP bar; dungeon quests pay more; single rewards should not burst more than 1–2 levels | `server/internal/game/quest_reward_budget.go`; `server/quest_pacing_persistence_test.go` | Earned late-game pacing remains human work |
| N15 | Opening the world map must not focus search; M should close it until the player selects the input | `src/ui/WorldMap.js`; `tests/AtlasNavigation.test.js` | Preserve explicit input focus/touch behavior |
| N16 | Make town coherent: spread nonservice NPCs, let them walk, replace outer tents with shacks and blend the Earth road transition | `src/art/ProceduralLanternholdArchitecture.js`; `server/internal/game/chronicle_witnesses_test.go` | Final world composition/performance |
| N17 | Completed validated work always merges into master; retire aged branches and keep only master/main active | `AGENTS.md`; `docs/plans/2026-10-11-master-only-branch-consolidation.json` | Ongoing master-only and dirty-tree preservation |
| N18 | Rework abilities, runes and related systems so every specialization is unique, useful and fun | `server/internal/game/wizard_branch_runes.go`; `tests/RuneCatalogParity.test.js` | Human solo/party/boss feel/audio/balance |
| N19 | One armor garment replaces all body gear; independent weapon/offhand looks; distinct VIP models for every held family, four class outfits and eight universal outfits | `src/core/EquipmentAppearance.js`; `server/full_outfit_garment_session_integration_test.go` | Final 18-look/108-model fit/art/rights review |
| N20 | Improve quest tracking, acceptance/turn-in, earned story recall/current task, remembered window positions and coordinated character/bag/store quality | `src/ui/LoreBook.js`; `tests/QuestTrackerContinuity.test.js` | Final usability/story/physical-device review |
| N21 | Center weapon, armor and offhand garment slots in one row below the character portrait | `src/ui/UIManagerCharacter.js`; `tests/e2e/character-sheet-presentation.spec.js` | Retain centered row and input behavior |
| N22 | Roads render behind player names, mob names and auras, including Well Rested | `src/art/ProceduralWorldPaths.js`; `tests/e2e/nameplate-readability.spec.js` | Future raised-surface review |
| N23 | At level 10 explain specialization and open its menu; hide the reminder after a server-confirmed choice and on returning specialized characters | `src/ui/SkillTreeUI.js`; `tests/SpecializationUnlock.test.js` | Final branch feel; reminder behavior delivered |
| N24 | Every couple of story quests offer six random quest-level equipment choices, green minimum and increased blue/orange chances | `server/internal/game/quest_item_rewards.go`; `server/quest_item_rewards_session_integration_test.go` | Earned balance; durable single choice delivered |
| N25 | B town recall requires approximately three stationary seconds; movement cancels it | `server/internal/game/stationary_cast.go`; `server/gameplay_interaction_session_integration_test.go` | Preserve stationary recall/cancellation |
| N26 | Clicking outside a window closes it before world movement; retain remembered positions | `src/ui/UIManagerWindows.js`; `tests/e2e/window-position-memory.spec.js` | Final shared-menu/device usability |
| N27 | Quest objects use three-second casts; NPC quest acceptance/turn-in stays immediate | `server/chronicle_inspection_dispatch.go`; `server/gameplay_interaction_session_integration_test.go` | Object-only casts; immediate NPC conversations |
| N28 | Melee attacks require actual contact range | `server/internal/game/combat_attack.go`; `server/internal/game/player_melee_reach_test.go` | Retain existing ranged basics and impact checks |
| N29 | Players can jump onto town roofs, land, walk and jump down | `server/internal/game/town_roofs.go`; `server/gameplay_roof_snapshot_integration_test.go` | Final terrain/returning-save/device review |
| N30 | Replace the orange Earth boundary with a fence matching town | `src/entities/Fence.js`; `tests/ReplicatedTownFence.test.js` | Retain boundary and overlay ordering |
| N31 | Fix camera shake when jumping between surfaces of different heights | `src/core/GameEngineRuntime.js`; `tests/GameEngineHudUpdateThrottle.test.js` | Final device motion review |
| N32 | Polish all five casino games: sequential baccarat cards/scores/history, staged roulette ball/wheel, exciting readable feedback, contained Rules popups and large movable remembered windows | `src/ui/CasinoWindowLayout.js`; `tests/e2e/casino-window-layout.spec.js` | Positive owner UI feedback; remaining integration/device/policy review |
