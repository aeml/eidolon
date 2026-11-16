# Public Alpha 1.80.4 verification

Recorded from normal-TLS public endpoints and the successful workflow artifact.
No accounts or credentials are included.

```json
{
  "live": {
    "checkedAtUTC": "2026-11-16T00:21:16.534212+00:00",
    "version": "Alpha 1.80.4",
    "commit": "dd4ca9337d2d57d9b1a7c9c66ac76d8512e22245",
    "frontendManifest": "https://play.eidolonrealms.com/release.json",
    "loginPage": "https://play.eidolonrealms.com/",
    "runtimeEntry": "https://play.eidolonrealms.com/src/main.js?release=dd4ca9337d2d57d9b1a7c9c66ac76d8512e22245",
    "runtimeSha256": "8e429eabcb2f95b67b1832675c6b25711faf3b2cc559a4708d6f12cfaca4499c",
    "backendHealth": "https://server.eidolonrealms.com/healthz",
    "backendStatus": "ok",
    "database": "ready",
    "checks": "Frontend manifest, login version, runtime entry/import identity and backend readiness all match."
  },
  "coverage": {
    "client": [
      {
        "path": "index.html",
        "bytes": 12881,
        "sha256": "91b784e2b0c68debe4855035f5b94790d55017a986a5a6d5251a5a979cbb6cdd"
      },
      {
        "path": "base.css",
        "bytes": 5394,
        "sha256": "3f876e51f0a46864ffa7665b4b7a1f5fb5f6f37fb6a28f014e2b12d82962c852"
      },
      {
        "path": "sorter.js",
        "bytes": 6731,
        "sha256": "f8cc5d157379d844fd695ad567b6c29b3c1f0812964ddf6f95c26327e434bab5"
      },
      {
        "path": "src/analytics/GameSessionTracker.js.html",
        "bytes": 13494,
        "sha256": "6527ce08a18a791777d04fb3ebc52acb94b318ac988011c1680a9627fc5534df"
      }
    ],
    "serverIndexBytes": 15095
  },
  "workflow": "https://github.com/aeml/eidolon/actions/runs/43773226029"
}
```
