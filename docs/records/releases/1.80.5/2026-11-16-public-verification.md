# Alpha 1.80.5 public verification

Read-only checks of the deployed release and its reports. These observations establish the named source at the recorded time.

```json
{
  "workflow": "https://github.com/aeml/eidolon/actions/runs/43807360210",
  "source": "981cba7249c0a7dea7d36829e555cf585875a0f4",
  "public": {
    "checkedAtUTC": "2026-11-16T06:11:00.067307+00:00",
    "version": "Alpha 1.80.5",
    "commit": "981cba7249c0a7dea7d36829e555cf585875a0f4",
    "frontendManifest": "https://play.eidolonrealms.com/release.json",
    "loginPage": "https://play.eidolonrealms.com/",
    "runtimeEntry": "https://play.eidolonrealms.com/src/main.js?release=981cba7249c0a7dea7d36829e555cf585875a0f4",
    "runtimeSha256": "6d51804515e909226a05db6fe60f9e9dab3ba99ea046a1b79cd3d65487129595",
    "backendHealth": "https://server.eidolonrealms.com/healthz",
    "backendStatus": "ok",
    "database": "ready",
    "checks": "Frontend manifest, login version, runtime entry/import identity and backend readiness all match."
  },
  "coverage": {
    "checkedAtUTC": "2026-11-16T06:02:25.370565+00:00",
    "commit": "981cba7249c0a7dea7d36829e555cf585875a0f4",
    "client": [
      {
        "path": "index.html",
        "bytes": 58222,
        "sha256": "bfda1f1ba3e8ea2e98dfef1dceba34457dd9ec904edf62502d74c1f51637b9dd"
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
        "sha256": "a7b3642e0688ccbd2eede2c3854b80552ee06e7299440372d123fb394cda9c80"
      },
      {
        "path": "src/core/engine/GameEngineRuntime.js.html",
        "bytes": 196351,
        "sha256": "874b77060df71de69645086e06ec3a897f9d553c06128d75505f3b2f13474f62"
      }
    ],
    "serverIndexBytes": 16015,
    "serverStartupReport": "https://play.eidolonrealms.com/coverage/server/server/startup.go.gcov.html",
    "serverStartupReportBytes": 171478
  }
}
```
