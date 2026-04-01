# Client Asset Persistence Plan

> For Hermes: use subagent-driven-development if implementing this plan.

Goal: make Eidolon clients keep downloaded game assets across refreshes so a normal page reload does not force large model/texture downloads again.

Architecture: use stable asset URLs plus browser-managed persistent caching. Start with the cheapest fix: stop client-side cache busting and serve immutable/static assets with long-lived cache headers. Then add an explicit asset manifest + service worker warm-cache flow for a user-visible "download assets" action and resilient offline-style persistence. Because the asset tree is ~965 MB and includes very large GLBs, do not blindly pre-cache the entire library during first load.

Tech stack: existing vanilla JS/Three.js client, Cache Storage service worker, optional IndexedDB metadata, static hosting/nginx cache headers.

---

## What I found in the current repo

1. Asset volume is large enough that strategy matters.
   - `assets/` is about 965 MB across 255 files.
   - Largest files include:
     - `assets/objects/chests/stash_base.glb` ~59.9 MB
     - `assets/buildings/blacksmith_forge.glb` ~38.0 MB
     - several other GLBs in the 14-20 MB range

2. The client already preloads a lot of assets at startup.
   - `src/core/GameEngine.js` calls `renderSystem.preloadEnvironment()` and `MeshFactory.preloadAllModels({ phase: 'all' ... })` during startup.
   - `src/utils/MeshCatalog.js` contains a long preload list of GLB paths.

3. There is already in-memory runtime caching, but not durable browser-persistent caching logic.
   - `src/utils/MeshFactory.js` has static `cache`, `pool`, and `inflight` objects.
   - That avoids repeated downloads within one tab/session lifecycle, but it does not itself guarantee persistence across refresh.

4. There is at least one direct browser-cache killer in production code.
   - `src/core/RenderSystem.js` creates:
     - `./assets/backgrounds/ground_texture.png?v=${Date.now()}`
     - `./assets/backgrounds/abyssal_well_floor.png?v=${Date.now()}`
   - Every fresh page load generates a new URL, which guarantees revalidation/miss and often a re-download.

5. I found no existing service worker registration or offline asset manifest.
   - No `navigator.serviceWorker.register(...)`
   - No workbox/PWA setup
   - No manifest-driven asset pack logic

6. Deployment-side static asset caching is not clearly codified in this repo.
   - `server/deploy/nginx/eidolon.conf.template` only shows a broad proxy to the app server.
   - I did not find asset-specific `Cache-Control` policy in repo-managed nginx config.

---

## Recommended rollout

Use a 3-layer approach.

### Layer 1: Fix URL stability and HTTP caching first

This is the highest ROI change and likely solves most refresh pain by itself.

Do this first:
- Remove `Date.now()` cache-busting from asset URLs in `src/core/RenderSystem.js`
- Ensure all static asset URLs are stable across reloads
- Serve `assets/**` with long-lived cache headers, ideally:
  - `Cache-Control: public, max-age=31536000, immutable`
- Serve `index.html` with short/no-cache so app shell can update quickly

Why this matters:
- If the URL stays constant and headers are correct, the browser will reuse cached GLBs/textures across refreshes without additional app logic.
- Right now the ground/snow textures explicitly defeat that.

### Layer 2: Add a service worker for durable asset persistence and explicit warming

After Layer 1, add a service worker so the client can intentionally retain a chosen asset pack even if browser heuristics would otherwise evict some files.

Do this next:
- Add a versioned asset manifest generated from `MeshCatalog` + known texture/icon paths
- Register a service worker in `src/main.js`
- Cache with a cache-first/stale-while-revalidate policy for versioned game assets
- Add a UI control like "Download game assets" or "Keep assets on this device"
- Warm only a curated pack by default, not the full 965 MB library

Why not pre-cache everything immediately:
- ~965 MB is too large for a naive first-run service-worker pre-cache on many browsers/devices.
- Mobile browsers and Safari may evict or reject very large origin storage.
- Startup would become worse if we force full-library download.

### Layer 3: Split assets into packs and lazily retain them

