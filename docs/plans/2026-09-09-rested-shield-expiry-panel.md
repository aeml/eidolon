# Shield expiry with an independently active resting buff

Complete recovery58 gameplay run1416 on6e85547 failed the duration route after
the shield had already expired correctly. Its old assertion expected the phone
panel to be empty. The retained error snapshot instead shows one earned Well
Rested row, still resting in Lanternhold. This is not a passed complete run.

The corrected test retains all server duration, rank, natural21s/25s expiry,
shield HP/mesh removal, badge disappearance, touch-cast, saved-rank and fresh-login
checks. After shield expiry it additionally requires a positive server rest bank,
Lanternhold membership, a visible Well Rested row with Resting text, and a hidden
empty placeholder. No production effect, timeout or recovery rate changes.
A component regression covers the simultaneous shield/rest rows and preserves
the same rest row when the shield expires.

Original full-run log `/tmp/eidolon-rest58-all-node24-rerun-0650.log`; sanitized
artifacts `/tmp/eidolon-rest58-duration-rest-failure-ATQ2N9`. Credential scan
changed zero files; exact temporary API/Mongo/image absence and free ports
18560/18561/41960 were verified after terminal1. The trained-shield portrait was
viewed; error-context text records the later shield-free resting panel.

Initial local checks included a nonexistent test filename, then a new component
fixture omitted the UI's normalized remainingSeconds field. Both failed checks
are retained in `/tmp/eidolon-rest58-duration-rest-{tests,corrected-tests}.log`;
neither is a production failure or a successful validation. Corrected fixture
uses the same normalized shape as the existing Well Rested presentation test.
Final focused checks and actual duration browser replay remain required.
