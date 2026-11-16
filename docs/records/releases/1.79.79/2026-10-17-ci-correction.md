# Alpha1.79.79 regional cache assertion correction

Initial source `6777679f690840b589131ab658401e4e1115f50b`,
[CI39077567621](https://github.com/aeml/eidolon/actions/runs/39077567621), fails
four existing regional-relic checks:803client suites/12517cases pass, one suite/
four cases fail. The client failure blocks native/deployment prerequisites;
remaining initial jobs may finish normally. No job is retried or cancelled.

The regional test retained an exact25-geometry count:20fixed shared shapes,
four old floor compositions and one boss dais. The selected dungeon milestone
uses eight distinct purpose plans, so the intended total is29. The earlier
floor qualification already records four additional cached geometries and
232,320additional CPU attribute bytes. This is a stale test expectation, not
an unbounded runtime cache or a newly permitted scene budget.

Correction source: `ac6702f73c03a2b7540c9788bdbc804374d9f650`.
The test now requires20fixed shapes, eight distinct floor geometry identities,
one dais and29total shared geometries. Repeated raw rooms must reuse the exact
same floor object and leave the cache count unchanged. Existing texture/material,
physical finish, batching, triangle, bounds, disposal and Verdant checks remain.
All15cases in the affected suite pass in4.657seconds; lint/whitespace checks pass.
No new test case, runtime change or relaxed visual/performance limit is added.

Client/runtime, assets, index and server trees remain byte-identical to the
initial79source. The qualified native dungeon evidence remains valid within its
original scope and is not replayed for a test-only correction. Cumulative notes
and synchronized version stay1.79.79. The corrected source still needs its own
CI/deployment/public verification before acceptance; accepted live78remains the
previous release. Future combat-effects/recovery work is excluded from this fix.

Private evidence:
`/home/aeml/.local/share/eidolon-dungeon-masonry-assembly-20261017/.qa-regional-cache-correction`.
The frozen six-file `evidence.json` SHA-256 is
`341aaf5bd6a5df42036085fc8e4719219e6d30090af5c80fe54f9fdfc5da232d`.
It preserves the actual failed CI client log, old/corrected test bytes, focused
pass, lint and qualification. Original failed release observation stays retained.

Full original game/world/art/combat/audio/performance/device/security/operations/
owner/F1-F5/beta/1.99scope remains active. Human campaign/phone feedback and
soak/stress remain deferred, not passed.
