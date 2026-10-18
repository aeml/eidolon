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
