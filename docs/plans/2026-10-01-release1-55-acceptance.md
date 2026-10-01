# Alpha 1.55 public acceptance

Accepted October 1, 2026 after exact-source CI and independent public checks.
The arena interface milestone is live; later local candidates and final beta
readiness are not accepted by this receipt.

- Exact published release: `480a47b28137783c0f9db623a87ee8e6cd581d5a`,
  Alpha 1.55.0.
- [CI 36794385683](https://github.com/aeml/eidolon/actions/runs/36794385683),
  attempt 1, completed successfully. Luna monitored the run; independent final
  API reads confirmed the SHA, attempt and all ten successful jobs: Go
  110154339347, Jest 110154339523, browser 110154339604/110154339640/110154339656,
  predeploy 110163818229, inputs 110164471229, SSH 110164500946, Pages
  110164500963 and live 110164792113.
- Ordinary-DNS public IPv4 HTTPS reports the exact frontend and backend
  commit/version after CI completion. Backend `/healthz` reports `status: ok`
  and `database: ready`; no origin override was used.
- Every changed client runtime file relative to accepted 1.54 was downloaded
  in full and compared with the exact publisher output: `index.html`,
  `src/styles/pvp.css` and `src/ui/PvPUI.js`. All byte counts and SHA-256 hashes
  match. The [asset receipt](2026-10-01-release1-55-assets.json) preserves them.

The [work record](2026-09-30-release1-55-arena-work.md) retains scoped clocks,
eligibility, team roster, consent and refresh evidence, plus earlier connected
team elimination/disconnect/restart checks. This does not demonstrate real
population queue times, final class balance, physical-phone performance or
full-campaign pacing. Ordinary competition rules, rewards, Gold/EP separation,
account progress and open-alpha access remain unchanged.

The independent check did not mutate production accounts or infrastructure.
IPv6 remains owner-managed and unverified. This receipt travels with the next
ordered release rather than republishing 1.55 solely for documentation. Source
documentation was reviewed; rendered documentation preview was unavailable.
