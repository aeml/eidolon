# Alpha 1.21 — early-journey evidence, not guessed pacing

Local implementation is in progress.1.19 is accepted live;1.20 is pushed at
dddbf01f/CI36452639581 and awaiting its own acceptance. Do not publish these milestones
out of order. The roadmap calls for actual first-hour/level30 evidence against
the owner's2–3-hour target, separating combat, recovery, getting lost, grouping,
idle/offline time and outside assistance. Existing forecasts, prepared characters
and synthetic clocks do not meet that evidence requirement.

## Retained starting point

- `QuestUI.js` prioritizes ready manual turn-ins over generic town recovery and
  retains explicit recall/respawn orientation for early players. Auto-start story
  remains concrete guidance; no forced daily quest or reward change is needed.
-1.15 Help/class selection explains class primary stats, Ilyra, skill training,
  town recovery, optional lore and level30 Verdant entry.1.17 Dungeon Guide links
  party preparation and actual recruitment without auto-posting or bypassing gates.
-1.14 report submission is acknowledged after persistence, with bounded text,
  build/area and separately opted-in diagnostics.1.19 adds private admin review.
  No raw input/chat/account/inventory/session recording is authorized by this path.
- The owner assigned uninterrupted campaign/pacing measurement to playtesting.
  Do not run another automated campaign or tune XP to fit a bot duration.

## Approved measurement choice

Owner explicitly approved: “Yes—optional, local-only until I share it.” The
implementation below follows that choice; no server telemetry or automatic
submission is implemented. Actual pacing observations are still outstanding.
If using a timer: default off, clear start/stop/delete, no background uploads or
identity/chat capture. Explicit activity/assistance labels should remain
self-reported rather than pretending that movement proves a player is not lost.
Hidden/disconnected/suspended time must not inflate active play. A saved summary
needs preview and explicit sharing through the existing report form; it must not
silently consume optional-diagnostics consent or overwrite an existing draft.

Actual first-session evidence should record start/end levels, active versus
idle/offline time, assistance, principal friction and the level30 milestone.
Compare like-for-like samples before changing quests/XP. Preserve character
continuity; use user/cohort play, not a production wipe or invented fresh account.

## Local opt-in implementation — excluded from1.20

`PlaytestSession.js` holds only aggregate durations, initial/latest levels and
the first observed level30 crossing. Activity/assistance labels are explicit
player choices. Hidden, disconnected,60-second input inactivity and suspended
gaps are separate; gaps over5seconds become unobserved, not guessed activity.
Sessions are capped at8hours and cleared on page/character teardown. No storage,
network, name, raw input, position, chat or inventory access in the model.

`PlaytestSessionUI.js` adds a collapsed Help section with Start/Stop/Clear,
activity/assistance controls, visible summary and explicit append-to-report action.
It never submits, does not overwrite draft text, and refuses a busy or oversized
draft. Standard report preview/consent/persistence acknowledgement remains intact.
UIManager constructs it; UIBindings supplies only connection/level; engine cleanup
disposes it. All these files stay out of1.20 staging/publication.

Nine new model/UI cases and existing MenuPolish/UIBindings:85 tests passed5.631s.
Three real-Chrome views passed22.4s (1280×800,390×844,844×390), showing default-off,
explicit labels/start/stop, bounded visible controls, reviewable draft append and
zero report sends from that action. Artifacts: `/tmp/eidolon-121-local-timer/`.
These are deterministic functionality checks, not human progression measurements.
Root inspected the portrait summary: text wraps, controls remain reachable and
the Close footer is fully visible. Final connection/privacy/model checks:15 passed
1.14s. Copy now explains that submitted reports use normal account/retention
rules and clearing the timer leaves explicitly appended draft copies alone.
The new browser spec is now included in the local interface CI stage. Local
policy/docs/notes/version are synchronized at1.21. Remaining: predecessor
acceptance, publication checks and actual user/cohort observations. No measured
2–3-hour claim or balance change follows from these tests.

## Acceptance boundary

Local instrumentation can be implemented/tested independently, but human timing
and the biggest demonstrated friction remain unproven without a real record.
Keep that dependency explicit; do not mark1.21 complete merely because a timer
or unit test passes. Continue safe prerequisite/source review meanwhile.
