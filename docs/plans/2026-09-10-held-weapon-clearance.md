# Held-weapon clearance and blade socket inlays

Status: local component acceptance passed on runtime85989abc; unreleased.
Continuation of [socket appearance consistency](2026-09-10-socket-appearance-consistency.md).

## Fix

All four procedural class main-hand mounts now pitch forward60 degrees so held
weapons clear hip clothing. Offhand mounts, positions, roll and animation tracks
are unchanged. Sword/dagger sockets sit along the blade centerline, with matching
front/back fittings representing the same embedded stones. Gem size, glow,
material/geometry reuse, item counts and gameplay rules are unchanged. This
affects default and equipped main-hand weapons, not only the prepared sword.

## Preserved failures

-94881 failed all three sampled poses on20e3ff6d: Wizard/Cleric had no individual
 color signal in actual Idle as well as bind. Archive
 `/tmp/eidolon-socket-pose-failure-WkunTs`.
-12041 red ray tests reproduced Rogue_HipWrap, Wizard_HipRobe and
 Cleric_HipVestment obstruction.30-degree candidate73539 still failed two cases.
-60-degree pitch-only25924 on494b1e5e passed Attack but failed bind/Idle socket
 visibility; archive `/tmp/eidolon-held-weapon-first-render-qKjxXH`.
-98950/19687 failed old-placement negative fixtures after adding blade inlays.
 Corrected the fixture to restore both old angle and old stone position, with
 updateMatrix because batched inspection meshes disable matrixAutoUpdate.
 The specific old garment occluder assertions remain; no visibility checks were
 removed. Detail cameras remain above ground rather than looking through floors.

## Final evidence on the same85989abc runtime

-15983 terminal0:252 focused tests/four suites2.323s plus lint. Logs
 `/tmp/eidolon-blade-inlays-verified-{focused,lint}.log`.
-64916 terminal0:three native rendered tests30.6s, zero retries; bind, sampled
 Idle and sampled Attack × seven gems × High/Low.126 equivalent-record group
 comparisons have zero RGB difference;168 independent class color signals are
 positive. Same-view comparisons retain icon identity/no unnecessary rebuild.
 Archive `/tmp/eidolon-blade-inlays-proof-Jva1QU`; log
 `/tmp/eidolon-blade-inlays-render-native.log`.
-80608 terminal0:two native character/equipment gallery tests20.0s; all four
 classes/five states/HighLow and36 equipment families/14 slot loadouts including
 synthetic local/replica matching. Archive
 `/tmp/eidolon-held-weapon-gallery-proof-C9kiYG`; log
 `/tmp/eidolon-held-weapon-gallery-native.log`.
-92572 terminal0:268 suites/3754 tests117.094s followed by lintNode24.18.0.
 Logs `/tmp/eidolon-held-weapon-full-{client,lint}.log`.

Manual inspection covered all seven IdleHigh socket detail mosaics, RubyIdleLow,
RubyAttackHigh, RubybindHigh group and all four equippedHigh gallery images.
September10 continuation also inspected all four default-equipment Low gallery
images: class-specific silhouettes and local/synthetic-replica fit agree in the
sampled Idle view. Not every Low socket detail was manually inspected. Dark Onyx has small positive signals;
this is not distant readability, continuous animation or physical-phone proof.

## Remaining release gates

Ordinary Forge socket replacement must update bag/equipped local and actual
observer presentation and survive login. Integrate with the aura successor and
verify combined source; earlier gallery/synthetic replicas do not prove real
multiplayer/save behavior. Canonical60 acceptance remains ahead of any successor
version assignment, push or live acceptance. No broader visual milestone closes.

Additional proposed patch note (unreleased):
“Held weapons sit clear of clothing, and blade socket fittings are visible on
both sides.”