Introduce asset groups so users only keep what they actually use.

Suggested packs:
- core-ui pack: icons, small textures, essential shared background textures
- player-class pack: archetype models/animations for Fighter/Wizard/Rogue/Cleric
- overworld pack: town/buildings/plants/common NPC assets
- dungeon packs: verdant, molten, tempest, abyssal
- optional high-weight props pack: very large buildings/chests/summons

Behavior:
- On first play, fetch only core + selected class pack + immediately needed world pack
- As assets are encountered, service worker persists them
- Optional settings button to pre-download more packs on Wi-Fi

---

## Concrete implementation plan

### Task 1: Stop accidental cache busting

Objective: ensure asset URLs are stable across refreshes.

Files:
- Modify: `src/core/RenderSystem.js`
- Test: `tests/AssetAudit.test.js` or new `tests/RenderSystemAssetCaching.test.js`

Steps:
1. Replace `?v=${Date.now()}` URLs with stable paths.
2. If versioning is needed, use a build/app version constant, not runtime time.
3. Add a test asserting environment texture URLs do not include per-load timestamps.

Expected result:
- Refreshing the page requests the same texture URL, letting the browser cache work.

### Task 2: Centralize asset manifest generation

Objective: define exactly which assets belong to which download pack.

Files:
- Create: `src/assets/assetManifest.js`
- Create: `src/assets/assetPacks.js`
- Modify: `src/utils/MeshCatalog.js`
- Test: `tests/AssetManifest.test.js`

Steps:
1. Export current startup/background/all preload paths from one shared manifest layer.
2. Add non-GLB assets used by `RenderSystem`, `WorldGenerator`, item icons, and other guaranteed runtime textures.
3. Group assets into named packs.
4. De-duplicate all paths before export.
5. Add tests for duplicate-free manifests and required core assets.

Expected result:
- A single source of truth for "what can be downloaded and persisted".

### Task 3: Add service worker plumbing

Objective: allow persistent asset storage across refreshes and revisits.

Files:
- Create: `public/sw.js` or repo-root `sw.js` depending on hosting layout
- Modify: `index.html`
- Modify: `src/main.js`
- Create: `src/assets/AssetCacheManager.js`
- Test: `tests/AssetCacheManager.test.js`

Steps:
1. Register the service worker from `src/main.js` after bootstrapping.
2. In the service worker, intercept requests to `/assets/` and apply cache-first or stale-while-revalidate.
3. Version caches with a name like `eidolon-assets-v1`.
4. On activate, remove old cache versions.
5. Add messaging so the page can ask the service worker to warm a named pack.
6. Add tests for manifest messaging and cache-key version handling where practical.

Expected result:
- Once an asset is fetched, refreshes should be served from persistent browser storage when available.

### Task 4: Add explicit “download assets” UX

Objective: let the user intentionally persist packs on device instead of relying only on opportunistic caching.

Files:
- Modify: `index.html`
- Modify: `src/ui/UIManager.js`
- Modify: `src/core/UIBindings.js`
- Modify: `src/main.js`
- Create: `src/assets/AssetDownloadController.js`
- Test: `tests/UIManagerAssetDownload.test.js`

Steps:
1. Add a settings/menu entry: "Keep assets on this device".
2. Show pack sizes and status: not downloaded / downloading / cached / update available.
3. Let the user download core packs first.
4. Surface progress from the service worker back into the UI.
5. Add a "clear cached assets" option for debugging/support.

Expected result:
- Users can deliberately cache assets once and avoid repeated large downloads.

### Task 5: Wire runtime loads through the same cache policy

Objective: ensure preloads and on-demand model loads benefit from the same persistent layer.

Files:
- Modify: `src/utils/MeshFactory.js`
- Modify: `src/core/RenderSystem.js`
- Modify: `src/world/WorldGenerator.js`
- Test: `tests/MeshFactoryLoader.test.js`

Steps:
1. Keep current in-memory `MeshFactory.cache` for same-session reuse.
2. Let actual network fetches continue to use normal URLs so the service worker/browser HTTP cache can intercept them.
3. Avoid custom query params or ad hoc URL rewriting outside manifest/version control.
4. Confirm texture/model loads all use consistent same-origin asset URLs.

