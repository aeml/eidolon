# Two-floor town casino — required for Eidolon 1.10

Requested September 9, 2026. Status: **planned, not implemented or deployed**.
This extends the existing full 1.1–1.10 goal; it does not replace earlier work
or interrupt immediate bug fixes. Implement at the stages below, not now.
Parent: [1.1–1.10 roadmap](2026-09-05-v1-1-to-v1-10-roadmap.md).

## Intended experience

Convert the existing building behind the main-town stash into a fully functional
two-floor casino. Players physically enter, walk around, approach a table or
machine, occupy a seat/use position, transition to its gameplay camera and UI,
wager that floor's currency, and return seamlessly to ordinary world play.
Other players visibly occupy multiplayer seats. This is a coherent social world
location, not a collection of minigames launched from a menu.

## Milestone placement and dependencies

| Stage | Required work |
|---|---|
| 1.5 — economy | Model public Gold wagers, payouts, jackpot liabilities and economic impact. Define a currency-independent transaction boundary for future VIP use; do not choose or introduce the VIP currency as part of this planning task. |
| 1.8 — social infrastructure | Implement authoritative seat ownership, visible seated players, table membership, synchronized rounds, join/leave, disconnect/rejoin and interrupted-session recovery. Integrate camera/input ownership with desktop and phone controls. |
| 1.9 — world/location | Reposition the stash/casino, build both walkable floors and their distinct art, and implement/playtest the full games and in-world interactions. Integrate the separate currency system once its design has been approved and implemented. |
| 1.10 — completion | Finish public and VIP content, game rules/payout tuning, visual/audio polish, multiplayer/phone/accessibility and persistence tests, then deploy with accurate patch notes and live verification. Both floors are required, not an optional stretch goal. |

The VIP currency system is an explicit unresolved upstream dependency. Its design
must be resolved with the user during the relevant economy work, early enough
for implementation and integration before final casino acceptance. Until then,
the plan may describe a currency capability/interface, but must not permanently
assign a name, token, exchange rate, purchase method or economic policy. The CP
comparison describes separation from Gold, not a specification to copy CP.
Do not substitute Gold, assume Resonance is this currency, or claim an inaccessible
VIP placeholder completes the second floor.

## Town layout and building

- [ ] Identify and reuse the building currently behind the stash as the casino.
- [ ] Move the stash cleanly between the Trading House and casino; shift the
  casino slightly as needed. Preserve clear approaches, doors, NPC access and
  comfortable walking space rather than cramming the three objects together.
- [ ] Update rendered geometry, authoritative collisions, interaction positions,
  navigation and relevant map markers together. Recheck existing Trading House
  and stash use, including touch input and simultaneous nearby players.
- [ ] Provide a physical public entrance, walkable gaming floor, and navigable
  connection to the second floor. No clipping, trapped spawns or false doors.
- [ ] Make the upstairs VIP lounge visibly more prestigious through architecture,
  materials, lighting, furnishings and ambience while remaining unmistakably
  part of the same casino and Eidolon's world.

## Physical game interaction and multiplayer presence

- [ ] Approach an actual table and select an available seat. The server reserves
  it atomically; the character visibly sits with suitable positioning/animation.
- [ ] Transition smoothly to a table-focused camera and show that game's UI only
  in its appropriate interaction context. Preserve the player's prior gameplay
  camera/preferences and prevent game UI input leaking into world movement or
  combat. Provide clear game rules, stakes and an explicit leave action.
- [ ] Let real players occupy other available seats and visibly participate in
  the same synchronized round. Prevent double seating and cross-table commands.
- [ ] Use the same physical approach/use/camera/UI lifecycle for slot machines,
  including visible occupancy; do not expose slots solely through a remote menu.
- [ ] Leaving restores normal control, camera, HUD and a safe walkable position.
  Specify and communicate how pending wagers finish when leaving mid-round.
- [ ] Handle reconnect, background/resume, server restart and interrupted camera
  transitions without stuck seated characters, stranded funds or duplicate bets.

## First floor — public casino, existing Gold

Use the same regular Gold balance used elsewhere in Eidolon, not a new public
casino token. Show bet cost, available balance and authoritative settlement.

### Slots

