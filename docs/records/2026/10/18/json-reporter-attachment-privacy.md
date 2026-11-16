# JSON reporter attachment credential redaction

The retained native movement failure exposes a scanner gap: Playwright's JSON
reporter encodes inline attachment bodies as base64. The existing scanner masks
plain text and escaped JSON and rebuilds compressed HTML report data, but those
checks alone do not inspect the JSON reporter's decoded bodies. Two focused
negative cases reproduce the gap on the original scanner, including an inline
JSON report nested inside another report attachment.

The correction recognizes the JSON reporter shape and inspects its inline text
and JSON bodies. It validates canonical base64, UTF-8 and JSON before masking
credentials, then re-encodes changed bodies. Ordinary diagnostic fields, failure
statuses and geometry/movement numbers remain. Repeated scans preserve bytes.
Known binary images remain untouched; no image-pixel redaction is claimed.
Unsupported inline formats, including archives, fail before the file is written.
Existing raw trace/video refusal and HTML/anonymous behavior remain.

Evidence bounds are explicit:16MiB per decoded body,64MiB cumulative input,
4096bodies, eight nested reporter bodies,128structural levels and one million
visited JSON nodes. Invalid encoding, noncanonical padding, invalid UTF-8/JSON,
oversized or overly nested bodies fail with generic errors that do not print
their contents. No artifact path extraction, network, game/server rule or test
deadline change is introduced.

All25privacy checks pass in14.457s. They include real Playwright HTML and JSON
reporter output from the same deliberate passed/failed fixture, nested bodies,
plain text, binary-image preservation, malformed/bounded refusal, existing raw
recording controls and byte-stable second scans. Changed-file lint and diff
checks pass. The initial call-format lint finding is corrected without changing
the checks. Both original negative cases remain retained.

A copy of the earlier failed actual native gameplay JSON report contains ten
inline JSON bodies and four synthetic names hidden from the original outer-byte
scan. The corrected scanner removes all four from decoded bodies, preserves
the original failure/result statuses and aggregate stats, and remains byte-stable
on subsequent scans. The frozen original report stays byte-identical. This is
artifact qualification, not another native/API attempt or acceptance of that
failed gameplay route. Historical frozen evidence is not rewritten and prior
plain-text scans do not imply this newly covered format was sanitized.

Private qualification is under `.qa-inline-attachment-scanner` in the owned
correction worktree. This component is prepared for the continuing release
assembly; pending81 still requires its own CI/deployment verification before
another release is published. Original game, performance, device, art,
operations and beta scope remains active. Soak/stress remains deferred.
