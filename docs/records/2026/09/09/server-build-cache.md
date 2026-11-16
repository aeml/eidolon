# Preserve dependency caches across release identities

Unpublished primary-candidate build-only improvement, not a change to queued
54–58. `BUILD_COMMIT` and `BUILD_VERSION` now enter the builder after dependency
installation and source copy, immediately before compilation. Their defaults,
linker use, Go version, runtime image, non-root user and deployment checks are
unchanged. Each release still relinks its own executable.

The new Dockerfile ordering regression failed both metadata declarations on the
old layout. After the change, Go1.24.5 race tests passed the ordering check and
all deployment-preflight scenarios in1.367s. Logs
`/tmp/eidolon-docker-cache-{before,after}.log`.

Two real Docker builds used distinct commit/version probe strings. The second
build reused the package-installation, Go-module download and source-copy layers
(`CACHED`), but executed the linker again with its new values. Binaries copied
from the two images contain their respective unique commit/version strings;
`go version -m` confirms Go1.24.5/linux/amd64/CGO_DISABLED/trimpath, but does not
expose the linker values in these stripped builds. This is build-artifact
evidence, not a deployed health-endpoint check or a measured full-CI speedup.

Both builds and their extracted binaries are retained at
`/tmp/eidolon-docker-cache-proof-tjeq3D`, with source logs
`/tmp/eidolon-docker-cache-build-{a,b}.log`. The two never-started extraction
containers and the exact probe image tags were inspected and removed. No game
server, database, shared build cache or unrelated workload was removed.
