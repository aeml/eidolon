# Alpha 1.79.86: casino layout, results and loading recovery

Source `4bfafdd62b81db2dd0037b33bf6947da8e811351` passes its original ten-job [CI39301167062](https://github.com/aeml/eidolon/actions/runs/39301167062),
both deployments and live QA. No manual workflow retry or cancellation occurs.

Casino windows retain their 92vw/92dvh layout, movable top bars and remembered
placement. Six house seats, dealer, Baccarat cards, reconnect status and clocks
stay distinct. Roulette uses a larger foreground wheel with a separate clock/
skip footer; saved win feedback follows the known landing. House win messages
keep cards visible. Poker distinguishes returns from net profit/loss, earlier
wagers retain their owner when a chair changes hands, and Rules popups remember
their visible position when closed during a held drag.

Geometry shard downloads recover once after a transient network failure or
their own timeout. Each attempt retains 1500ms; the serialized queue, shared
cache, 30s delivery owner and exact content/index checks remain. Reader cleanup
preserves the original failed-read classification. HTTP errors, invalid data
and exhausted failures remain unavailable with the existing dynamic fallback.
The privacy fixture retries one ECONNRESET GET, never HTTP errors or writes.
The synthetic recovery worker stays alive through exact trace response-body
capture and uses the public shard's max-age=600 cache policy. Checks still require exactly two application fetches and two HTTP requests,
including canceled-request evidence.
Minimum-aware QA planning finds a visible full jump destination while retaining
the eight-unit minimum, strict real Ctrl-click, directional server movement and
landing checks. No game movement/camera, money, odds, settlement, schema/
protocol, model or precomputed-data rule changes in these corrections.

CI records 823 client suites / 12,833 checks, 566 hosted browser passes / 14
existing exclusions, 184 native passes / 2 existing exclusions, and 11 live
passes / 1 existing exclusion. Every browser job has zero failed/flaky outcomes.
Local qualification passes five focused SDK-default Headless Shell 149 browser
cases with CI recordings enabled, followed by all 34 cases in the third browser shard’s layout stage, without retries, failures, flakes or exclusions. Two controlled private
CDP cases demonstrate the cache/resource-retrieval difference. The scopes
overlap and are not summed. The 80 focused checks in four suites and 18 compiled-client cases from
`9d34764040b8f690a9ae2a58e564c4249672aaab` remain valid after exact runtime
and build input comparison;
all 18 report hardware AMD RADV RENOIR. The 455 release/history/workflow checks
pass freshly. Earlier selected UI qualification covers 49 source cases and 57
house/poker/window checks. All 520 prior raw note strings remain identical in
521 cumulative entries and 52 lazy pages.

Normal-TLS frontend/backend identities match the source and Alpha version. The
database is ready, registration stays open and terrain remains flat-v1. All
442 current public-file pins match the exact own-run Pages
artifact. 110 unchanged GLBs reuse accepted85 normal-TLS proof only
after exact current-artifact byte comparison. The rebuilt worker is
`835578df97d6ade3683f781b95caf5aa4fd9b71d047fa5353f7a83798ce0d04a`
(179,747 bytes); precomputed data and analytics remain unchanged. Four receipts
and their inventory are frozen read-only. Inventory SHA-256:
`c28d92bc6a781ea2fc62552c2ab0ad351a81afc53c291438fa189c82913beb1c`.

Original ddbd001ca fails six hidden-dealer cases in CI39253417949 and does not
deploy. Intermediate4beea1f26 deploys but CI39260318063 retains one privacy
fixture flake and an unrecovered live geometry abort. Source5c5540fed passes
client/hosted/native checks but CI39275253270 fails before a jump: the coarse
projector picks 7.762 units below its unchanged eight-unit minimum; later live
steps never run. Its failed route has zero asset-delivery failures. Original
logs and digest-verified raw failed browser/live artifacts retain these outcomes.
Native stream and projection baselines reproduce both follow-up defects. A
first body probe returns correct indices but counts a third server request.
Original eaac/CI39290576738 then fails the same body fixture on initial and
configured retry; four jobs pass and five downstream jobs are skipped. It does
not deploy. Its digest-verified raw archive and inline attachments retain both
failed attempts with two application fetches and three physical GETs. A local
SDK-default Headless Shell 149 probe with CI recordings reproduces the failure
without retries. The lifetime-only d562/CI39295983719 also fails on initial
and configured retry despite exact recovered body bytes; four jobs pass and
five are skipped, with no deployment. Both failed raw archives and their inline
attachments are retained. Worker lifetime alone was insufficient. A controlled
CDP command adds a physical GET with no-store but returns identical bytes from
cache with the public max-age=600, retaining two application and server requests.
The original hosted inspector-empty-body trigger was not directly recorded.
Matching that public header passes the five focused cases and exact 34-case
layout stage with recording enabled. Both original request assertions remain.
Earlier full-Chromium149 recording-off and intermediate local-only passes are
retained with their narrower scopes.
No failed outcome, assertion, game/request timeout or delivery collector policy
is waived. [Detailed qualification](2026-10-19-casino-poker-result-clarity.md).

This accepts the scoped implementation and deployment. The owner reports that
the current casino presentation “all looks much better now.” Art review for
the whole game, physical devices, human campaign/listening, world performance,
operations/rights, F1–F5, beta and the full game goal remain open. Soak/stress
remains deferred.
