# Alpha 1.10.0 — The Resonant Age playtest

User direction: finish the integrated work to the best of our ability, test it,
and deploy 1.10 for playtesting. This record supersedes older *current status*
paragraphs, not their retained test evidence. It does not equate implemented
features, automated checks and a complete human campaign playthrough.

## Final progression changes

- New story offers prepare players for the real regional enemy/dungeon levels.
  Earth offers total200,300XP before its dungeon; all12 readiness scenarios
  reach level30 without dailies. Regional checks require no unexplained entry
  deficit beyond the preceding dungeon's actual generated rewards.
- Ordinary XP is interpolated through level/XP anchors1/5,10/26,30/65,60/170,
  80/250,100/380. Elites pay3x; bosses pay a personal8x content-level award.
  Ordinary party sharing is unchanged. Fresh boss dailies pay10% of their
  corresponding encounter budget; overlapping daily receipts remain bounded.
- The sequential forecast pays story rewards *after* objective work. Assumptions:
  90 ordinary kills and3 elites/hour,2 bosses and8 rooms/hour after level30,
  four-player combat throughput3x with actual shared receipts,4minutes per
  investigation site,35minutes/dungeon,40minutes/raid,40% collection drops,
  no daily or Fortune income. Reference50%-rested scenarios forecast95.5hours
  solo /90.8hours coordinated party to100; solo first dungeon2.36hours.
  These are model outputs, **not measured human playtime**. Most remaining
  leveling time is at80–100; repeat-content enjoyment and that late-game pacing
  especially need playtest feedback. Dark Realm8–12hours remains a target.
- No saved level curve/schema migration, gear rewrite, Gold balance change or
  accepted reward repricing. Explicit zero quotes and investigation progress
  also survive catalog refresh. Capped quest XP still becomes Resonance XP.
- Forge potency prices through reaching+8 remain1,2,4,8,16,32,64,128Hearts.
  Later steps use256+32*n*(n+1),n=currentPotency−8. The final+19→+20 step
  costs4,480Hearts, payable from five normal stacks instead of an impossible
  524,288. Total+0→+20 costs21,631Hearts. Client quotes and server transactions use matching rules. +20 remains
  a long-term endgame goal; no exact acquisition-hour claim is made.

## Verification and retained evidence

- Focused Forge Go/client/live-refresh tests passed. Full normal-bag transaction
  probes now require every potency step to be payable and charge its exact quote.
- Full Go run completed with two stale audit expectations failing after the
  intentional boss/daily rebalance; those expectations were corrected. Affected
  race checks passed (game35.934s); final `go test ./...` passed all packages
  (game308.210s on the shared host).
- Release/Forge packaging:306 checks passed in4 suites (9.024s). Full lint,
  client preparation and deploy-script syntax checks passed.
- Full JavaScript suite passed:480 suites /7,341 tests (319.163s). Subsequent
  version-history assertions passed281 checks, including the new1.10 note.
- First prepared five-player Dark King test failed when the Rogue died after
  239.1seconds combat. The party dealt approximately298k damage but remained in
  phase one of a1.824M-HP encounter. The mandatory Mythic scaling compounded
  the family health multiplier. New encounters now use570k HP (family2.5x,
  down from8x), targeting5–10minutes at observed throughput. Damage, mechanics,
  survival assertions and gear are unchanged. An affected rerun is required;
  the failure is not counted as a clear. Host contention limits timing claims.
  Finale uses legal class-specific Uncommon/Rare gear and normal player inputs;
  prepared prerequisites are **not** an earned campaign completion.
- Retain accepted four-player Verdant/Abyssal/Molten work, five-player Rootheart,
  public event, casino/admin/arena/social, bounded load, High/Low rendering and
  schema recovery evidence in the linked integration reports. No blanket rerun
  for labels or documentation. Exact scopes/limitations remain in those reports.
- Latest Air earned continuation completed its first investigation but stopped
  during travel with **no pointer input available**. It did not prove a blocked
  server movement command, complete Air, or clear Tempest. Private progress was
  retained; its partial save must not be promoted to a completed handoff.
- Full uninterrupted campaign, remaining regional raid browser clears and
  physical-phone party/dungeon play remain unverified. The user deferred phone
  feedback as nonblocking. Do not advertise these checks as completed.

## Delivery

Prior release1639fd6f /Alpha1.9.31 passed CI35835009087, including native live
character QA. A subsequent public reachability check found both game domains
following eserver.ddnsfree.com to174.220.28.213 while this origin reported
47.203.222.61. Local HTTPS with correct SNI/certificate validation still serves
the exact healthy1.9.31 release. The user has been asked to correct DDNS.

**1.10.0 is being packaged, not yet verified live.** Do not substitute an origin
override for public DNS/TLS reachability or claim success from a version label.
Record the actual CI result and matching frontend/backend identities here once
delivery completes. No production grants, billing integration or DNS changes
were made by these checks.
