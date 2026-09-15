# Sign photos

Requires migration `20260915130000_sign_photos`, private bucket access to `sign-photos/*` and `quarantine/*`, and `SIGN_PHOTOS_ENABLED=true` with `ALLOCATION_PLAN_SIGNS_ENABLED=true`. Photos defaults off. This does not enable an Organization image library.

Completion verifies PNG/JPEG bytes, checksum, size (5 MiB), full decoding, single image and a 40-megapixel input bound with a 10-second decoder timeout. A metadata-free, oriented PNG thumbnail (up to 640px per side) is generated privately. Original downloads retain original metadata. PDF is rejected. No malware-scanning claim is made.

Smoke test with generated images only: upload multiple files, reload, inspect list/grid, download and compare original bytes, cancel deletion, then confirm deletion. Verify other Signs and Docs remain unchanged. Read-only users can read/download but cannot upload/delete. `SIGN_PHOTOS_INTEGRATION=true` runs database tests; `SIGN_PHOTOS_LIVE=true` additionally exercises the configured private bucket and cleans up its generated fixture.

The SignPhotoObject ledger survives individual photo and shared Sign deletion. Access is revoked immediately by metadata deletion; objects are reclaimed after signed PUT expiry plus a one-minute grace period. The minute cleanup loop processes up to 100 due entries. Completed records retain a ledger entry for subsequent deletion. Failed storage operations retain retry work; restore bucket access and allow the next pass. Never manually discard cleanup entries before verifying all three objects (quarantine, original, thumbnail) are removed.

Monitor categorical `sign_photo_request_success`, `sign_photo_request_failure`, `sign_photo_download_success`, `sign_photo_delete_success`, and `sign_photo_cleanup_failed` logs. Do not log filenames, bytes or signed URLs. Disable the feature flag on repeated access, decoding or storage failures; leave metadata and the cleanup worker intact. Production deployment is not part of this change.
