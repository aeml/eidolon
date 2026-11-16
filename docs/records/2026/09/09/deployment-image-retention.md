# Retain the rollback image before replacing the build tag

Release 57 run34347504351 attempt1 passed all predeployment gates, then failed
at12:50:58UTC after schema7→8 preflight. `docker image save` could not resolve
the previous API's image8754f0b8. The fail-closed backup trap restarted the exact
previous container; schema8 did not start. Pages had published57 while the healthy
server remained56. That partial deployment was not accepted.

Both local and production Docker29.7.2 use the containerd image store. A new
build replaced the shared `eidolon-api` tag and the prior image was no longer
inspectable, despite its running container retaining that image identity. This
matches the upstream report <https://github.com/moby/moby/issues/48907>.

## Operational recovery of57 (no application-source change)

- Exact previous container image:
  `sha256:8754f0b84404440e298730d7a5cacb665eb06129d09fd60360b98724cc952e88`.
- Its BuildKit history record `tb7d6phk6ub40cq5ojdqgn0xp` identifies production
  source31c7d9fc3bedce839b2f83b4146060ddaa5875aa and linux/amd64 manifest89e88940.
- A separate rebuild of the old source was retained for diagnosis, but was NOT
  substituted for the missing image: its image identity differed.
- Read-only build-history retrieval verified the original config, every runtime
  layer, manifests and index by their original SHA256 and byte lengths. An
  optional build-attestation payload was not retained by BuildKit. The first
  complete-attestation attempt failed without loading an image. Loading the
  platform-only archive also initially required the attestation manifest metadata;
  retaining that metadata allowed Docker's linux/amd64-filtered import to succeed.
- The restored image has the EXACT original image ID and runtime manifest.
  Its distinct `eidolon-api:rollback-31c7d9fc-20260909` tag is retained. Docker's
  normal, unmodified `image save` succeeds. No player data was read/restored and
  no running container was changed by that image-reference recovery.
- Archive `/tmp/eidolon-exact-image-VoQmYX/previous-exact-image.tar` and operational
  script `/tmp/eidolon-image-recovery-tools-GB6y7J/recover.mjs` are retained locally.
- Only failed jobs were rerun for34347504351. Server deployment passed with the
  unchanged57/8af54f2 application; final live QA is still required.

##58 prevention fix

Under the existing deploy lock, BEFORE `compose build api`, resolve the exact
previous container image, require it to remain inspectable and create/verify a
digest-derived rollback tag. Missing images, multiple/invalid container identities,
tag failures and tag collisions fail before build or downtime. Fresh installs
need no previous pin. Pins are retained without automatic deletion.

The required stop→immutable-image/database/private-journal backup→checksum/sync→
COMPLETE→target-start gate remains intact. Neither migrations nor backup requirements
are weakened. `backups/` is additionally excluded from Docker build context; private
archives must not become build cache contents on the next release.

Verification: the preflight regression first failed the compatible/upgrade order
and missing-image fail-closed cases, then passed after the fix. Eight helper cases
exercise exact pin/idempotence/fresh-install and fail-closed paths. Focused Go race
pass1.253s: `/tmp/eidolon-deploy-image-pin-focused.log`.

Actual owned Docker integration changes its unique API build tag from a previous
image to a different replacement AFTER pinning. It proves the previous exact ID
survives, archives/restores Mongo resources/receipts/schema/indexes and private
journal ownership, and verifies failed dump restarts only the previous API.
PASS15.61s (Go16.624s), projecteidolon-backup-proof-1788959026563377846,
`/tmp/eidolon-deploy-image-pin-disposable.log`. Cleanup removes only that test's
Compose project/volumes and two unique image references, not production pins.

Final disposable replay also builds a real Docker context using the production
`.dockerignore`, includes private sentinel archives/journals/environment in the
input, and asserts none is copied into the image. PASS15.20s backup +1.21s context
(Go17.433s), `/tmp/eidolon-deploy-image-pin-disposable-r2.log`. CI explicitly runs
both disposable tests. Production57's actual backup receipt at
`server/backups/save-upgrade-20260909T130106Z-boTz4I/COMPLETE` names8af54f2 and
13:01:08UTC. All four recorded SHA256 checks and three gzip integrity checks were
independently revalidated; prior image identity remains8754f0b8.

The earlier full58 gameplay pass on e73be3a remains evidence for its unchanged game
runtime. This supplement changes deployment tooling/tests/build exclusion and one
patch-note bullet only. New source validation and all normal58 CI/production/native
recovery gates are still required before reporting town recovery delivered.
