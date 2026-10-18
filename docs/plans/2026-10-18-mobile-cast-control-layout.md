# Mobile cast feedback and thumb controls

Isolated follow-up after the prepared Alpha1.79.81 milestone; not published.
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

Keep this change isolated until81 completes CI/deployment verification; include
it in a coherent later polish milestone. Whole-game/mobile/beta gates remain open.
