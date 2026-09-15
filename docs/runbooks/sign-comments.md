# Sign Comments

Requires migration `20260915140000_sign_comments`, private bucket access to `sign-comments/*` and `quarantine/*`, and both `SIGN_COMMENTS_ENABLED=true` and `ALLOCATION_PLAN_SIGNS_ENABLED=true`. The flag defaults off. No notifications, Organization library, Site Activity, or schedule comment-cell synchronization is enabled.

All current Site-access members with COMMENT capability, including Viewers, can participate. Draft attachments remain private to their uploader until atomic comment submission. PNG/JPEG/PDF uploads are limited to 5 MiB each and five per comment. Image completion uses the bounded metadata-free thumbnail decoder; original downloads retain metadata. PDF signature verification is not malware scanning.

Run `SIGN_COMMENTS_INTEGRATION=true` with the local database environment to execute the comment and attachment integration suites. These create and clean up generated Sites and users. Browser tests in `sign-comments.spec.ts` exercise the fixed composer geometry, posting, replies, mentions, and reactions against isolated Storybook fixtures. Do not use customer comments or uploaded media as test fixtures.

The independent SignCommentAttachmentObject ledger survives Sign deletion. Unverified drafts expire after 15 minutes; verified unpublished attachments expire after 24 hours. Cleanup runs every minute in batches of 100, observes an additional one-minute upload grace, and retains ledger entries after storage failures for retry. Bound attachments remain readable until their Sign is deleted or access is revoked. Never delete ledger entries manually before verifying quarantine, original and thumbnail removal.

Monitor categorical `sign_comment_request_failure`, `sign_comment_download_success`, and `sign_comment_cleanup_failed` events. Logs must not include text, filenames, mention queries, bytes or signed URLs. Disable the flag to roll back the UI/API while keeping the cleanup worker and metadata intact. No production deployment is included.
