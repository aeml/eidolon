# Prepared fixtures beside a copied client

Use `EIDOLON_E2E_STATIC_ROOT` to run Playwright against the complete copied
publication. Game modules and assets must come from that publication.

Some prepared UI cases import presentation-only data from
`/tests/darkRealmFixture.js`. That module is intentionally absent from the
production publication. Set `EIDOLON_STATIC_TEST_ROOT` to an owned fixture
directory containing the exact, source-pinned `darkRealmFixture.js` when running
those cases. Playwright forwards this setting to `scripts/serve-static.mjs`.

The optional directory serves only the `/tests/` namespace. It cannot override
`/src/`, assets, the login document or release metadata. Missing test files
return 404 without falling back to the publication; traversal and symlinks
outside the fixture directory are rejected. Without this setting, static
serving keeps its existing behavior.

Keep a separate inventory of the prepared fixture bytes and retain the copied
publication's original inventory before and after the run. Fixture delivery
does not prove campaign progression, authenticated instance admission, physical
phone usability or visual acceptance. Browser failure collection, native-GPU
requirements and all original test assertions still apply.

## Assembled UI fixture handoff

Atlas/quest scenarios import `tests/darkRealmFixture.js`; the party layout
scenario also imports `tests/groundInputProjection.js`. Copy both exact source
files into the owned `EIDOLON_STATIC_TEST_ROOT` namespace and pin their hashes.
Do not expose the repository test tree in the game publication or substitute
those files for game modules. Audit the selected specs for additional browser
fixture imports before starting a copied-client run.

A private Playwright config must restore the original absolute `testDir` and
`webServer.cwd`. Disable automatic trace/video when its evidence is combined
with credentialed gameplay. Preserve failed raw recordings privately; a text
credential scan cannot certify their compressed traffic or pixels.
