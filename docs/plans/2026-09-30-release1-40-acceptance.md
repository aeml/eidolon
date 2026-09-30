# Alpha1.40.0 — live acceptance

Exact release:2c962ecb1b6d6eb044fd51ed8037da7cb9d249c9.
CI36643324031 completed successfully, all ten jobs including predeploy,
frontend/backend deployment and final Live Release and Character QA.
Existing authorized Luna monitor reported terminal completion, not estimated
success or an observation timeout.

Independent post-CI checks used normal-DNS IPv4 with cache bypass, not an
origin override: play.eidolonrealms.com/release.json and
server.eidolonrealms.com/healthz agree on this exact SHA and Alpha1.40.0.
Backend reports statusok and databaseready. Public login label, cumulative
1.40→1.39→older history, release-key asset URLs and owner pacing Help copy
match. Public PlaytestSession.js,PlaytestSessionUI.js andUIBindings.js bytes
equal the candidate after the normal release-key import rewrite.

Website commitad22dea7 is merged and unchanged. This receipt permits the next
ordered game candidate to publish; it does not accept later source packages,
measure campaign pacing, demonstrate100concurrentplayers or open beta.

[Successful run](https://github.com/aeml/eidolon/actions/runs/36643324031).
