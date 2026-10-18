# Mobile cast feedback and thumb controls

Selected into the prepared Alpha1.79.81 cast milestone; deployment acceptance
remains pending. The original isolated preparation is retained in its history.
The actual phone gameplay capture showed the three-second cast panel covering
parts of the action controls. A DOM/browser regression reproduces overlap with
the joystick's bounds before the correction.

The panel now follows the existing encounter reservation: above portrait controls
and between the thumb columns in landscape, including mirrored layouts. It stays
within the viewport and retains the existing text, progress, pointer transparency
and authoritative-completion behavior. No camera, controls, network or cast rule
changes are required.

Eight real-browser layout cases pass in14.4seconds:390px normal/120percent
controls,320px portrait and568px short landscape, both hands. The fixtures use
actual UIManager/InputManager and saved supported preferences, with no WebGL
world or backend. Portrait and landscape captures were reviewed. The original
one-failure/seven-not-run negative is retained. This does not qualify a physical
phone or replace the six actual gameplay routes accepted locally for81.

The subsequent actual connected native phone/fence selection passes both cases
in33.9s (Go-race42.972s), including explicit cast-panel/joystick/action/hotbar
non-overlap, movement cancellation, retry and saved manual-turn-in progress.
Both visited saves retain gear/bag/wallet and expected progress, and four
unvisited saves remain unchanged. Native source5d6d4ffc4 uses this exact CSS;
the current master UI and input module bytes match that qualification. Its
separate audio follow-up does not alter these layout inputs or supply a broader
performance pass. Private27file inventory:
`15cbb4cd8dcef16f48c458a1bcb0c5a79768a59e1e9aaaaee4495f68f39eb763`.

This fixes a known layout problem in the new cast feature before accepting81.
Current own CI and verified deployment remain required. The full original game,
mobile/device, art, performance and beta gates remain open; soak/stress is deferred.
