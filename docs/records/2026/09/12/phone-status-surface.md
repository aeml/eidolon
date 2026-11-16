# Phone status reading surface

Source: completed hosted65 shard3 capture
`/tmp/eidolon-release65-hosted-shard3-nfCykY/test-results/browser-3/layout/mobile-status-layout-390x8-bf1a0-out-covering-thumb-controls/status-390.png`.
The launcher text could be seen faintly through the panel's long descriptions.
CSS used`#111923f5`(approximately96% opacity) for the reading surface.

Changed only the panel background to opaque`#111923`. Its size/scroll budget,
header, reachable combat controls, launcher styling and navigation remain
unchanged. The release65 patch entry now describes this small visual polish.

Regression RED1failed/10passed0.707s; GREEN2suites/251tests1.506s plus changed
lint. Logs`/tmp/eidolon-phone-status-surface-{red,green,lint}-20260912.log`.
The four existing responsive status-browser cases now assert the computed opaque
background; their next integrated browser run remains required.

A separate **UI-only**, GPU-disabled system-Chrome pixel check rendered the
actual before/after stylesheet against bright and dark backdrops. The original
panel's interior PNG pixels changed with the backdrop; the corrected panel's
interior PNGs were identical. Computed colors were respectively
`rgba(17,25,35,0.96)`and`rgb(17,25,35)`. Retained screenshots
`/tmp/eidolon-phone-status-surface-pixels-IMEVwI/{before,after}.png`; after image
inspected. This was not native gameplay, did not use the GPU, and does not
replace the normal complete native gate currently running for64.

Based on native-test branch6f67b7ba, itself based on hosted65source9ab5b644.
HostedCI34668886679 has completed successfully for **9ab5b644**, not this later
CSS/test integration. Native Teleport/protection, integrated regression and all
normal publication/live gates remain;65 is not live or fully accepted.
