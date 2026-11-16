# Court texture reference correction

The first Alpha 1.79.73 source, `f4109c6da6bb45094db434ab2ff9f2c8c06176fb`,
failed two client cases in CI run `39035013643`: the High and Low
`WorldRasterOwnership` court tests still referenced the superseded court artwork.
The job completed with 799 passing suites, one failing suite, 12,391 passing
tests and two failing tests. That source is not deployment-qualified.

Update only the four court color/surface hashes in
`tests/fixtures/world-raster-reference.json`. Their byte lengths and the other
eight raster records remain unchanged. The test assertions still require exact
bytes, independent owners, independent upload buffers, mutation isolation and
correct returning-owner content. No rendering, resource lifetime, test count,
scene budget or production asset changes are included in this correction.

The new hashes were recorded before this failure in the selected court review's
`map-comparison.json`, whose closed 135-file inventory has SHA-256
`c0fd4787351d137112bccdb9afe16e44ed26a32f672b5742066637b83ec7e097`.
All 135 payloads were reverified before using that reference. The current court
module retains the reviewed SHA-256
`408ac9a936cbf8e259da2b954da310444b280a100c87ff3c348306b3fc6c4442`.
Fresh High and Low outputs must match those previously frozen hashes; current
failed output alone is not the reference authority.

Local validation passes all 18 existing cases across `WorldRasterOwnership`,
`LanternholdPaving` and `LanternholdCourtyards` (33.653 seconds). An independent
source/reference check matches all four frozen court hashes and verifies that
the other eight raster records and all byte lengths remain unchanged.

The corrected source needs its own successful CI, deployment and public
verification. Alpha 1.79.72 remains the accepted public baseline until then.
Final world art, full-game performance and the broader game goal remain open.