- [ ] Deliver full-featured machines with paylines, themed symbols, bonus rounds,
  free spins, jackpots, special mechanics, animations and sounds. A basic random
  payout button or one reskinned machine is not the requested feature.
- [ ] Provide multiple genuinely differentiated machine variants built around
  Eidolon's lore: Earth, Fire, Water and other elemental realms, bosses, creatures,
  locations and characters. Develop the content catalog and each variant's rules
  at implementation time; retain breadth and depth rather than generic symbols.
- [ ] Explain paylines, stakes, payouts, free-spin/bonus rules and jackpots before
  wagering. Keep the selected currency and any further wager unmistakable.
- [ ] Persist in-progress bonus/free-spin entitlements and jackpot settlements;
  reconnect must neither erase earned rounds nor replay already paid outcomes.

### Blackjack

- [ ] Support multiple real seated players against the house/dealer with visible
  turn state, betting, cards, legal actions, rules and settlement.
- [ ] Also allow a single player to play against the dealer when nobody else is
  present. Multiplayer population must not gate ordinary blackjack access.
- [ ] Define complete table rules, action timers and mid-round join/leave behavior
  before implementation; enforce those rules server-side, not only in the UI.

### Poker

- [ ] Deliver player-versus-player tables with visible seats, betting, turn order,
  pot/side-pot accounting, showdown and settlement appropriate to the chosen rules.
- [ ] Require enough real players for the selected poker variant to start. Show
  an understandable waiting state below that minimum; never fill seats with
  house-controlled opponents or silently replace disconnected players with bots.
- [ ] Select and document the poker variant, seat limits, blinds/stakes, timers,
  buy-in/cash-out and disconnect/fold rules during implementation. Preserve private
  cards in server/network state; clients cannot inspect opponents' hidden hands.

## Second floor — VIP casino/lounge, separate future currency

- [ ] Integrate the separately implemented premium/special currency through the
  same authoritative wager/settlement system with strict currency isolation.
  No normal-Gold debit, payout fallback or implied automatic conversion upstairs.
- [ ] Include higher-stakes tables and machines and premium content variations,
  with a more exclusive visual and audio atmosphere than the public floor.
- [ ] Clearly identify the upstairs currency once it is defined, its supported
  stakes and insufficient-funds behavior. Do not invent an access entitlement or
  monetization model in this roadmap; resolve those decisions with currency design.
- [ ] Reserve usable physical space and extensible content/service boundaries for
  future VIP-specific games, rewards, services or mechanics. These future additions
  need not all ship by 1.10, but the specified functioning VIP casino must.

## Quality, integrity and completion evidence

- [ ] Server owns random outcomes, decks, legal moves, bet acceptance and payouts.
  Validate balance, seat/table membership, floor currency and round identity.
  Use appropriate secure randomness and review odds/payout mathematics; cosmetic
  client animations must never decide or alter a result.
- [ ] Debit/reserve and settle wagers durably and exactly once. Exercise duplicate,
  delayed, replayed and conflicting requests, crashes between transaction steps,
  reconnects and simultaneous seat claims. No negative balances or currency mixing.
- [ ] Measure Gold sources/sinks and jackpot exposure against the broader economy;
  retain explicit payout rules and review evidence. Casino income must not silently
  invalidate the requested progression/drop/reward balancing pass.
- [ ] Test complete table/machine sessions with real multiplayer clients, including
  solo blackjack, multiplayer blackjack, poker waiting/starting/playing/leaving,
  occupied-seat rejection, both floor currencies and interrupted-session recovery.
- [ ] Inspect High/Low visuals, seated equipment fit, camera transitions, animation,
  effects and sound. Provide readable touch controls, rules and leave actions on
  portrait/landscape phones, keyboard operation and reduced-motion/audio options.
- [ ] Verify physical-phone play and measured populated-floor performance alongside
  desktop, then regression-test nearby stash/Trading House and ordinary town play.
- [ ] Deploy the implemented content with per-version patch notes and matching
  login/client/server identities. Verify the actual live enter → walk → sit/use →
  play/settle → leave loop and multiplayer presence on both floors using approved
  QA accounts/funds, without manipulating ordinary players' balances.

Completion requires all specified content and the evidence above. Unit tests,
an art gallery, planned currency APIs or a menu prototype alone are insufficient.
