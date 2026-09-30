# Alpha 1.45 — interface consistency candidate

Unreleased integrated candidate on the prepared1.44 branch. Runtime/package/
login/CI/default build identities and cumulative notes identify1.45.0.
Ordered predecessor publication and this candidate's own CI/live checks remain
required. This is not final modern-art, accessibility or closed-beta acceptance.

## Accepted predecessor and publication readiness — September30

The first1.45 CI36676816343/46eb5038 had one terminal Jest failure:
EarnedInventoryRoute still expected the old bag-grid nth right-click. The
ordinary earned-stash route now uses the visible desktop storage row's real
inventory source/slot index and right-click handler. Correct only that stale
source-contract assertion; retain all capacity, item conservation, Gold,
equipment, quest and no-grant checks. Production controls are unchanged.
Four stash/earned-inventory/version suites360checks pass8.906s, scoped lint
and whitespace pass. This correction still requires its own exact-head CI;
the failed head is not accepted or deployed.

1.44 exactb24eda6d is independently accepted after CI36673117387attempt1/all
ten jobs and public frontend/backend/document/eight stamped modules/font
verification. [Receipt](2026-09-30-release1-44-acceptance.md). This candidate
already merges current143fixes and144 audio/FriendToast correction, preserving
all1.45 identities and cumulative patch history. Three version/publishing/
FriendToast suites335checks pass3.348s; whitespace passes. Existing unchanged
UI rendering, auction and focused integration evidence below is reused, not
replayed as a new campaign soak. Standard exact-head CI/live QA still applies;
freshfetch/merge immediately before publication preserves concurrent website
work. No1.45 live acceptance from a predecessor's success.

## Current predecessor integration — September30

Merged prepared1.44a10a8b72, including current1.43prerequisites and typed
impact audio, into this candidate. Resolve README conflict to1.45 source and
accepted1.42baseline (1.43 final live QA still pending). Browser-script conflict
retains BOTH first-party font coverage and all five1.45 interface suites; no
gate or future UI feature is dropped. Runtime/package/history remain1.45 and
website files are identical to the predecessor. Network dispatch merge contains
only the confirmed-impact helper change, preserving1.45 loot/UI updates.

Four integration profile/dispatch/font/version suites pass401checks4.853s;
full lint and whitespace pass. The initial auction-suite name did not exist
and matched no tests; the actual TradingSelection suite was then explicitly
run by path:18checks1.954s, including offline/slow retry, managed closure,
selection safety and server null-list responses. Do not count a nonexistent
suite as evidence. Existing unchanged UI browser evidence remains applicable;
no campaign/phone soak repeated for this prerequisite merge. This candidate
stays unpublished until1.43 and1.44 are individually accepted in order.

## Draft patch notes

- Ground loot has zoom-readable, rarity-accented labels that separate crowded
  drops and leave room around the player. Clicking a label selects that drop
  without shuffling nearby labels; living enemies retain targeting priority.
  Pickup range, capacity and server confirmation are unchanged.
  See [loot presentation checks](2026-09-29-loot-label-presentation.md).

- Desktop storage shows Bag and Stash together, with named items, search,
  category filters, capacity counts and independently scrolling lists.
  Click to inspect or right-click to transfer; refreshed items preserve focus
  and reading position. Phone storage stays unchanged.
  See [stash presentation checks](2026-09-29-desktop-stash-presentation.md).

- Forge lists show item names beside upgrade previews on wide desktops.
  Capped items retain useful stats and clear maximum-reached feedback;
  phone item rows fit wrapped names, and actions use the game styling.
  See [Forge presentation checks](2026-09-29-forge-presentation.md).

- Character sheets show equipment beside build stats on wide desktops, with
  clearer vitals and signed attribute differences. Live stat updates preserve
  upgrade-button focus; phone progression controls are larger. EP/wardrobe
  panels follow the main build. See [character-sheet checks](2026-09-29-character-sheet-presentation.md).

- Journal section buttons separate Story and Contracts without losing your
  tracking choices. Clearer contract cards put ready turn-ins first and use
  readable progress counts. Progress updates preserve the desktop tracker's
  scroll position. See [journal checks](2026-09-29-journal-navigation.md).