Expected result:
- Same-session caching and cross-refresh persistence both work together.

### Task 6: Add deployment cache policy

Objective: make browser caching reliable even without service worker warm-cache.

Files:
- Modify: deployment/static hosting config outside or inside repo as appropriate
- Likely modify: `server/deploy/nginx/eidolon.conf.template` or the real frontend static host config
- Document: `docs/ARCHITECTURE.md` or deployment notes

Recommended policy:
- `index.html`: `Cache-Control: no-cache`
- `src/main.js`, CSS, non-hashed app shell files: short max-age or versioned filenames
- `assets/**`: `Cache-Control: public, max-age=31536000, immutable`

Expected result:
- Even before service-worker warming, refreshes reuse browser cache for stable assets.

### Task 7: Add observability and acceptance verification

Objective: prove refreshes stop re-downloading asset payloads.

Files:
- Create: `docs/qa/asset-cache-checklist.md`
- Add tests where possible in `tests/`

Manual verification:
1. Open DevTools Network tab.
2. First load: observe expected asset downloads.
3. Refresh once.
4. Confirm GLBs/textures show memory cache, disk cache, service worker, or 304 instead of full transfers.
5. Use Application tab to inspect Cache Storage entries.
6. Revisit after closing/reopening browser.
7. Confirm cached packs remain available.

Acceptance criteria:
- Normal refresh does not fully re-download stable game assets.
- Ground/background textures no longer get unique timestamped URLs.
- Previously fetched GLBs are served from cache on refresh when unchanged.
- Users can intentionally download at least a core asset pack.
- Cache version can be invalidated cleanly when art changes.

---

## Important design choices

### 1. Prefer stable URLs over runtime timestamps
Bad:
- `ground_texture.png?v=${Date.now()}`

Good:
- `ground_texture.png`
- or `ground_texture.png?v=app-build-42`
- or hashed filenames from a build pipeline

### 2. Don’t pre-cache the full asset library by default
Because the asset set is huge, full pre-cache is risky.

Better:
- cache on demand when encountered
- allow explicit pack downloads
- reserve full-library download for desktop users who opt in

### 3. Keep app shell and asset caching separate
You want fast app updates without forcing re-download of giant art files.

So:
- HTML/app shell updates frequently
- large art assets remain immutable and versioned independently

### 4. Let browser cache + service worker complement each other
Best stack:
- HTTP cache handles the common case cheaply
- service worker adds explicit persistence, pack warmup, and version control
- `MeshFactory.cache` continues handling in-memory object reuse

---

## Likely minimal first PR

If we want the fastest path to a meaningful win, do this in PR 1:

1. Remove `Date.now()` asset query strings from `RenderSystem.js`
2. Add stable asset manifest scaffolding
3. Add service worker registration and cache-first handling for `/assets/`
4. Add core-pack warm-cache button in settings or login screen
5. Add deployment cache header docs/config

That PR should already stop the "re-download every refresh" problem for most assets.

---

## Main risk areas

1. Browser storage quotas
   - Especially on mobile/Safari
   - Mitigation: pack-based downloads, not all assets at once

2. Asset updates becoming sticky
   - If immutable caching is used without versioning, users may keep stale art
   - Mitigation: cache version names + manifest versioning

3. Current hosting topology may differ from repo assumptions
   - I found the client files in repo root, but repo-managed server config does not clearly document asset-serving headers
   - Mitigation: verify the actual static asset host before implementing deployment changes

4. Startup load is already heavy
   - Don’t add mandatory full-pack downloads to first boot
   - Make warm-cache explicit and backgroundable

---

## Recommendation

Recommended approach: implement Layer 1 immediately, then Layer 2 with a curated core-pack service worker. That gives the best balance of speed, low risk, and visible improvement.

If you want, I can turn this plan into an implementation PR next, starting with the smallest high-impact fix: remove runtime cache-busting and add persistent asset caching plumbing.