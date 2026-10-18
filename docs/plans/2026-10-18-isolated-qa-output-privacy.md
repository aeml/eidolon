# Isolated QA output-path and credential handoff qualification

Qualified source174356bf1c6f8a191b5c56d9a02467c8870130b1. This changes test
artifact handling, not published game/server inputs: those remain byte-identical
to native-qualifiede05d7f296a99c0986ea413bf8aba8a3884629a69. The component is
selected for82; its own release CI/deployment acceptance remains pending.

All four actual connected wardrobe cases passed. Their wrapper then reported
zero sanitized files because its default roots were playwright-report and
test-results, while this run configured a different HTML directory, explicit
JSON report file and CLI output directory. The generated fixture credentials
were available inside that wrapper but not to its caller after it exited.
Decoded retained report JSON contained one issued synthetic account base and
one48hex fixture password. The disposable database was removed. This finding
concerns run-created test evidence; it does not establish a production-account
or server-admission compromise. Earlier scoped parser/alpha acceptance does not
waive this output-path gap or certify the entire F2 review.

The wrapper now calls qa-evidence.sh before losing its generated credential
environment. The helper preserves the default roots and adds configured HTML,
the exact JSON report file and the last CLI --output value. Both --output=value
and --output value preserve paths containing spaces. The scanner accepts a
regular file root without scanning its parent or neighboring files. Existing
bounded HTML ZIP/inline-JSON decoding, image treatment and credential variants
remain unchanged. Malformed/unsupported inputs still fail their existing guards.

One new direct-file regression first fails against the original scanner, with
two helper cases unselected. Its first attempted Node test environment failed
in the repository Canvas setup before executing cases; that setup observation
is retained separately and is not defect proof. Final28checks/two suites pass
in21.042seconds, including all25existing privacy cases and three new actual
scanner/shell cases.32native/enrollment checks pass in0.766seconds. Changed-file
lint, shell syntax and whitespace checks pass.

The actual corrected helper additionally processes copies of the completed
connected report using its configured HTML/JSON/CLI roots and recovered test
values held only in the child environment. It sanitizes two files. Decoded HTML
ZIP/JSON and all eight inline JSON attachments contain neither known credential;
four-case results, private-pose observations and all36wardrobe phases remain.
The33-file original private inventory stays unchanged, SHA256
`f4da4c8126c61e167ab98260d46e6e910752cb46ece755048100d4b05fe8129d`.
No known values were printed. PNG pixel redaction is not claimed; the captures
belong to synthetic local fixtures, not physical-device or owner-art approval.

The five-file original source/negative packet retains inventory SHA256
`597d60ea2fe62c9fb56b4303764684e547cf711f7181e566676443a3aa1f7d73`.
Eight final source/log/actual-report qualification files retain inventory SHA256
`d04333934648fe81dfb6bdcdaa9923ef10db5fdbbdaa6bb9465383b04bdad21d`.
Packets are under `.qa-garment-pose-inspection/qa-evidence-privacy-original` and
`qa-evidence-privacy-qualified` in the owned pose worktree. The actual sanitized
connected packet has37files, inventory SHA256
`ef8f5236593cf8c5de28b663c5b555d4fb518be0ed1db643547327e3cb23aad9`.

The unchanged game inputs permit reuse of their completed46native functional
cases. The report correction is independently exercised on the actual data;
repeating those gameplay cases would not strengthen this artifact-only check.
The release's complete own CI/live/public verification, wider F2/owner/operations,
art/performance/device/campaign and beta/1.99 requirements remain open.
