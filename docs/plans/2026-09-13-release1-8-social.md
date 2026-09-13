# Alpha 1.8.0 — find your people

Developed separately from frozen1.7f3adf398. Runtime remains1.7 until packaging.
Preserve ordered1.6→1.7→1.8 publication and live identity verification.

Required: activity group finding, recruitment and role listings; persistent guild
event scheduling; better invitations/readiness; moderation workflows built on
existing block/report/guild authority. Add authoritative physical casino seats,
table presence, session/reconnect handling and camera/input ownership for both
desktop and phones. No remote menu-only casino or pretend multiplayer seats.

Full games/location/town relocation are1.9; both functioning floors and final
integration are1.10. The VIP currency remains an unresolved user decision:
never name it, substitute Gold/Resonance, or count an inaccessible placeholder
as completion. Read the existing casino roadmap and economy boundary before
implementing its sessions. Obtain that currency decision before VIP integration.

Use focused changed-path checks and essential authority/save/currency safeguards,
plus build/release smoke. Consolidated earned group/device/endurance checks stay
in final stabilization, not repeated for every batch. No new soak started here.

Initial inspection: party response accepts an inviter name without checking an
outstanding invitation. Fix server-owned expiring one-use invitations tied to
the original party before extending group recruitment. Existing accept/decline,
busy and block controls should remain the player-facing flow.

04:51 invitation batch implemented: World owns one outstanding invitation per
target, expiring at60seconds and bound to the original party object as well as
leader/target IDs. Accept/decline consumes it; expiry, replacement/disband,
leadership changes, offline/busy targets and full/already-joined parties reject.
Validation+join are atomic under World.Mu, including concurrent last-seat claims.
Existing wire/UI accept flow remains; the modal explains expiration. Handlers
recheck mutual block filtering, use detached inviter/locked party snapshots,
and withdraw an invitation when delivery fails rather than falsely confirming it.

Focused invitation authority tests PASS0.025s, existing handler busy/delivery
tests PASS0.585s, existing gameparty/invite selection PASS2.498s; changedJS lint,
Go build-trimpath-all and diff checks PASS. No multiplayer campaign or broad
matrix run. Still required: actual finder/recruitment UI and authority, guild
event scheduling, readiness/moderation improvements and casino seat/session/view
infrastructure. This invitation batch is not1.8completion.

Publishing: frozen1.7f3adf398 still unpublished while corrected1.6CI34738051311
runs (server/client/browser2/browser3PASS, browser1running at04:50). Keep ordered
publication and verify each exact live identity before pushing the next milestone.
