# Alpha 1.56 arena season policy and earned cosmetics

This milestone publishes the existing arena calendar and reward rules and makes
settled Bronze, Silver and Gold medals usable as permanent wardrobe looks. It is
locally packaged as Alpha 1.56.0 but unpublished, not a live release. The owner's
calendar/operator question remains unanswered. This package documents the
quarterly behavior already running since Alpha 1.7; it does not activate a new
competition or authorize a manual reset, profile edit or calendar change.

## Player rules

The existing calendar uses UTC quarters: January 1 to April 1, April 1 to July 1,
July 1 to October 1, and October 1 to January 1. Each boundary is 00:00 UTC.
Opening or joining the arena after the boundary lazily settles the previous
season. This candidate also performs that durable profile check when collecting
wardrobe looks. Active matches retain their admitted profile until settlement.

| Highest qualifying medal | Required eligible wins | Finishing rating | Honor | Permanent look |
| --- | --- | --- | --- | --- |
| Bronze | 10 | Any | 250 | Bronze Arena Medallion |
| Silver | 25 | At least 1200 | 600 | Silver Arena Medallion |
| Gold | 50 | At least 1500 | 1200 | Gold Arena Medallion |

Only the highest tier pays; a Gold settlement does not also award Bronze and
Silver. An unqualified season records history without a prize. Settlement
archives the prior rating, wins, losses, eligible wins and award, retains earned
Honor, and resets the new quarter's rating to 1000 and seasonal counters to zero
in one revision-checked profile write. No additional currency award accompanies
a medallion claim. Eligibility began in Alpha 1.7; older wins are not backfilled.

In town and out of combat, use **Character → Wardrobe → Learn owned looks**, then
choose Neck and the earned medallion. A real compatible equipped item remains
required; the cosmetic cannot become a stat item, resale item or money transfer.
Repeated settled medals unlock the same look once. Different earned tiers can
be retained across seasons. Current projections cannot unlock cosmetics. These
looks are outside the EP shop and do not debit Gold, EP or Honor.

Normal ranked results retain team-average K32 Elo, with the existing 65 percent
PvP damage scalar and 35 percent maximum-health hit cap rather than hidden gear
normalization. Practice has no ranked rewards. Only the first three meetings
with each opposing player per UTC day change rating or grant match rewards;
if any participant is restricted, neither team receives rating changes or
rewards. The actual match result still records wins and losses. Forfeits grant
neither team Honor or eligible victories. Team changes and reconnects do not
clear durable opponent counts; reaching the bounded 256-opponent history fails
closed until the next UTC day. These measures do not prove immunity to multiple
account abuse or intentionally coordinated losses.

## Operator procedure

The responsible operator is **not yet assigned**. Keep the existing automated
quarterly behavior unchanged while that decision is pending. Do not introduce a
manual reset button, synthetic rewards or a new scheduling service.

Before an approved season rollout, verify the exact accepted client and server
release, database readiness, UTC clock, backups and recoverable arena result
and character-save journals. Publish the dates and unchanged qualification rules
before inviting a real seasonal competition. If dates change, implement and test
the agreed configuration before publication rather than rewriting live profiles.

At a boundary, players settle on their next authorized profile read; no full
population reset job is necessary. Check completed-season history and the new
season identity, not merely a projected medal. Pending match receipts replay
before rollover, and concurrent settlement rereads the winning revision. A
profile service or pending-result error must not grant a wardrobe look.

For recovery, restore database availability and use the existing journal replay
path. Retain pending receipts and the schema compatibility marker. Never delete
them, lower a profile revision, force an older incompatible writer or manually
add Honor to make an error disappear. The existing character-save journal
persists selected and collected looks separately from real equipment; an
unsaved wardrobe response reports pending durability rather than success.

## Verification and release gates

The existing [Alpha 1.7 arena evidence](2026-09-13-release1-7-arena.md) includes
isolated Mongo checks for concurrent one-time settlement, archived history,
stale replay and an unqualified next quarter. This milestone does not change
the payout thresholds, calendar calculation or conditional settlement write.

New focused checks cover settled-history-only entitlement, duplicate claims,
safe-zone and ownership restrictions, unchanged stats/resources/equipment and
wallets, and independent BSON/protobuf appearance persistence. Handler checks
reject forged client medals when durable history is unavailable. Twenty-nine
wardrobe, cosmetic and arena UI tests passed in 2.331 seconds; the two wardrobe
handler/protocol race checks passed in 1.377 seconds. Scoped lint and diff checks
passed. Three native browser cases passed in 22.2 seconds, including all three
medallion selections on the rigged Fighter, unchanged real gear and currencies,
appearance reset, 390px wardrobe controls and the two existing EP shop routes.
Desktop medal and narrow-control screenshots were visually reviewed. The
catalogue uses coin, rim and crest geometry rather than an ordinary pendant
recolor. Artifacts: `/tmp/eidolon-1-56-medallion-review-1001c`.

The first native fixture incorrectly checked a nonexistent authored-model flag
and timed out. It now checks the renderer's actual `authoredClass` metadata;
the authored-model requirement was retained rather than accepting a fallback.
A second fixture used visible label text instead of the existing explicit ARIA
labels and timed out. It now targets the actual accessible names and bounds
this single native case to 45 seconds. Mandatory discovery now includes this
existing cosmetic file in the interface stage: all 254 cases are assigned once,
with no missing or duplicate cases. No separate broad test matrix was added.
Browser fixtures supply server-shaped results and cannot establish earned
qualification or complete a real season. They make no physical-phone claim.

Packaging passed 330 version/publisher checks in 2.382 seconds, scoped lint,
shell syntax and diff checks. Both unchanged anonymous login/release routes
passed in 9.1 seconds, with login version matching the local manifest and new
1.56 notes preceding the complete prior history. The notes screenshot was
reviewed. Artifacts: `/tmp/eidolon-1-56-login-notes-1001`. This establishes local
packaging, not public server readiness or release acceptance.

The roadmap requires agreed dates/operator procedure before activating a real
season, not before publishing cosmetics for already-settled history. The earlier
publication hold was broader than that requirement. Publishing this package does
not answer the owner's question, assign an operator or invite a new competition;
that operational decision remains open before an organized season launch.

Before publication, accept the preceding 1.55 release, fresh-fetch and merge
master, then push normally. Luna monitors CI; independent
public identity, readiness and changed-file checks remain required. Source
documentation was reviewed; a rendered documentation preview is unavailable.

The preceding [1.55 acceptance](2026-10-01-release1-55-acceptance.md) is complete:
all ten CI jobs and independent public identities, readiness and exact changed
assets passed. This package may now follow it in the normal ordered rollout.
