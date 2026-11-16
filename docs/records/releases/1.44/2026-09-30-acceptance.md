# Alpha1.44 — exact public acceptance

Accepted September30,2026 after exact-source CI and independent public checks.
This accepts the audio milestone, not final listening/modern art, beta or the
full1.11–1.99 roadmap.

- Published b24eda6d6de98ff73a496a476871c760474e4118, Alpha1.44.0.
- [CI36673117387](https://github.com/aeml/eidolon/actions/runs/36673117387)
  attempt1 completed success06:01:07UTC; root independently verified exact SHA,
  attempt, terminal conclusion and all ten successful jobs after Luna's receipt.
  Predeploy109758030788, Pages109758728604, server109758728625 and
  live109758983676 are included.
- Normal-DNS IPv4 release.json and healthz agree on that exact SHA/version,
  database ready. Cache-bypassed document matches login label, patch entry and
  the actual main.js release= key. An initial diagnostic assumed v= and failed;
  reading the publishing helper confirmed release=, and the corrected check
  passed without changing production.
- Exact public main, AudioManager, WorldAmbience, AbilityCastProfiles,
  CombatImpactProfiles, UIManager, PhoneSettingsUI and GameEngineNetworkMessages
  bytes match the source checkout after rewriteJavaScript(source,sha). The
  first-party Cinzel font also matches125468bytes/SHA256
  f4d83d34d1f6c741193e4acf4b3dff9531e5a67b6aa65228d00a7db72a4e0f34.
- Corrected FriendToast partial mock retains all production channels and tests.
  The obsolete failed89d3 run was cancelled only after its Jest failure and
  before any deployment jobs; corrected b24eda6d passed the complete workflow.
  No skipped gate, silent error suppression or production rollback.

Existing audio/profile/mute/suspension evidence remains in the candidate
document; no extra campaign or phone soak is inferred from required live QA.
These are original generated cues/ambience, not a finished score/foley or human
mix approval. Accounts/saves/public access and QA-only terrain policy remain.
The staged Pages resolver correction still requires owner sudo; shared DDNS/
IPv6 settings are unchanged. Fetch/merge remote immediately before later pushes.
