# Connected wardrobe uses the published client

The corrected1.79.79 CI39101932121 stopped before deployment: the Fighter and
Cleric wardrobe cases failed during world startup, with repeated raw-module
`ERR_NETWORK_CHANGED` responses. Their wardrobe assertions were never reached.
The other native outcomes do not qualify those two cases. Retain the failed run;
do not waive it or increase its deadlines.

Pages already bundles the lazy game engine. The connected wardrobe wrapper
previously served the development module graph. It now prepares a fresh, owned
copy of the same six Pages inputs, calls the existing engine bundler and runtime
versioner, and serves that copy with the existing local WebSocket override.
Login and recovery retain their shared external credential owner. The source
checkout is never rewritten. The wrapper removes only its own temporary copy.

Both the direct wardrobe route and that route within `all` select the copied
client. The environment selection applies only to that Playwright invocation,
preserving explicit raw-module fixtures in other routes. Existing four-class
wardrobe purchase, held-slot/full-outfit replacement, remote replication,
reconnect, wallet, cleanup and rendering assertions remain. The connected case
also verifies that the actual loaded engine is bundled and release-pinned.

Focused checks pass40tests/four suites8.630s, plus changed-file lint and shell
syntax. They include the actual full engine graph and copied HTTP serving.
The initial missing-vendor setup failure, a jsdom fixture's unavailable `fetch`,
and the full-graph test's original five-second deadline failure are retained in
the owned QA evidence. The HTTP fixture now uses Node's real HTTP client; no
deadline or product requirement was relaxed.

This aligns the fixture with deployment; it does not prove that all network
failures are eliminated. Actual four-class connected native qualification and
the complete release pipeline still must pass before publication acceptance.
No soak, stress, physical-device or whole-game completion is claimed.
