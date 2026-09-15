# Sign documents

Feature: `sign-documents`. Requires the additive `20260915120000_sign_documents` migration, private allocation object bucket permissions for `sign-documents/*` and `quarantine/*`, and both `SIGN_DOCUMENTS_ENABLED=true` and `ALLOCATION_PLAN_SIGNS_ENABLED=true`.

Local smoke check: upload PNG/JPG/PDF in a Sign's Docs tab, reload, download and compare bytes. Verify another Sign does not list those files. Delete the test Sign and verify downloads are denied. Do not use real user documents for destructive checks.

Uploads expire after 15 minutes. The durable SignDocumentObject ledger survives Sign deletion through either view. The API cleanup loop scans up to 100 entries each minute, waiting at least one minute beyond upload expiry before removing temporary objects. Completed documents retain a ledger entry and are revisited so subsequent Sign deletion removes their objects. Failures preserve the entry for retry; logs use `sign_document_cleanup_failed`. Restore bucket connectivity/permissions and allow the next pass to retry. Do not delete ledger entries manually before confirming object removal.

Monitor categorical `sign_document_request_success`, `sign_document_request_failure`, `sign_document_download_success`, and `sign_document_cleanup_failed` logs. Investigate repeated failures, authorization errors or cleanup backlog before rollout. Logs must not contain filenames, bytes or signed URLs. Rollback disables the UI/API flag while preserving data and the cleanup loop. No malware scanning is claimed: downloads are private attachments, never inline previews.
