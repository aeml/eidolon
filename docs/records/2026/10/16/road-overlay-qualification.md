# Roads behind names and auras

Qualified runtime: `6d479b837b8343e8c592e1cc9846e6d5f74cf1e0`.

Transparent road ribbons previously shared default draw order zero with actor
names and aura visuals. A long ribbon's sort center could place the entire road
after a nearby foreground overlay. Name sprites already disable depth testing;
that alone cannot prevent a later transparent road from painting over them.

All authored Earth/Water/Fire/Air road meshes now draw at order -0.5, after
blackwater (-1) and before default actor overlays (0). Road depth testing remains
enabled, depth writing remains disabled, and geometry, material appearance,
elevation, terrain conformance, shadows and interaction remain unchanged. This
does not make aura effects ignore opaque world occlusion.

Two native GPU High/Low cases cover 48 views: four realms, two camera directions,
and actual Fighter name, Skeleton name and Well Rested visuals. Every corrected
view exactly matches an independent two-pass reference that renders ground/road
first and the actual overlay second with the depth buffer retained. Every road
and overlay has a nonzero pixel signal. Restoring the original order reproduces
incorrect pixels in eight player-name, four mob-name and eight aura views.
Both renderer canvases retire. Cases pass in 7.2 seconds without retries and join
the existing bounded native art stage.

The first fixture included actor bodies; its two-pass reference differed at
unrelated transparent/antialiased body edges. Those failed results are retained.
The corrected fixture isolates the production name sprites to answer the overlay
question; aura comparisons were already exact. No runtime change or pixel
tolerance relaxation was used to resolve that fixture finding. Seventeen focused
checks across three suites, eighteen routing checks across two suites and full
lint also pass.

Closed private evidence:
`/home/aeml/.local/share/eidolon-road-layer-20261016/.qa-road-layer`.
The twenty-file inventory SHA-256 is
`e129ec33dba117018fda61ad4fbf1099600f89912b7313161aa5ca96a1a3360d`.
This source is qualified for the next coherent milestone; deployment acceptance
is separate. The full game/readiness goal remains active and soak/stress stays
deferred.
