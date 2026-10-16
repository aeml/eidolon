# Western town paving and elemental travel review

The western Lanternhold paving now follows the clear service and residential
lane to the west gate. The previous diagonal crossed the planted rest edge and
a residential wall. The new shared surface path bends around both. Physical
colliders, buildings, furniture, residents and geometry remain unchanged.

Qualification on `c297ab942`:

- All 232 generated town collision boxes are included in the route countercheck.
  The original auction-hall chord and subsequent planter/house shortcuts fail;
  the selected service/residential lane clears the actual generated geometry.
- 48,441 deterministic field samples locate all 1,599 changed samples inside
  x=-101..-2, z=193..235. No sampled field outside the western patch changes.
  The west-gate connection at (-80,200) changes from no paving to full paving.
- Two native High/Low comparisons cover four views each, using frozen,
  source-identified Alpha 1.79.66 mask bytes. Draws and triangles are identical,
  reference restoration is pixel-exact, the original upload pointer is restored,
  and both owned masks and the canvas retire. Both terrain composition and world
  geometry use the selected quality. The earlier fixture used High world geometry
  for its Low composition case; that result is retained and its scope corrected.
- Generated collision parity, full lint and 40 distinct focused checks pass.
  The mandatory native release stage includes both paving cases with no retries.

The prepared High Fighter reaches the Molten approach through normal ground
clicks: 187.375 seconds, 1,802 captured frames and 225 observations. Every recorded
observation is alive, grounded and equipped with all fourteen visuals. The
subsequent four-class single-renderer party, normal socket peers and saved
fourteen-slot persistence check pass under the Go race detector.

The two earlier Fire test routes stopped before submitting blocked pointer
input: first at the rotated auction hall, then at the service rest edge. Their
closed failures remain retained. The original four-building subset check omitted
furniture and homes; the selected route uses the complete generated town data.
No collider was removed or bypassed. The specific sole native collider is not
claimed from a screenshot or a separate CPU reproduction.

The Air route also passes on its first native attempt: 229.993 seconds, 2,187
frames and 236 alive, grounded, fourteen-slot observations. It follows every
authored Bastion bypass and Air passage waypoint to the Tempest approach. Its
subsequent four-class party and save/race check also pass.

Existing Earth and Water routes and deadlines are exact.
Only the new 2.4–2.6 km Fire/Air cases receive separate 240-second route bounds.
All original frame, draw and triangle limits remain unchanged. These prepared
visual walks and separate party/save checks are not an earned campaign,
encounter clear, strict FPS certificate, physical-device test or final owner art
approval. Soak/stress and human pacing/phone feedback remain deferred.

Private retained evidence resides in the owned elemental review worktree under
`.qa-elemental-travel`. Synthetic credentials in closed records and HTML reports
are scrubbed; captured image pixels are not claimed to be redacted.

Recorded moving-route draw counters reach 946 on Fire and 668 on Air; the named
Tempest approach sample reports 404. These exceed the retained 350-call target.
The separate 180-frame party windows report 16.7/33.4 ms median/p95, with
269/194,156 Fire and 252/194,736 Air median calls/triangles. These different
windows neither clear prior frame failures nor prove a paired speedup. The cause
of the moving draw peaks remains unproved; no budget or assertion is relaxed.

Frozen qualified evidence inventory: 4,083 files, SHA-256
`bea07a73f219f6c2f5cda9a0b4a086c12eb00ee3adc191de9c20f891233744fb`.
The first rejected Fire inventory remains
`7b7c45d0703e1223ae795e8f692073c72d278ab76be6eb1c7e94e5a56819ae9d`;
the second remains
`73fd05f6931edbe35a948a6c92f5eb15de9a747d343555e1fab053e17638c89d`.
