# Alpha1.45 — exact public acceptance

Accepted September30,2026 after exact-source CI and independent public checks.
This accepts the interface milestone, not final modern-art/phone/campaign
acceptance, the Q gate, closed beta or the full1.11–1.99 roadmap.

- Published18c56dde9868fc554ccf92e3f60e32170d082bcb, Alpha1.45.0.
- [CI36678276259](https://github.com/aeml/eidolon/actions/runs/36678276259),
  attempt1 completed success07:07:50UTC. Luna reported terminal success; root
  independently verified exact SHA/attempt/conclusion and all ten successful
  jobs, including predeploy109774616945, QA inputs109775651361,
  SSH109775683621, Pages109775683758 and live109775936505.
- Normal-DNS IPv4 release.json and healthz repeat-agree on the exact release,
  database ready. Cache-bypassed document has the correct login label,
  cumulative patch entry and actual main.js release= key.
- Exact public main, LootLabelPresentation, StashBrowserUI, CharacterStatsPanel,
  InventoryUI, TradingUI, MinimapLabels and QuestUI bytes equal the exact
  source checkout after rewriteJavaScript(source,sha). Desktop combat HUD CSS
  equals rewriteCss(source,sha),3806bytes/SHA256
  47da94ada713551a6c358cef075d22b9900c2ad9a3811a2fc8b6b278dccb0d92.
- The obsolete46eb5038 run failed only its stale earned-stash source assertion;
  deployment jobs were skipped. Correct only the old bag-grid selector
  expectation; preserve real storage input, conservation and no-grant checks.
  Corrected18c56dde passed all required gates. No rerun or cancelled gate.

The prior scoped interface/auction/earned-stash evidence remains in the
candidate document; no additional campaign/phone soak substitutes for owner
playtests. Accounts/saves/public alpha and QA-only terrain policy stay unchanged.
The staged nginx resolver fix still requires owner sudo; owner-deferred IPv6/
DDNS settings are untouched. Fresh fetch/merge is required before later pushes
to preserve concurrent website changes.
