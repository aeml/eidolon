# Alpha 1.50 integrated presentation review

September 30, 2026. This is local candidate evidence, not live acceptance or
closed-beta approval. Alpha 1.48 and 1.49 must pass their ordered deployment
gates before this candidate is published. Version metadata, login and cumulative
patch notes are now packaged as Alpha 1.50.0; exact-source CI and independent
public verification remain required.

## Changed integration checks

The prepared route uses the real GameEngine, renderer, UI bindings, actor
equipment, minimap, ambience and scene owners: Lanternhold, an Earth road,
the canonical Verdant first room, party/social UI, both casino floors and town
return. Five level-75 heroes have all 14 visible slots, Uncommon/Rare gear,
class-appropriate weapons, armor and primary statistics. Their displayed roles
are a tank, healer and three damage characters. These are disposable client
fixtures, not earned progression or an authoritative combat simulation.

Desktop 1280×844 and phone-policy 390×844 checks use brightness 65, UI scale
125%, muted audio, reduced motion and disabled camera shake. They require
renderer/UI/generator quality agreement, the expected shadow policy, correct
ambience identity, populated level/hotbar presentation, player batch admission
and hidden outdoor scenery while inside the casino. Low, Medium and High retain
existing exact-radius essential warnings and admit new protocol warnings.

The review exposed a phone roster inconsistency: it displayed class and level
but omitted the authoritative combat role shown on desktop. Phone cards now
show that role, including leader/self labels. Snapshot updates reuse the same
nodes, and missing roles use the same damage default as desktop rather than
guessing a healer or tank from class. Party permissions and mechanics are unchanged.

Ten PhonePartyUI unit checks passed in 0.830 seconds. The final two native
route cases passed in 39.1 seconds. Scoped lint and whitespace checks passed.
The integration fixture joins the mandatory interface selection; discovery
verified all 238 browser cases exactly once, without omissions or duplicates.
After version packaging, five version/browser-plan suites passed 358 checks in
7.686 seconds, with scoped lint and whitespace checks clean.
Screenshots and route reports are under
`/tmp/eidolon-1-50-integrated-roles-final-0930`. These timings describe test
duration, not frame performance. Earlier fixture failures were missing prepared
vendor files, a nonexistent HUD method, missing session bindings and using the
desktop role selector without opening the phone roster; they were corrected
without weakening source assertions or changing player data.

## Retained evidence

Reuse accepted scene reviews and changed-scope checks instead of replaying
unchanged campaigns, encounters or indefinite soaks:

- [Desktop controls and layouts](2026-09-30-release1-43-acceptance.md),
  [desktop menu presentation](2026-09-30-release1-44-acceptance.md),
  [interface finish](2026-09-30-release1-45-acceptance.md),
  [settings and accessibility](2026-09-30-release1-46-acceptance.md) and
  [phone input interruptions](2026-09-30-release1-47-acceptance.md).
- [Performance comparison and unchanged appearance](2026-09-30-release1-48-performance-work.md):
  qualified desktop GPU results, exact source/candidate geometry, distant
  coordinates, scene budgets and separately reported hitches. Live acceptance
  remains required for the corrected candidate.
- [Session ownership](2026-09-30-release1-49-lifetime-work.md): bounded repeat
  transitions, all casino games on both floors, gear/death/reconnect, real
  borrowed transports and teardown. Local evidence is not a universal no-leak claim.

## Remaining limitations

Q is a presentation/support baseline, not proof that Eidolon already matches
the finished art quality of Diablo or Path of Exile. The
[modern ARPG contract](../art/2026-09-28-modern-arpg-closed-beta.md) remains the
final target. Current procedural actors, surfaces and animation still need
artistic evaluation against that target; an owner-supplied Fighter pilot is
explicitly deferred. The historical procedural cutover certifies migration
coverage, not final modern-art approval.

The [device matrix](../art/2026-09-28-beta-device-matrix.md) distinguishes native
Linux Chrome/RADV evidence from desktop phone-policy fixtures. Owner general
phone UI feedback is positive; actual-phone dungeon/party observations remain
deferred. Other GPUs, Firefox, Safari/iOS, controllers, thermal behavior and
100-player capacity are not certified by this route. Reduced motion and muted
audio warning visibility are checked; this is not comprehensive assistive-
technology or accessible real-time-combat certification.

Full casino seating/round ownership is retained from 1.49, not newly exercised
by this walking route. Casino settlement/fairness, authoritative group combat,
earned campaign pacing and final art approval must not be inferred from it.
There are no economy, progression, access-policy, account or privileged
DNS/nginx changes. Keep open-alpha access unchanged.