- Item set counts and comparisons exclude inactive legacy gear, while keeping
  those items recoverable. Special effects use their display names. Integrated
  UI checks now join the existing hosted CI stage; heavier visual references
  stay opt-in. See [integration evidence](2026-09-29-presentation-ci-integration.md).

- Town minimap names avoid one another and service icons, prioritizing ready
  quests and nearby services. All service icons stay in place; phone radar
  retains icons without tiny labels. A stronger backdrop improves contrast.
  See [map readability checks](2026-09-29-minimap-service-labels.md).

- Desktop right-click inspection adds a scrollable item panel, aligned stats
  and side-by-side comparison; keyboard users can use Shift+F10 on a bag slot.
  Existing equip/sell/stash shortcuts remain. Open item details refresh
  upgrades without losing reading position or focus. Phone stat rows share
  the clearer layout. See [inspection checks](2026-09-29-desktop-item-inspection.md).

- Wide-screen desktop combat HUD groups health, mana, the primary ability and
  four numbered skill slots in a compact central dock. Existing bindings,
  cooldowns and gameplay remain unchanged.
- The primary icon identifies its right-mouse binding; HP/MP labels and numerical
  values remain visible together.
- Desktop chat stays available and resizable without covering the dock; menu
  buttons wrap beside it. Phone and narrow desktop layouts remain unchanged.

See [connected desktop review and checks](2026-09-29-desktop-combat-dock.md).

## Integrated review and verification

Nine scoped UI commits merge onto prepared1.44 in their dependency order,
throughbf0fb3df. Source matches the assembled048aec6e reference, apart from a
harmless rigid-batch whitespace line and the additional read-state fix below.
Retained the newer ordinary desktop town-to-earned-kill fixture, rather than
regressing it to prepared waypoints. Browser-stage lists preserve each actual
earlier/new test file once. Website content remains equalad22dea7.

Reviewed journal/navigation and tracking, item details and live comparisons,
stash independent scroll/focus, Forge quote/refresh/caps, character stats,
minimap and loot interaction priority. Nine existing suites pass67checks
in12.769s. Five hardware-Chrome checks pass37.0s: the combat dock across four
viewports,1024px item inspection/storage,900px and390px character sheets, and
390px Forge refresh/caps. Captures in/tmp/eidolon-1-45-integrated-ui-0930
were inspected. Fixtures validate UI presentation and callbacks, not earned
inventory, real-player comfort or final character art.

The review found that opening Trading House sent the same search twice and
auction reads had no pending/failure feedback. Opening now sends one query.
Browse and My Auctions expose polite loading/retry status while retaining old
rows until the server replies. An unsent/thrown read ends immediately; an
unanswered read ends after10seconds with explicit retry instructions. No
automatic retry or transaction is introduced. Closing through the window
manager also clears timers/selection. A server null auction list now clears
the old display as genuinely empty. Wire message names, economic actions and
server authority are unchanged.

Four focused suites (TradingSelection,NetworkManager,UIBindings,MenuPolish)
pass141checks in4.981s, including offline/throw/timeout/retry, synchronous
reply, null-list dispatch and managed-close cleanup. Existing menu checks cover
Escape, shared chrome, interaction guidance and responsive controls.
Four additional Chrome checks pass21.7s: desktop/390px auction loading→empty→
offline→keyboard retry, plus crowded journals with12contracts, ready-first
ordering and stable tracking/focus. Evidence:/tmp/eidolon-1-45-auction-journal-
0930. Failure rendering never sends bids, purchases or listings. The prepared
listing safety checks still reject replaced items and send the exact explicitly
reselected item only once.

Runtime/login/history/build labels are synchronized; cumulative entries remain
intact. Full lint, raw release identity/history/script-file checks, shell syntax
and whitespace pass;312version/history checks pass1.892s. The auction and
crowded-journal captures were inspected. Standard CI remains required before
live acceptance. Preserve fresh remote website changes at each ordered push.

Remaining integrated quality work:1.46 accessibility/remapping/scale and known
limits,1.47 actual-device interruption feedback,1.48 performance (including
High woodland),1.49 resource/session ownership and1.50 coherent social/casino
transitions. Owner playtest and supplied actor assets remain deferred, not
permission blockers for independent code. These scoped checks do not claim
every game screen, final art, human combat enjoyment or beta qualification.
