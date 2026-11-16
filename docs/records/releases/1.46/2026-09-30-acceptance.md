# Alpha1.46 — exact public acceptance

Accepted September30,2026 after exact-source CI and independent public checks.
This accepts the declared accessibility-baseline scope, not universal WCAG
conformance, keyboard-only combat, physical-phone certification, final modern
art, the integrated Q gate or the full1.11–1.99 roadmap.

- Published319bd831a72498a50b3cdd85fd68a7100fd66240, Alpha1.46.0.
- [CI36688111051](https://github.com/aeml/eidolon/actions/runs/36688111051),
  attempt1 completed success08:52:36UTC. Luna reported terminal success; root
  independently verified exact SHA/attempt/conclusion and all ten successful
  jobs: Go109798579798, Jest109798580078, Playwright109798580050/
  109798580098/109798580134, predeploy109807820088, inputs109808804969,
  Pages109808839430, SSH109808839480 and live109809126850.
- Normal-DNS IPv4 release.json and healthz agree on the exact release,
  database ready. Cache-bypassed document has the correct login label,
  cumulative patch entry and actual main.js release= key.
- Public main.js, InputManager, RenderSystem, KeyboardBindings,
  KeyboardSettingsUI and phone-layout.css bytes match the exact source after
  rewriteJavaScript/rewriteCss(source,sha). InputManager20982bytes/SHA256
  78feb12f3e3453712630416759c08c165db2d6379df466871037dd44f1378e41;
  phone-layout.css12837bytes/SHA256
  be0d69b0312268ee1b79de46c713090412df345f0d37e848eab41fa08eb8a340.
- Earlier failed gates were fixed, not waived: mobile canvas shrink-to-fit
  on native pinch-enabled layouts and bag item-button focus swallowing the
  inventory close shortcut. Scoped repro/fix evidence remains in the
  candidate receipt; corrected319bd831 passed every required gate without
  disabling earned inventory, camera or authenticated encounter coverage.

Owner confirms the public page loads again. No privileged nginx/DNS changes,
account/save changes, terrain-policy change or beta access transition were
made. IPv6/DDNS and staged nginx resolver work remain owner-deferred, not
implicitly fixed by these IPv4 observations. Fresh fetch/merge remains
required immediately before later pushes to preserve concurrent website work.
