# Eidolon Production-Confidence Goal

Bring Eidolon Alpha 0.40.0 to a production-verifiable release state, then commit, push to the production branch, wait for deployment, and test the deployed game through real Chrome gameplay using dedicated persistent QA characters.

Work autonomously through implementation, validation, release, deployment monitoring, and live verification. Do not stop after writing a plan or after local tests pass. Keep the worktree clean and preserve unrelated user changes.

## Primary outcomes

### 1. Establish a reproducible green baseline

- Fix the Node-sensitive Jest failures in `tests/MenuPolish.test.js` and `tests/ReproTooling.test.js`.
- Declare and align supported Node and Go/toolchain versions across package metadata, local documentation, GitHub Actions, `go.mod`, and Docker.
- Require `npm test`, `npm run lint`, `go test ./...`, and `go build ./...` to pass from a fresh install.

### 2. Remove immediate production dependency risk

- Replace the production `protobufjs@7.5.4` runtime with a patched, locked version.
- Prefer self-hosted or build-produced runtime dependencies over unverified CDN dependencies.
- Refresh `package-lock.json` intentionally and assess `npm audit` results.
- Do not claim a vulnerability is fixed solely because npm classifies the dependency as development-only when `index.html` loads it at runtime.

### 3. Add a committed real-browser harness

- Add pinned `@playwright/test@1.61.1`.
- Use `/usr/bin/google-chrome` in this Codex environment and Playwright Chromium in CI.
- Capture screenshots, traces, video on failure, page errors, console errors, failed requests, and WebSocket state.
- Add a fast anonymous smoke test for the start screen, version, Patch Notes, Escape close behavior, asset loading, and production WebSocket connectivity.
- Add authenticated tests driven by `EIDOLON_E2E_USERNAME` and `EIDOLON_E2E_PASSWORD`.
- Support optional secondary credentials for a two-browser multiplayer scenario.
- Never commit, print, or write credentials into artifacts.

### 4. Drive actual gameplay

- Use real Playwright mouse, keyboard, and DOM input.
- Do not call `GameEngine` attack, movement, loot, dungeon, or ability methods directly.
- `page.evaluate()` may inspect read-only state and translate Three.js world positions to screen coordinates for real mouse clicks.
- Log in, enter a real persisted character, move, use menus, fight an overworld enemy, cast abilities, kill, loot, update inventory, enter and exit a dungeon, and exercise reconnect/session resume.
- With secondary credentials, validate party and presence behavior plus remote movement, jumping, combat presentation, and state convergence.

### 5. Harden QA and production-only behavior

- Remove or restrict the unrestricted production `/level` command.
- If QA acceleration remains, gate it behind explicit server-side allowlist/environment configuration and an authenticated QA username.
- Treat tracked bot usernames and passwords as public. Remove real-credential assumptions and generate disposable load-test credentials safely.
- Add focused regression tests for these restrictions.

### 6. Make deployment verifiable

- Add a server health/readiness endpoint reporting status and deployed commit SHA without exposing secrets.
- Publish a client release manifest containing the deployed commit SHA.
- Inject the same Git SHA into the client and server during deployment.
- Make deploy verification fail on unhealthy status, not merely on receiving any HTTP response.
- After both client and server deploy, poll with cache-busting until both report the pushed SHA.
- Add a post-deploy Playwright smoke job against `https://eidolon.mendola.tech/`.
- Keep screenshots and traces as GitHub Actions artifacts.

### 7. Update documentation from implemented evidence

- Reconcile `README.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/REVIEW.md`, and the active implementation/status plans.
- Clearly distinguish implemented, unit-tested, browser-tested, live-tested, and still-unverified claims.
- Record current LOC measurements and move patch-history prose out of the architecture overview where appropriate.
- Write a durable live QA checklist based on the existing dungeon, first-hour, retention, and repro documents.

## Release procedure

- Make focused commits with clear messages.
- Before pushing, run the full clean-install, client, server, and local-browser gates.
- Do not push a knowingly red build.
- Push the completed release commit to the configured production branch, currently `master`.
- Monitor every GitHub Actions job through completion.
- Confirm the deployed client and server SHA match the pushed commit.
- Run the live anonymous and authenticated Playwright suites against production.
- If a regression caused by this release is found, fix forward and redeploy. If fix-forward is unsafe, revert only the release commit, push the revert, and verify the rollback deployment.
- Do not declare success until the live-character route passes and evidence is recorded.

## Production data constraints

- Use only dedicated QA accounts supplied through environment variables or secrets.
- Do not alter or delete normal player accounts, characters, auctions, parties, or Mongo data.
- If QA credentials or permission to create dedicated QA accounts are unavailable, complete all non-mutating work and ask once for those credentials before the authenticated production test.

## Scope discipline

- Prioritize release confidence, security, reproducibility, deploy observability, and real-browser coverage in this goal.
- Do not expand this goal into the entire Alpha 1.0 feature roadmap.
- Do not undertake the full `0.40` through `0.43` monolith decomposition unless a narrowly scoped extraction is necessary to complete the release-confidence work safely.
- Record important follow-up architecture, gameplay, mobile, performance, and repository-size work in a prioritized handoff rather than silently broadening this release.

## Definition of done

- A fresh-install client test and lint run is green.
- Server tests and build are green.
- The known production protobuf runtime vulnerability is removed.
- Real-browser tests are committed and reproducible.
- Client and server expose the same deployed Git SHA.
- GitHub deployment succeeds.
- The live anonymous browser smoke passes.
- A real production QA character completes movement, menus, combat, loot, dungeon entry and exit, persistence, and reconnect checks through Chrome.
- The multiplayer browser route passes when secondary credentials are supplied.
- Relevant documentation accurately describes verified current state.
- The final worktree is clean and `origin/master` contains the verified production commit.
