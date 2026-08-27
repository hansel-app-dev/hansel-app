# Feature: User onboarding

- ID: `onboarding`
- Status: `approved`
- Owner: `Hansel product`
- Technical owner: `Hansel engineering`
- Last updated: `2026-08-27`

## Problem

Hansel needs a secure, accessible onboarding journey for people who create a new organization or accept an invitation to an existing organization or site. The Figma prototype defines the intended sequence and information architecture, but it does not fully define identity, invitation, billing, validation, persistence, or failure behavior. Implementation must not infer those missing product rules.

## Outcome and success metrics

After this specification and its open questions are approved, an eligible person can complete the appropriate onboarding path without entering unrelated information, losing confirmed progress, joining the wrong tenant, or receiving permissions beyond the invitation. Success is measured by completion rate per entry path, abandonment rate per step, verification-code delivery and completion rates, invitation acceptance success, validation failure rate, and time to completion. Metrics must not contain passwords, verification codes, invitation tokens, free-text answers, or unnecessary personal data.

## Non-goals

- Standalone login, logout, password-reset, session-management, and account-lockout screens are governed by separate authentication specifications; the cross-cutting credential, session, and recovery security contracts required by onboarding are recorded here and MUST be reused by those specifications.
- Creating, sending, revoking, or administering organization and site invitations is not part of this feature; this feature only consumes a valid invitation.
- Dashboard behavior after onboarding is not defined here.
- Production pricing, entitlements, taxes, invoicing, refunds, disputes, dunning, and ongoing billing support require a separate approved billing-lifecycle specification. This onboarding slice is authorized only for the approved dummy plan catalog and Stripe test mode.
- Social identity-provider implementation is not authorized merely because Google, Microsoft, and Apple controls appear in Figma.
- Compromised-password or common-password blocklist screening is explicitly excluded from the first release by product decision. This is a documented deviation from current NIST password-verifier guidance and MUST NOT be represented as NIST SP 800-63B conformant; adding screening later requires an approved specification amendment.
- The Figma laptop presentation frame is not a requirement to render a laptop image in the product UI.
- No unobserved fields, steps, taxonomies, responsive layouts, animations, or authorization rules may be invented during implementation.

## Requirements

- REQ-001: The onboarding entry context MUST be exactly one of `new-organization`, `organization-invitation`, or `site-invitation`, and the server MUST derive invitation context from a validated opaque invitation credential rather than caller-supplied organization or site identifiers.
- REQ-002: The new-organization path MUST follow the Figma sequence: account creation, account verification when required by the approved identity method, personal profile, plan selection, payment only when required by the selected plan, organization profile, optional discovery questions, and completion.
- REQ-003: The organization-invitation path MUST identify the inviting organization, collect only the account and personal-profile information required for that person, and MUST NOT ask the invitee to create another organization, select a plan, or provide payment.
- REQ-004: The site-invitation path MUST identify the invited site and its owning organization, collect only the account and personal-profile information required for that person, and MUST NOT grant access to any other site or organization resource unless separately authorized.
- REQ-005: An email-and-password account-creation form MUST accept email and password, associate visible labels with their controls, describe the approved password rules, validate required values on both client and server, and display field-level validation without exposing whether an unrelated account exists.
- REQ-006: Email verification MUST use a cryptographically random six-digit numeric code valid for 15 minutes. The verification step MUST identify the destination in a privacy-preserving form, accept all six digits, and continue only after server-side verification. Each code MUST permit at most five failed attempts; reaching the limit invalidates it. A successful verification MUST consume it. Invalid, expired, superseded, consumed, or attempt-exhausted codes MUST be rejected with a generic recoverable response. The Figma statement that a code is valid for 24 hours MUST be replaced with the approved 15-minute policy.
- REQ-007: Requesting a replacement verification code MUST be unavailable until 60 seconds after the last send and MUST be limited to five sends per normalized email address per rolling hour, with additional layered abuse controls. Issuing a replacement MUST immediately invalidate every previous code for that verification subject. Verification and invitation secrets MUST be cryptographically random, single-use, stored only as keyed non-reversible digests, compared safely, scoped to their purpose and subject, and protected by expiry, attempt limits, resend throttling, and abuse monitoring. Send and attempt counters MUST be enforced server-side and safely under concurrency.
- REQ-084: The email-verification page MUST follow Figma onboarding frame `52:560` (`Onboarding > New user / New organization > Step 7`) and reuse the exported Hansel logo, typography, centered narrow form layout, control styling, spacing, and underlined-link treatment established by the approved onboarding screens. Its visible copy MUST show the heading `Verify your account`; the message `We emailed you a code at {masked destination}. Enter it below to verify your account and sign in. The code is valid for 15 minutes.`; the help message `Can't find the email? Try looking in your spam folder, or you can request a new code. If you're still having problems email us at support@hanselapp.io`; an underlined `Request new code` action; and `Back` and `Next` navigation labels. The approved 15-minute policy supersedes the frame's obsolete 24-hour statement. The verification control MUST visually match the frame's 350-pixel row of six equal, separately bordered code cells while exposing one logically labelled six-digit numeric value with `one-time-code` autocomplete. It MUST accept a complete pasted or autofilled code, ignore non-digit characters, expose validation errors accessibly, and require deliberate activation of `Next` rather than auto-submitting after the sixth digit. The page MUST display a generic recoverable server-error region and MUST NOT persist the code or place it in a URL.
- REQ-008: The personal-profile step MUST collect first name, last name, job title, and department for the new-organization path. Invitation paths MUST collect first name, last name, password only when a local account must be created, then job title and department. Approved select options and `Other` behavior MUST come from versioned product taxonomies, not hard-coded display copy.
- REQ-009: The organization-profile step MUST collect organization name, country, industry or sector, type of place or service, and organization size. Industry-dependent place or service options and the size bands shown in Figma MUST be represented by stable stored identifiers and approved display labels.
- REQ-010: The discovery step MUST ask how the organization currently manages signage and may collect its biggest challenges. The entire step MUST be skippable as shown in Figma, and skipping MUST be distinguishable from providing an empty answer without preventing completion.
- REQ-011: Each path MUST expose the current step, permitted previous and next actions, validation state, submission state, and recoverable failure state. Back navigation MUST NOT silently erase previously accepted values, duplicate side effects, or bypass a required step.
- REQ-012: The server MUST own the onboarding state machine and MUST reject missing, reordered, replayed, cross-tenant, or client-forged transitions. A repeated successful request with the same idempotency key MUST NOT create duplicate users, memberships, organizations, subscriptions, or payments.
- REQ-013: Invitation acceptance MUST be atomic: validate the invitation, create or associate the user, create the least-privilege membership, mark the invitation accepted, and record an audit event in one consistent operation. An invitation MUST NOT be redeemable by an unintended email identity unless an explicit approved transfer policy exists.
- REQ-014: Onboarding progress MUST be resumable after refresh or a new authenticated session using server-authoritative state. Sensitive credentials, verification codes, invitation tokens, and payment details MUST NOT be persisted in browser storage or returned in URLs, logs, analytics, or error reports.
- REQ-015: Completion MUST be idempotent and recorded once with the entry path, completion time, and resulting tenant and membership identifiers, then use the server-derived destination in REQ-047.
- REQ-016: Every screen MUST correspond to the approved Figma onboarding source (`1:2`) and its referenced frames, reuse the Hansel design system, support keyboard-only and assistive-technology use, meet WCAG 2.2 AA, and remain usable at 200% zoom and narrow viewport reflow without relying on the prototype's laptop presentation shell.
- REQ-017: User-facing errors MUST explain the recovery action without leaking account existence, tenant membership, internal identifiers, provider responses, or whether an invitation address belongs to another person. Unexpected errors MUST preserve confirmed server-side progress and provide a correlation identifier.
- REQ-018: Frontend and backend unit-test suites MUST retain 100% statement, branch, function, and line coverage. Contract, PostgreSQL integration, accessibility, visual-regression, and Playwright E2E tests MUST cover all approved paths and material failure states.
- REQ-019: No application implementation may begin while this specification is `draft` or while any approval-blocking Open question remains unresolved. Approval MUST update this document with the selected rules and remove placeholder Figma content such as lorem ipsum and the generic payment-gateway frame from the implementation contract.
- REQ-020: Hansel MUST own and operate password authentication and session management; Amazon Cognito MUST NOT be the identity or session system. Password credentials, session credentials, rotation, revocation, expiry, concurrent-session limits, and account recovery MUST follow the approved security contracts in this specification and any narrower feature specification that references them.
- REQ-021: The first onboarding release MUST support Hansel-managed email/password plus Google, Microsoft, and Apple identity providers. External identity MUST use each provider's current OAuth 2.0 and OpenID Connect authorization-code flow with PKCE where supported, validate issuer, audience, signature, state, nonce, redirect URI, code lifetime, and provider subject server-side, and exchange the verified identity for a Hansel-managed application session. Provider access, refresh, and identity tokens MUST NOT be used as Hansel session credentials or persisted unless a separately approved integration requires the minimum necessary encrypted token.
- REQ-022: Google, Microsoft, or Apple onboarding MAY skip Hansel's email-code step only when the provider response contains an email claim that the provider explicitly marks as verified and the account-linking policy accepts that address. A missing, unverified, unusable, or policy-conflicting provider email MUST require a usable email address and successful Hansel verification before onboarding continues. Provider verification MUST NOT imply authorization to an organization, site, invitation, role, or existing Hansel account.
- REQ-023: Hansel passwords MUST contain between 15 and 128 Unicode characters inclusive after the approved input handling and MUST contain at least one Unicode uppercase letter (`General_Category=Uppercase_Letter`), one Unicode lowercase letter (`General_Category=Lowercase_Letter`), one Unicode number (`General_Category=Number`), and one Unicode punctuation or symbol character (`General_Category=Punctuation` or `General_Category=Symbol`). Whitespace MAY appear but MUST NOT satisfy the punctuation-or-symbol requirement. Unicode input, spaces, paste, password managers, and password generators MUST be supported. Account creation MUST NOT show persistent password-policy helper copy; after invalid submission, field-level validation MUST explain the applicable length boundary or missing character-class requirements. Compromised-password and common-password blocklist screening MUST NOT be implemented in this release.
- REQ-024: Passwords MUST be hashed with Argon2id using a unique cryptographically random salt per password and a separately managed application pepper stored in AWS Secrets Manager. The minimum permitted baseline is 19 MiB memory, two iterations, and parallelism one (`m=19456`, `t=2`, `p=1`); configuration MUST reject any weaker setting. Before production release, this baseline MUST be benchmarked on the production-equivalent AWS Fargate task size under representative concurrent authentication load and increased as far as capacity permits while targeting 250–500 milliseconds per hash at the measured service boundary. Parameters and algorithm version MUST be stored with each hash, successful authentication MUST rehash when the stored parameters are older or weaker than current configuration, and the service MUST enforce a bounded concurrent-hash limit with load shedding that does not disclose account existence. Pepper versions MUST be identifiable without storing the pepper, and rotation MUST use either a controlled password-reset campaign or a bounded dual-pepper migration in which the prior pepper has separately restricted access and is retired after successful rehash or the approved migration deadline. Plaintext passwords, derived password material, and peppers MUST NOT appear in application logs, analytics, traces, error reports, databases, queues, URLs, or client persistence.
- REQ-025: Registration, password authentication, verification, and recovery responses MUST resist account enumeration and MUST be rate-limited using layered subject, account, session, device-risk, and network signals with privacy-safe audit events. Rate limits MUST fail safely under concurrency, MUST NOT be bypassable by changing letter case or equivalent email representation, and MUST provide a generic recovery path without confirming whether an account exists.
- REQ-026: Hansel application sessions MUST use cryptographically random opaque credentials delivered only through `Secure`, `HttpOnly`, `SameSite=Lax` cookies in production. Access credentials MUST expire after at most 15 minutes. A session family MUST have a non-sliding absolute lifetime of 30 days from authentication, after which reauthentication is required. Session and refresh credentials MUST be stored server-side only as keyed digests and MUST NOT be exposed to application JavaScript, URLs, logs, analytics, or error reports.
- REQ-027: Refresh credentials MUST rotate atomically on every successful use. Reuse of a superseded refresh credential MUST revoke its entire session family and emit a privacy-safe security event. Concurrent refreshes MUST have deterministic single-winner behavior and MUST NOT leave multiple valid descendants. Expired, revoked, malformed, replayed, or subject-mismatched credentials MUST fail without disclosing session internals.
- REQ-028: A user MUST have at most five active session families. The product MUST provide a user-visible session-management view with privacy-minimized device label, approximate activity time, and revocation action; it MUST NOT create a persistent fingerprint. Logout MUST revoke the current family, `Log out everywhere` MUST revoke every family, and password change or account recovery MUST revoke every existing family before issuing any replacement session.
- REQ-029: Every state-changing cookie-authenticated request MUST require an approved CSRF defense in addition to `SameSite=Lax`, validate the request origin where applicable, and reject missing, invalid, cross-session, or replay-incompatible CSRF proof. OAuth/OIDC callbacks MUST retain their separate state, nonce, PKCE, and redirect validation requirements.
- REQ-030: An external identity MUST be uniquely keyed by the combination of provider and the provider's immutable subject identifier, never by email address alone. Each external identity MUST belong to at most one Hansel user, and provider email changes MUST NOT transfer account ownership or change the identity key.
- REQ-031: A signed-in user MAY link Google, Microsoft, or Apple to their own Hansel account only after recent Hansel reauthentication and successful provider verification. When a signed-out provider flow returns an email matching an existing Hansel account, Hansel MUST NOT link or sign in automatically from the email match; the person MUST authenticate to the existing account and explicitly approve linking. Linking conflicts and existence checks MUST use generic responses and privacy-safe audit events.
- REQ-032: An Apple private-relay email MUST be treated as a valid, distinct email address and MUST NOT be silently merged with a non-relay address. Unlinking an identity MUST require recent reauthentication and MUST be rejected when it would remove the user's final usable authentication method. Linking, unlinking, and recovery MUST preserve invitation and tenant authorization boundaries and MUST NOT grant access based solely on a provider or email association.
- REQ-033: Organization and site invitations MUST use cryptographically random opaque credentials, expire seven days after issuance, be single-use, and be stored only as keyed digests. The raw credential MAY appear only in the initial HTTPS invitation link and MUST be removed from browser-visible URLs immediately after exchange for a short-lived, purpose-bound acceptance context. It MUST NOT appear in logs, analytics, referrers, error reports, or persistent browser storage.
- REQ-034: An invitation MUST be bound to one normalized invited email and MUST NOT be transferable. Acceptance MUST require a currently authenticated or newly verified identity whose verified email matches the invitation. An existing Hansel user MUST authenticate and accept without creating a duplicate account. Reissuing an invitation MUST invalidate every previous pending credential for the same invitation intent, and revocation MUST take effect immediately.
- REQ-035: An organization invitation MUST grant `Editor` by default and a site invitation MUST grant `Site Viewer` by default. `Member` and `Collaborator` MUST NOT be active system roles. An elevated role MAY be selected only by an authenticated Owner or Admin who also possesses the explicit permission to grant that exact role within the invitation's tenant and resource scope. Owner transfer and any role equal to or greater than the issuer's effective authority MUST NOT occur through the ordinary invitation flow.
- REQ-036: Invitation acceptance MUST be transactional and idempotent across identity association, membership creation, site access, invitation consumption, and audit recording. Expired, revoked, superseded, consumed, malformed, email-mismatched, unauthorized-role, or otherwise invalid invitations MUST return a generic recoverable result without disclosing the invitation target, tenant, site, role, account existence, or recipient identity.
- REQ-037: First name, last name, job title, and department MUST be required personal-profile fields. First and last name MUST each contain 1–100 Unicode characters after trimming and NFC normalization. Job title and department MUST use the stable identifiers in Approved product taxonomies. Selecting `other` MUST reveal and require its corresponding 1–100-character trimmed Unicode text value; otherwise that other value MUST be absent.
- REQ-038: Organization name, country, industry or sector, place or service, and organization size MUST be required for the new-organization path. Organization name MUST contain 1–200 Unicode characters after trimming and NFC normalization. Country MUST use an ISO 3166-1 alpha-2 identifier from the versioned country catalog; Australia MAY be suggested first when locale indicates Australia but MUST NOT be the only option. Industry, place or service, and size MUST use the stable identifiers in Approved product taxonomies, and the selected place or service MUST belong to the selected industry.
- REQ-039: The discovery step MUST remain optional and skippable. Current signage-management method MUST use `pdf`, `spreadsheet`, or `other`; selecting `other` MUST require a 1–100-character trimmed Unicode value. Biggest challenges MUST be optional trimmed Unicode free text with a maximum of 1,000 characters. Skipping MUST store no fabricated answers and MUST remain distinguishable from submitting an intentionally blank optional response.
- REQ-040: Taxonomy identifiers MUST be persisted and transmitted independently from display labels. The API MUST reject unknown, inactive, mismatched, or display-label values where an identifier is required. Labels MAY be localized or corrected without migrating stored profile records, while identifier removal or semantic change MUST use a versioned data migration and backward-compatibility plan.
- REQ-041: Plan presentation MUST be loaded from one version-controlled, schema-validated JSON catalog rather than embedded in React components. The catalog MUST define stable plan and price identifiers, display name, description, feature copy, currency, billing interval, amount in minor units, additional-site amount, three-month trial eligibility, display order, active state, Enterprise contact behavior, and environment-specific Stripe Price lookup key. The client MUST NOT supply or determine a charge amount, currency, trial duration, entitlement, or Stripe identifier.
- REQ-042: Until a production commercial catalog is approved, the dummy catalog in Approved dummy plan catalog MUST be enabled only with Stripe test-mode credentials and MUST be rejected by deployment validation in production. Stripe secret and webhook keys MUST reside in AWS Secrets Manager, publishable configuration MAY be public, and environment-specific Stripe Product and Price identifiers MUST be resolved server-side from approved configuration without placing secrets in JSON or source control.
- REQ-043: Eligible self-service plans MUST start with a three-calendar-month trial, collect one reusable card payment method through Stripe-hosted Checkout during onboarding, and make no subscription charge before the trial ends. Card is the only approved payment-method type for this release; bank debit, buy-now-pay-later, cash methods, custom card entry, and separately configured wallets are out of scope. Stripe MUST own card-data collection; Hansel MUST NOT receive or persist raw card, CVC, or equivalent payment credentials. Enterprise MUST use the configured sales-contact action and MUST NOT enter self-service payment.
- REQ-044: Stripe-hosted Checkout MUST occur after plan selection and before organization-profile completion. Hansel MUST create or reuse one idempotently keyed Checkout Session in subscription mode for the server-selected Price and three-calendar-month trial, and persist only the minimum Stripe references and normalized subscription state. Checkout success and cancellation URLs MUST return to Hansel's approved onboarding routes. A verified, replay-safe Stripe webhook MUST authorize progression; the browser return alone MUST NOT do so.
- REQ-045: If the person cancels the Stripe flow, Hansel MUST return them to the same payment page with the message `Payment cancelled.` If Stripe rejects or fails payment-method setup or the payment flow, Hansel MUST return them to the same payment page with the message `Payment failed. Please try again.` The selected plan and accepted onboarding progress MUST be retained, raw provider messages MUST NOT be exposed, and retry MUST create no duplicate Customer, subscription, invoice, or charge.
- REQ-046: A successful return from Stripe MUST show a processing state until a verified webhook confirms the subscription as trialing. Only then MAY onboarding continue to organization profile. Duplicate webhook delivery MUST be idempotent, invalid signatures MUST be rejected, and a delayed confirmation MUST offer a safe page refresh without starting another Checkout Session.
- REQ-047: Completion destinations MUST be derived server-side from the authoritative onboarding path and access state. A new-organization journey with a webhook-confirmed trialing or approved subscription MUST continue from Stripe to organization profile, then optional discovery, then the new organization's dashboard. An accepted organization invitation MUST end at that organization's dashboard. An accepted site invitation MUST end at the invited site. A destination identifier supplied or modified by the client MUST NOT redirect or authorize access to another organization, site, or journey.
- REQ-048: Selecting Enterprise MUST create or resume an idempotent sales-contact request and show an Enterprise confirmation page. The onboarding journey and accepted non-secret progress MUST remain saved at the Enterprise activation boundary until an authorized sales or operations process records an approved activation outcome. The person MUST NOT enter a tenant dashboard, receive a paid entitlement, or bypass activation from the client, and rejection, expiry, withdrawal, and later resumption MUST use an auditable server-authoritative state.
- REQ-049: The account-creation or invitation-acceptance screen MUST visibly state that activating its named primary action accepts the currently presented Terms of Service and acknowledges the Privacy Policy, with each document linked and identified by an immutable published version. Activating that action MUST send `acceptsTerms: true` with both immutable versions to the unchanged server contract; a separate consent checkbox MUST NOT be shown. The action MUST be unavailable when either required document version is unavailable, and optional marketing consent MUST remain separate and unselected.
- REQ-050: Consent evidence MUST record the user, Terms version, Privacy Policy version, server timestamp, onboarding path, and country derived from the request IP at consent time. The full IP address MUST NOT be retained with consent evidence. Country derivation failure MUST record `unknown` and MUST NOT block consent. Consent records MUST be append-only, auditable, and retained with the account or as legally required after deletion without retaining unrelated personal data.
- REQ-051: Incomplete onboarding journeys and their non-required profile data MUST be deleted 30 days after last activity. Verification challenges and their attempt or send state MUST be deleted within 24 hours after expiry. Consumed, declined, expired, revoked, cancelled, or superseded invitation metadata MUST be retained for 90 days and then deleted or irreversibly aggregated; raw invitation credentials MUST never be retained. Security, consent, membership, role, and access audit events MUST be retained for seven years with access controls and integrity protection.
- REQ-052: Optional discovery answers MUST be retained until the organization is deleted or an authorized organization administrator removes them. Payment persistence MUST contain only Stripe references, normalized subscription state, and legally required accounting metadata; raw payment credentials remain excluded. Hansel MUST support authenticated data export, correction where legally permitted, and deletion workflows that cascade or anonymize onboarding data according to the approved retention schedule while preserving only records subject to an active legal requirement.
- REQ-053: Every onboarding screen MUST support responsive reflow from 320 CSS pixels through desktop widths, portrait and landscape orientation, 200% browser zoom, and text spacing overrides without horizontal page scrolling, clipped content, overlapping controls, or loss of information or action. Forms MUST use a single-column reading and focus order at narrow widths, while wider composition MAY follow approved Figma evidence without rendering the prototype laptop shell.
- REQ-054: Account creation, email verification, personal profile, organization profile, discovery, invitation acceptance, consent, back, next, skip, and completion transitions MUST work without client JavaScript through ordinary HTTPS form submissions and server redirects. JavaScript MAY progressively enhance validation, pending states, focus management, and transitions but MUST NOT be the sole mechanism for non-payment submission or error recovery. Google, Microsoft, and Apple authorization redirects MUST remain operable without client JavaScript.
- REQ-055: Stripe's secure payment UI is the approved no-JavaScript exception. When JavaScript is unavailable at the payment step, Hansel MUST show a server-rendered explanation that secure payment requires JavaScript, retain the selected plan and onboarding progress, and provide instructions to enable JavaScript and safely resume; it MUST NOT render a broken, incomplete, or non-PCI payment form.
- REQ-056: React onboarding forms MUST use React Hook Form for form state and Yup schemas for client-side validation. Express request boundaries and server-side domain inputs MUST use Zod schemas; server-side Zod validation is authoritative and MUST run regardless of prior client validation. Neither library's inferred types may replace explicit OpenAPI contracts, stable domain types, authorization checks, or state-machine validation.
- REQ-057: Frontend Yup and backend Zod rules MUST be traceable to the same requirement and tested against a shared table of accepted and rejected examples for every duplicated field rule. A client schema MAY be more immediately helpful but MUST NOT accept a value that the corresponding authoritative server contract rejects without presenting the server result accessibly. Validation errors MUST use stable machine codes mapped to safe localized messages rather than exposing library internals.
- REQ-058: The person who successfully creates a new organization MUST become its sole initial `Owner`. Owner is a protected system role with every permission in that organization, including billing, role administration, organization settings, and ownership transfer. Owner authority MUST NOT be removed, reduced, or assigned through an ordinary invitation or custom-role operation; any ownership transfer MUST use a separately approved recent-reauthentication and explicit-acceptance flow that preserves exactly one Owner.
- REQ-059: An organization MAY have multiple `Admin` assignments. Admin is a protected system role with every permission except ownership transfer, deletion or modification of the Owner role, and any other permission explicitly classified as owner-only. Admin MAY manage billing, invite and remove non-Owner members, create and manage custom roles, and assign roles only within the limits of the Admin's own effective permissions.
- REQ-060: `Editor` is a protected system role with the approved organization and content operations but no billing, organization-security, custom-role management, role-assignment, ownership-transfer, organization-deletion, or member-removal permission. Editor MAY view members and invite a person only as Editor or Viewer; that invitation is not a role-change operation and MUST NOT target an existing member. `Viewer` is a protected read-only system role for ordinary organization and product content. System roles MUST be immutable except through a versioned authorization-specification change and MUST NOT be deleted, renamed, or edited by tenant users.
- REQ-061: Hansel MUST provide a versioned permission catalog with stable identifiers, human-readable descriptions, scope (`organization` or `site`), risk classification, and allowed grantors. An Owner or an Admin holding `roles.manage` MAY create an organization-scoped custom role by selecting permissions from that catalog, but MUST NOT grant owner-only permissions, permissions outside the target scope, or any permission the actor does not effectively possess. Custom role names MUST be unique within the organization after approved normalization.
- REQ-062: Role assignment MUST reference a role identifier rather than copying mutable permission flags to a user. Permission changes MUST take effect consistently for every assignment, be evaluated server-side on every protected operation, invalidate or refresh stale authorization context promptly, and produce an audit event containing actor, target, role, permission diff, scope, timestamp, and outcome without sensitive request data. The client MUST NOT be an authorization boundary.
- REQ-063: A future role-management view MUST allow authorized Owners and Admins to inspect system and custom roles, compare permissions, create, rename, and edit permitted custom roles, see assignment counts, assign or remove roles, and understand why a permission is unavailable. Destructive or privilege-increasing changes MUST require confirmation and recent reauthentication according to risk. That view is not implemented by this onboarding slice and requires its own approved feature specification and Figma design.
- REQ-064: `Collaborator` MUST NOT be an active organization or site role. Collaboration on a site MUST use a site-scoped assignment of protected `Site Admin`, `Site Editor`, or `Site Viewer`. A site-scoped assignment MUST NOT imply organization-wide membership permissions, billing access, organization-role administration, access to another site, or authority over the owning organization.
- REQ-065: `Site Admin` MUST have every site-scoped permission, including permitted site-access administration, but no organization billing, organization-role, ownership, or unrelated-site permission. `Site Editor` MUST have ordinary create, edit, organize, and operational permissions within the assigned site but no site-access administration. `Site Viewer` MUST be read-only within the assigned site. Site system roles MUST be immutable, and a grantor MUST possess both access to the site and explicit authority to grant the selected site role.
- REQ-066: Only the current Owner MAY initiate ownership transfer, and the target MUST be an active Admin in the same organization. Initiation MUST require recent Owner reauthentication, invalidate any earlier pending transfer, and create exactly one pending request with a cryptographically random single-use credential valid for 24 hours and stored only as a keyed digest. The target MUST authenticate and explicitly accept; email possession or link access alone MUST NOT complete transfer.
- REQ-067: Until valid acceptance, the current Owner MUST retain every Owner permission and the target MUST remain Admin. Acceptance MUST atomically verify the current pending request and both identities, promote the target to sole Owner, demote the former Owner to Admin, consume the credential, record the complete audit event, and invalidate affected authorization contexts. Failure at any step MUST leave both original roles unchanged. Cancellation, supersession, or expiry MUST leave roles unchanged.
- REQ-068: Hansel MUST notify both the current Owner and target when a transfer is initiated, cancelled, superseded, expired, accepted, or rejected as invalid, without placing the raw transfer credential in logs or non-target notifications. Support personnel MUST NOT silently transfer ownership. Emergency ownership recovery requires a separately approved, multi-party, identity-verified, time-delayed, fully audited procedure and is not part of ordinary onboarding or role management.
- REQ-069: A person authenticated as the invitation's verified recipient MAY explicitly decline a pending organization or site invitation after a clear confirmation step without password re-entry. Decline MUST atomically move the invitation to its terminal declined state, consume its acceptance credential, create no membership or site assignment, emit an audit event, and notify the inviter without requiring or collecting a decline reason. Repeated decline requests with the same idempotency context MUST return the same outcome without duplicate notifications.
- REQ-070: Closing, leaving, or timing out on the invitation screen MUST NOT imply decline; the invitation MUST remain pending until explicit acceptance, explicit decline, expiry, revocation, or supersession. A declined invitation MUST NOT be restored or accepted. An authorized inviter MAY issue a new invitation later, which creates a new auditable intent and credential. Invalid, mismatched, expired, revoked, superseded, consumed, or already declined requests MUST retain the approved generic privacy-preserving response behavior.
- REQ-071: When a user can still authenticate with any bound method, adding or replacing another authentication method MUST require normal sign-in and recent reauthentication and MUST be treated as authenticator management rather than account recovery. A linked Google, Microsoft, or Apple identity MAY satisfy recent reauthentication before the authenticated user creates a new Hansel password, subject to the approved linking policy.
- REQ-072: Email/password recovery MUST send a cryptographically random six-digit code to the verified primary email, valid for 15 minutes, with the same five-attempt, 60-second resend cooldown, five-sends-per-rolling-hour, replacement invalidation, keyed-digest storage, concurrency, anti-enumeration, and abuse-monitoring requirements as onboarding verification. Successful verification MUST permit one bounded password-reset operation and MUST NOT permit email, identity, tenant, role, invitation, or ownership changes.
- REQ-073: Before initial onboarding completion, Hansel MUST issue ten independent one-time saved recovery codes, each containing at least 128 bits of cryptographic randomness, display them only in the authenticated setup response, and store only keyed digests. The user MUST be able to download or copy them accessibly and acknowledge the recovery-code step before continuing. Using one code MUST atomically consume the entire current set for recovery and, after successful recovery, issue a replacement set displayed once in the new authenticated session.
- REQ-074: Every successful account-recovery method MUST revoke all existing session families before issuing a replacement session, invalidate outstanding password-reset and recovery challenges, emit a privacy-safe audit event, and notify every verified contact channel without exposing the recovery secret. Recovery endpoints MUST remain generic and rate-limited. Support MUST NOT view or issue passwords or saved recovery codes, silently reset an account, change ownership, bypass invitations, or override recovery. Loss of every authenticator, verified recovery channel, and saved recovery code MAY only enter a separately approved manual identity-proofing process.
- REQ-075: Hansel MUST own the Google Cloud, Microsoft Entra, and Apple Developer registrations used for authentication and MUST provision separate provider clients for development, staging, and production. Provider client secrets, Apple signing keys, and related private configuration MUST be stored in AWS Secrets Manager with least-privilege runtime access, rotation procedures, access auditing, and no inclusion in source control, client bundles, logs, or general application configuration.
- REQ-076: The first release MUST request identity-only scopes: Google `openid email profile`, Microsoft `openid email profile`, and Apple `name email`. It MUST NOT request offline access, Google Drive, Microsoft Graph data permissions, contacts, calendars, or other downstream API access. Provider access and refresh tokens MUST NOT be persisted; transient tokens MUST be held only for the minimum server-side validation and identity-exchange lifetime.
- REQ-077: Production provider callbacks MUST be exactly `https://app.hanselapp.io/auth/callback/google`, `https://app.hanselapp.io/auth/callback/microsoft`, and `https://app.hanselapp.io/auth/callback/apple`. Staging and development MUST use separately registered exact HTTPS callback origins and clients, with no wildcard redirect URI. Apple development MUST use a registered HTTPS domain rather than localhost. An environment MUST reject a callback, client, issuer, or redirect configuration belonging to another environment.
- REQ-078: Provider validation MUST require the approved issuer, immutable subject, configured audience, valid signature and algorithm, expiry, issued-at policy, authorization-code validity, state, nonce, exact redirect URI, and PKCE where supported. Email and provider verification status MUST follow REQ-022. Provider names are untrusted profile suggestions that the user MAY confirm or edit; Apple name data MUST be captured safely on first authorization because it may not be supplied again. Missing optional profile claims MUST NOT fail an otherwise valid identity exchange.
- REQ-079: Five consecutive failed password-authentication attempts for the same normalized account identifier within 15 minutes MUST lock password authentication for that account for 15 minutes from the fifth failure. Further attempts during the lock MUST NOT extend it, successful password authentication before the threshold MUST reset the consecutive-failure count, and expiry MUST restore password authentication without support intervention. The same generic response and materially equivalent response timing MUST apply to an unknown account, an incorrect password, and a locked account. A lock MUST NOT block an already linked external identity, a valid existing session, or the approved recovery flow, and Hansel MUST send a privacy-safe security notification to the verified account channel when a real account is locked.
- REQ-080: Application rate limits MUST count attempts regardless of success unless explicitly stated otherwise and MUST use atomic shared state across every Express task. Per normalized account identifier, registration MUST permit at most three submissions per rolling hour, recovery initiation at most three per rolling hour, and saved-recovery-code verification at most five failures per 15 minutes. Email verification and email recovery challenges retain their five failed attempts, 60-second resend cooldown, and five sends per rolling hour. Per trusted source-network key, the application MUST permit at most 100 combined credential submissions per five minutes, 20 registration or recovery initiations per rolling hour, 20 verification sends per rolling hour, 30 OAuth authorization initiations per five minutes, and 20 invalid OAuth callbacks per five minutes. IPv4 addresses MUST be keyed individually and IPv6 sources MUST use an approved `/64` aggregation; source identity MUST derive only from CloudFront or load-balancer metadata whose trust boundary is explicitly configured, never an arbitrary client-supplied forwarding header.
- REQ-081: CloudFront and AWS WAF MUST provide a separately configurable coarse network-abuse layer in front of authentication routes, with AWS-managed reputation and bot protections where available and an initial rate-based threshold of 300 requests per five minutes per source-network key for the aggregate authentication route group. WAF controls MUST NOT replace application account, challenge, or operation limits. Every threshold MUST be centrally versioned by environment, default-deny when shared rate-limit state is unavailable for credential verification, emit privacy-minimized metrics and security events, and support an audited emergency change procedure. Rejection MUST use `429` with a bounded `Retry-After` when doing so cannot reveal account existence; otherwise the endpoint MUST preserve its generic response contract. Limits MUST be tested for concurrent boundary requests, distributed account attacks, source-key rotation, NAT false positives, IPv6 rotation, state-store failure, and recovery after expiry.
- REQ-082: Account-creation Step 1 MUST follow verified Figma frame `1:3`: a white full-page canvas, the Figma Logo instance `2047:918` at the upper-left on desktop, and a narrow single-column form centered horizontally and placed in the upper-middle of the viewport. The logo lockup MUST use the exact SVG exported from Figma component `41:829`, render at 114 by 20 CSS pixels (the SVG's integer viewport representation of the 113.58 by 20 design bounds), sit 30 pixels from the desktop top and left edges, and preserve its orange `Hansel` wordmark, gray `Beta` badge, and 6-pixel internal gap; text reconstructions and the prior brown text-and-dot approximation MUST NOT be used. Its content order MUST be heading, email, password without persistent policy helper copy, primary `Create with email` action, `or` separator, Google, Microsoft, and Apple actions with recognizable provider marks, policy copy without a checkbox, and the existing-account login link. Every textual link in the onboarding content, including the Terms of Service, Privacy Policy, and login links, MUST be visibly underlined as shown in the design; the linked logo remains a graphical mark without a text decoration. The versioned action-consent behavior in REQ-049 and the length-validation behavior in REQ-023 supersede any obsolete composition-rule copy. At narrow widths the logo MUST join normal document flow and the form MUST retain the same reading order without horizontal scrolling.
- REQ-083: Every implemented onboarding screen and reusable onboarding UI component MUST have an API-independent Storybook story governed by design-system-foundation REQ-013. Account-creation Step 1 MUST be represented at Figma frame `1:3`'s approved desktop composition, pass automated WCAG checks, and have a committed deterministic visual-regression baseline.

## Acceptance scenarios

### AC-001 — New organization path is sequenced safely [REQ-001, REQ-002, REQ-011, REQ-012]

- Given a person starts the new-organization path
- When they complete each approved step
- Then the server permits only the next valid transition, preserves accepted progress, and creates no organization, subscription, payment, or membership more than once

### AC-002 — Account verification is secure and recoverable [REQ-005, REQ-006, REQ-007, REQ-017]

- Given email verification is required for the approved identity method
- When the person submits the current six-digit code within 15 minutes and before five failed attempts
- Then the server verifies the email once and permits the next step
- And invalid, expired, superseded, used, throttled, or attempt-exhausted codes return a generic recoverable response without exposing secrets or account existence
- And replacement requests are accepted no sooner than 60 seconds apart and no more than five times per rolling hour, with each replacement invalidating all earlier codes

### AC-003 — Organization invite grants only organization membership [REQ-001, REQ-003, REQ-013]

- Given a valid, unexpired organization invitation addressed to the person's verified identity
- When the person completes the required account and profile steps
- Then the invitation is atomically consumed and the approved least-privilege organization membership is created once
- And organization creation, plan selection, and payment are not shown

### AC-004 — Site invite is tenant-safe [REQ-001, REQ-004, REQ-013]

- Given a valid, unexpired site invitation addressed to the person's verified identity
- When the person accepts it
- Then access is granted only to the invited site with the approved role and owning-organization context
- And changing route, request, organization, site, or membership identifiers cannot expand that access

### AC-005 — Profile taxonomies are explicit [REQ-008, REQ-009]

- Given a person reaches a personal or organization profile step
- When a select field is rendered or submitted
- Then its options use approved stable identifiers and labels, dependent options are valid for their parent selection, and any approved `Other` option reveals and requires the corresponding text field

### AC-006 — Optional discovery does not block completion [REQ-010, REQ-015]

- Given the person reaches the discovery step
- When they choose `Skip for now`
- Then the system records the step as intentionally skipped and permits completion without fabricating answers

### AC-007 — Progress survives interruption [REQ-011, REQ-012, REQ-014]

- Given the person has confirmed one or more onboarding steps
- When they refresh, reconnect, or resume in a later valid session
- Then the server returns the latest permitted step and accepted non-secret values without replaying completed side effects

### AC-008 — Accessible behavior is preserved [REQ-016, REQ-017]

- Given any supported onboarding screen, validation state, or recoverable error
- When used with keyboard navigation, a screen reader, 200% zoom, or a narrow viewport
- Then the reading and focus order remain logical, every control has an accessible name and error relationship, focus is visible and managed after transitions, status changes are announced, and no information or action is lost

### AC-009 — Regressions are rejected before deployment [REQ-018, REQ-019]

- Given an onboarding change diverges from the approved spec, API contract, state machine, Figma reference, accessibility rules, tenant boundary, or test thresholds
- When repository and CI verification run
- Then the responsible contract, unit, integration, accessibility, visual, security, or E2E check fails before deployment

### AC-010 — Hansel owns credentials and sessions [REQ-020]

- Given a person creates an email-and-password account or starts an authenticated onboarding session
- When credentials or session state are created, verified, rotated, refreshed, revoked, or expired
- Then the operation is performed by the approved Hansel credential and session subsystem
- And no Cognito user pool, Cognito identity, or Cognito session dependency participates in the flow

### AC-011 — External identity creates a Hansel session safely [REQ-021]

- Given a person selects Google, Microsoft, or Apple during onboarding
- When the provider returns a valid authorization response for the configured Hansel client and redirect URI
- Then the server validates the response and stable provider subject, links or creates the identity according to the approved account-linking policy, and issues a Hansel-managed application session
- And invalid state, nonce, issuer, audience, signature, redirect, reused code, expired code, missing required claim, or account-linking conflict is rejected without exposing provider credentials or account existence

### AC-012 — Provider email verification is not over-trusted [REQ-022]

- Given Google, Microsoft, or Apple returns an identity for onboarding
- When its email is present, explicitly verified, usable, and accepted by the account-linking policy
- Then Hansel may omit its email-code step for that identity
- But when the provider email is missing, unverified, unusable, or conflicts with policy, Hansel requires a usable address and successful six-digit-code verification before continuing
- And neither outcome grants tenant access without separate authorization

### AC-013 — Password creation is usable and safely stored [REQ-023, REQ-024]

- Given a person creates or changes a Hansel password
- When the password contains 15 through 128 Unicode characters, including at least one Unicode uppercase letter, lowercase letter, number, and punctuation or symbol character
- Then spaces, paste, password-manager autofill, and generated passwords remain supported, while whitespace alone does not satisfy the punctuation-or-symbol requirement
- And the server stores only an Argon2id result produced with a unique salt, the separately managed application pepper, and parameters no weaker than `m=19456`, `t=2`, `p=1`
- And production-equivalent concurrent-load evidence shows the configured work factor targets 250–500 milliseconds per hash without exceeding the bounded hashing capacity
- And a successful login with an older or weaker stored configuration rehashes the password using the current parameters and pepper version
- And overload is shed generically rather than allowing unbounded concurrent password hashing or disclosing whether the account exists
- But a password outside the length boundary or missing any required character class is rejected with an actionable response, and no compromised-password or common-password screening is performed or claimed

### AC-014 — Credential endpoints resist enumeration and abuse [REQ-025]

- Given registration, password authentication, verification, or recovery is attempted repeatedly or for an existing or non-existing normalized email address
- When a request crosses an approved risk or rate threshold
- Then the server applies the approved delay, challenge, or rejection consistently without disclosing account existence
- And no raw credential, verification secret, or sensitive risk signal is emitted to logs, analytics, traces, URLs, or client persistence

### AC-015 — Sessions rotate and expire predictably [REQ-026, REQ-027]

- Given a person authenticates successfully
- When Hansel creates and refreshes an application session
- Then opaque credentials are delivered only in protected cookies, access expires within 15 minutes, each refresh credential is single-use and atomically rotated, and the family cannot survive beyond 30 days from authentication
- And reuse of a superseded refresh credential revokes the complete family without exposing session internals

### AC-016 — Users control active sessions [REQ-028]

- Given a person has one or more active session families
- When they inspect sessions, revoke one, log out, log out everywhere, change their password, or recover their account
- Then the specified families are revoked immediately, the view exposes only privacy-minimized device and activity information, and no more than five active families can remain

### AC-017 — Cookie-authenticated mutations resist CSRF [REQ-029]

- Given an authenticated state-changing request
- When its CSRF proof or allowed origin is missing, invalid, or belongs to another session
- Then the server rejects the request without performing a side effect
- And valid OAuth/OIDC callbacks remain subject to their independent state, nonce, PKCE, and redirect checks

### AC-018 — External identities cannot be claimed by email match [REQ-030, REQ-031]

- Given a signed-out Google, Microsoft, or Apple flow returns an email already associated with a Hansel account
- When the immutable provider subject is not already linked to that account
- Then Hansel requires authentication to the existing account and explicit linking approval before associating the provider identity
- And an email match alone cannot authenticate, merge, transfer, or disclose the existing account

### AC-019 — Linking and unlinking preserve account access [REQ-030, REQ-031, REQ-032]

- Given a signed-in person recently reauthenticates
- When they link or unlink an external identity
- Then the external identity remains unique to one Hansel account, the action is audited without provider secrets, and unlinking is rejected if no other usable authentication method would remain
- And an Apple private-relay address remains distinct from any non-relay address unless the authenticated user completes the explicit linking flow

### AC-020 — Invitations are single-use and identity-bound [REQ-033, REQ-034]

- Given an unexpired pending invitation and a person controlling the invited verified email
- When the person exchanges and accepts the invitation within seven days
- Then the raw credential is removed from the browser-visible URL, the verified email is matched, and the invitation can be consumed only once
- And an existing user authenticates without creating a duplicate account, while transfer, replay, superseded credentials, and revoked credentials are rejected

### AC-021 — Invitations grant bounded default access [REQ-035]

- Given an authorized issuer creates an invitation without selecting an elevated role
- When an organization or site invitation is accepted
- Then the resulting role is respectively `Editor` or `Site Viewer`
- And an elevated role is accepted only when the issuer has explicit permission to grant that exact role within the target scope, with ordinary invitations unable to transfer Owner authority

### AC-022 — Invitation acceptance is atomic and private [REQ-036]

- Given invitation acceptance is submitted once or retried with the same idempotency context
- When identity association, membership, site access, consumption, or audit persistence succeeds or fails
- Then every required effect commits exactly once or none commits
- And every invalid-invitation category returns a generic result without exposing tenant, site, role, account, or recipient details

### AC-023 — Personal profile uses approved values [REQ-037, REQ-040]

- Given a person completes the personal-profile step
- When they submit names, job title, and department
- Then names satisfy the approved Unicode length and normalization rules, taxonomy fields contain approved stable identifiers, and an `other` selection requires only its matching bounded text value
- And display labels or stale, unknown, inactive, and mismatched identifiers are rejected server-side without losing valid input

### AC-024 — Organization profile preserves taxonomy relationships [REQ-038, REQ-040]

- Given a new owner completes the organization-profile step
- When they submit organization, country, industry, place or service, and size
- Then every required value satisfies its approved identifier or length contract, the place or service belongs to the selected industry, and all ISO 3166-1 countries are available
- And locale may prioritize Australia without restricting the catalog to Australia

### AC-025 — Discovery remains optional and bounded [REQ-039]

- Given a new owner reaches the discovery step
- When they submit PDF, Spreadsheet, or Other, enter optional challenges, or skip the step
- Then stable identifiers and approved length limits are enforced, `other` requires its matching value, and skipping records no fabricated answer while permitting completion

### AC-026 — Plan configuration is controlled and environment-safe [REQ-041, REQ-042]

- Given the application loads its plan catalog
- When catalog or deployment validation runs
- Then every active self-service plan has valid stable identifiers, currency, minor-unit amounts, interval, trial policy, display content, and an environment-resolved Stripe Price mapping
- And dummy plans or Stripe test-mode configuration cannot be enabled in production, while the client cannot override any commercial or Stripe value

### AC-027 — Trial payment method is collected during onboarding [REQ-043, REQ-044]

- Given a person selects an eligible self-service monthly or annual plan
- When they complete Stripe-hosted Checkout during onboarding
- Then Checkout accepts a reusable card payment method, creates the intended subscription with a three-calendar-month trial from the server-selected Price, makes no charge before trial end, and returns to the approved Hansel route
- And raw payment credentials never enter Hansel systems, while unapproved payment-method types are not enabled
- And an Enterprise selection follows its sales-contact action without self-service payment

### AC-028 — Cancelled and failed payment returns safely [REQ-045]

- Given Stripe payment or payment-method setup is cancelled or fails
- When the person returns to Hansel
- Then the same payment page retains the selected plan and accepted onboarding progress and displays respectively `Payment cancelled.` or `Payment failed. Please try again.`
- And retry does not duplicate the Stripe Customer, subscription, invoice, or charge or reveal raw provider errors

### AC-029 — Webhooks authorize payment progression [REQ-044, REQ-046]

- Given the browser returns from Stripe successfully
- When Hansel has not yet processed a verified qualifying webhook
- Then onboarding remains in a bounded processing state and cannot advance from client assertions alone
- And verified duplicate, delayed, or out-of-order events reconcile idempotently, invalid signatures are rejected, and organization-profile onboarding continues only after authoritative subscription confirmation

### AC-030 — Each onboarding path reaches only its authorized destination [REQ-047]

- Given a person completes an approved onboarding path
- When the server resolves the completion destination
- Then a new organization reaches its dashboard after organization profile and optional discovery, an organization invite reaches the invited organization dashboard, and a site invite reaches only the invited site
- And client-modified route or resource identifiers cannot change authorization or select another destination

### AC-031 — Enterprise onboarding pauses for activation [REQ-048]

- Given a person selects Enterprise
- When the sales-contact request is created or resumed
- Then an Enterprise confirmation page is shown, accepted progress is retained, and the journey remains pending authorized activation
- And no tenant dashboard or paid entitlement is available until an auditable server-side activation outcome permits the journey to continue

### AC-032 — Consent is explicit and versioned [REQ-049, REQ-050]

- Given a person is ready to create an account or accept an invitation
- When either policy version is unavailable
- Then the named primary action is unavailable and no consent is recorded
- But when both linked policies and the action-consent statement are visible and the person activates the named primary action, the frontend sends `acceptsTerms: true` with both versions and Hansel records the user, immutable policy versions, server timestamp, onboarding path, and IP-derived country or `unknown` without retaining the full IP address with the evidence
- And no separate consent checkbox or preselected optional marketing consent is shown

### AC-033 — Retention is enforced automatically [REQ-051, REQ-052]

- Given onboarding, verification, invitation, discovery, audit, consent, or payment metadata reaches its approved retention boundary
- When the scheduled retention process runs
- Then the data is deleted, anonymized, or preserved only under its stated legal or audit rule with an auditable outcome
- And raw verification, invitation, password, session, and payment credentials are never introduced into retained records

### AC-034 — Data rights respect tenant and legal boundaries [REQ-052]

- Given an authenticated person requests export, correction, or deletion
- When Hansel validates their identity, tenant authority, and applicable retention obligations
- Then eligible onboarding and profile data is exported, corrected, deleted, or anonymized without exposing another person or tenant
- And legally required records retain only the minimum protected metadata and the outcome is audited

### AC-035 — Onboarding reflows across supported viewports [REQ-053]

- Given any onboarding screen or error state at a viewport of at least 320 CSS pixels, 200% zoom, or supported text-spacing override
- When content reflows in portrait or landscape
- Then information and actions remain readable, reachable, ordered, and free of horizontal page scrolling, clipping, and overlap
- And the narrow layout uses a logical single-column reading and focus order without the Figma prototype shell

### AC-036 — Core onboarding works without JavaScript [REQ-054, REQ-055]

- Given client JavaScript is unavailable
- When a person completes a non-payment onboarding form, follows an external-provider redirect, navigates back or next, skips discovery, or recovers from validation
- Then ordinary HTTPS submissions and server redirects preserve the approved behavior and accessible errors
- But at Stripe payment, Hansel shows the approved explanation and resume instructions while preserving progress instead of exposing a broken or insecure form

### AC-037 — Client and server validation remain aligned [REQ-056, REQ-057]

- Given an onboarding input with a shared accepted or rejected example
- When React Hook Form and Yup validate it in the client and Zod validates it at the Express boundary
- Then both layers produce behavior consistent with the governing requirement, server validation remains authoritative, and safe stable error codes map to accessible messages
- And contract tests fail if duplicated field rules drift

### AC-038 — Organization creator becomes the protected Owner [REQ-058]

- Given a new-organization journey completes successfully
- When the organization and initial membership are committed
- Then the creator is its sole initial Owner with every organization permission
- And ordinary invitation, assignment, custom-role, or client manipulation cannot create, remove, or reduce Owner authority or leave the organization without exactly one Owner

### AC-039 — System roles enforce privilege boundaries [REQ-059, REQ-060]

- Given an Owner, Admin, Editor, or Viewer performs a protected operation
- When the server evaluates current effective permissions
- Then Owner has every permission, Admin has every non-owner-only permission, Editor has ordinary product-operation permissions without billing or access administration, and Viewer is read-only
- And tenant users cannot edit, rename, delete, or expand a protected system role

### AC-040 — Custom roles cannot escalate their creator [REQ-061, REQ-062]

- Given an authorized Owner or Admin creates, edits, or assigns a custom role
- When the requested permission set is evaluated
- Then only catalog permissions within the target scope and actor's effective authority are accepted, owner-only permissions are rejected, assignments reference the role, and changes are audited
- And authorization changes take effect server-side without trusting cached client permissions

### AC-041 — Site collaboration remains site-scoped [REQ-064, REQ-065]

- Given a person receives Site Admin, Site Editor, or Site Viewer for one site
- When they access or operate on Hansel resources
- Then their effective permissions follow the assigned site role only within that site
- And the assignment grants no organization billing, organization-role, ownership, unrelated-site, or implicit organization-wide permission

### AC-042 — Editor invitations cannot become role administration [REQ-060, REQ-061, REQ-062]

- Given an Editor invites a person to an organization or an authorized site
- When the requested role is respectively Editor or Viewer, or Site Editor or Site Viewer
- Then the invitation may be created within the Editor's effective scope
- But an existing-member role change, member or assignment removal, elevated or custom role, billing, security, ownership, or role-management operation is rejected server-side and audited

### AC-043 — Ownership transfer requires two authenticated parties [REQ-066]

- Given the current Owner recently reauthenticates and selects an active Admin in the same organization
- When transfer is initiated
- Then exactly one single-use 24-hour request becomes pending and the Owner retains ownership
- And only the authenticated target Admin can explicitly accept it; link or email possession alone is insufficient

### AC-044 — Ownership transfer is atomic and recoverable [REQ-067, REQ-068]

- Given a valid pending transfer is accepted by its authenticated target
- When the server commits the transfer
- Then the target becomes the sole Owner, the former Owner becomes Admin, the credential is consumed, authorization state is invalidated, both parties are notified, and the action is audited exactly once
- But cancellation, expiry, supersession, invalid acceptance, or any partial failure leaves the original Owner and Admin roles unchanged

### AC-045 — Invitation decline is explicit and terminal [REQ-069, REQ-070]

- Given the authenticated verified recipient views a pending invitation
- When they confirm decline
- Then the invitation is consumed as declined, no membership or site assignment is created, the action is audited, and the inviter is notified once without collecting a reason
- But leaving the page does not decline, repeated decline is idempotent, and later access requires an authorized inviter to issue a new invitation

### AC-046 — Available authenticators avoid recovery bypass [REQ-071, REQ-072]

- Given a user can authenticate with a password or linked provider
- When they add or replace another method
- Then normal sign-in and recent reauthentication are required and no recovery bypass is created
- But when verified-email password recovery is required, one approved six-digit challenge permits only one bounded password reset and no identity, tenant, role, invitation, or ownership change

### AC-047 — Saved recovery codes are one-time and replaceable [REQ-073]

- Given a user reaches initial onboarding completion
- When Hansel creates the recovery-code set
- Then ten independent codes with at least 128 bits of randomness are displayed once for accessible copy or download, only keyed digests are stored, and the step requires acknowledgement
- And using one code consumes the current set atomically and issues a replacement set only after successful recovery in the new authenticated session

### AC-048 — Recovery revokes sessions and cannot be overridden [REQ-074]

- Given account recovery succeeds through an approved method
- When the replacement authentication method is bound
- Then every existing session and outstanding recovery challenge is revoked, verified channels are notified, a safe audit event is recorded, and only the new session remains
- And support cannot view or issue recovery secrets, silently reset the account, change ownership, or bypass tenant authorization; loss of every method requires a separately approved identity-proofing process

### AC-049 — Provider clients and scopes remain environment-bound [REQ-075, REQ-076, REQ-077]

- Given Google, Microsoft, or Apple authentication begins in development, staging, or production
- When Hansel builds the authorization request and processes its callback
- Then the environment uses its separately owned client, exact registered HTTPS callback, identity-only scopes, and least-privilege secret access
- And wildcard, cross-environment, downstream-data, offline-access, localhost Apple, or client-exposed secret configuration is rejected

### AC-050 — Provider identity is validated without over-requiring profile data [REQ-078]

- Given a provider returns an authorization response
- When Hansel validates and exchanges it
- Then issuer, subject, audience, signature, algorithm, time claims, code, state, nonce, redirect URI, and PKCE policy are verified before a Hansel session is issued
- And editable provider name suggestions or missing optional profile claims do not become identity keys or incorrectly reject a valid exchange, while first-authorization Apple name data is handled once and safely

### AC-051 — Authentication limits are atomic, layered, and private [REQ-025, REQ-079, REQ-080, REQ-081]

- Given five consecutive incorrect password attempts target one normalized account within 15 minutes
- When another password attempt is made before the resulting 15-minute lock expires
- Then password authentication remains locked without extending the lock, the response does not distinguish the lock from an unknown account or incorrect password, and an external identity, existing session, or approved recovery path is not disabled
- Given concurrent requests reach an application or network threshold
- When the final allowed request and the first rejected request race across different Express tasks
- Then shared atomic state admits no more than the configured limit, applies the approved generic or `429` response, and emits no account-existence or sensitive risk signal
- And tests cover the account, operation, source-network, CloudFront, and WAF layers independently and together, including IPv6 aggregation, NAT false positives, distributed attacks, state-store failure, and automatic recovery after expiry

### AC-052 — Account creation matches the approved Figma composition [REQ-016, REQ-023, REQ-049, REQ-053, REQ-082]

- Given account-creation Step 1 is rendered at a desktop viewport
- When it is compared with verified Figma frame `1:3`
- Then the white canvas, upper-left Hansel mark, narrow upper-middle form, content order, control hierarchy, provider marks, policy links, and login link correspond to the frame
- And the versioned action-consent statement remains present without a checkbox while approved password guidance appears only as actionable validation after an invalid submission
- Given the same screen is rendered at 320 CSS pixels or 200% zoom
- Then the logo and form reflow into one logical reading order with no clipped content, horizontal scrolling, or lost action

### AC-053 — Account creation is reviewable in Storybook [REQ-018, REQ-082, REQ-083]

- Given the application API and PostgreSQL are unavailable
- When a reviewer opens the account-creation Storybook story
- Then the Figma-derived Step 1 composition renders with fictional empty state, makes no network request, passes automated accessibility checks, and matches its reviewed visual baseline

## UX and accessibility

Primary Figma page: `1:2` (`Onboarding`). Verified representative frame: `1:3` (`Onboarding > New user / New organization > Step 1`, 1728×1117). The authenticated prototype contains 12 frames covering login context, new-user/new-organization onboarding, organization invitation, and site-collaboration invitation.

Observed design evidence includes:

- `Let's get started`: a compact upper-left Hansel mark; a narrow upper-middle form ordered as email, password, create-with-email, `or`, Google, Microsoft, Apple, terms/privacy action-consent copy without a checkbox, and login link. The frame's eight-character threshold is superseded by REQ-023; its composition intent remains governed by REQ-023's precise Unicode rules.
- `Verify your account`: segmented code entry, masked destination copy, replacement-code action, Back, and Next; the design currently says 24-hour validity.
- `Tell us about you`: first name, last name, job title, and department.
- `Choose your plan`: monthly/annual choice, Plus, Pro, Enterprise, and free-trial entry; displayed descriptions include placeholder copy.
- `Payment gateway`: a placeholder only, with no usable payment design.
- `Now your organization`: organization, country, industry or sector, type of place or service, and size.
- `Could you tell us more?`: current signage-management method, biggest challenges, Back, Next, and `Skip for now`.
- Organization and site invitation paths: invitation context, first name, last name, password, terms/privacy, then job title and department.

Figma annotations propose job-title, department, industry, place/service, size, and signage-management option sets, including conditional `Other` text fields. Those annotations are inputs to approval, not an implementation license until the canonical taxonomy is recorded in this spec or an explicitly referenced product-data contract.

The implemented screens must use semantic HTML and native form behavior, group related controls, identify required and optional inputs in text, announce inline and submission errors, move focus to a screen heading or error summary after a transition, retain entered non-secret values after validation failures, support paste and password managers, and avoid automatic submission of segmented verification inputs unless that behavior is separately approved and accessible.

## Approved product taxonomies

Identifiers in backticks are the stable API and persistence values; the following text is the approved English label.

### Job title

- `manager`: Manager
- `facility_manager`: Facility manager
- `project_manager`: Project manager
- `in_house_designer`: In-house designer
- `signage_wayfinding_designer`: Signage wayfinding designer
- `other`: Other

### Department

- `marketing_communications`: Marketing & Communications
- `development_advancement`: Development / Advancement Office
- `facilities_management_campus_maintenance`: Facilities Management / Campus Maintenance
- `other`: Other

### Industry and permitted place or service

- `healthcare`: Healthcare
  - `hospitals`: Hospitals
  - `clinics`: Clinics
  - `aged_care_facilities`: Aged care facilities
- `education`: Education
  - `universities_schools`: University/Schools
- `retail`: Retail
  - `shopping_malls`: Shopping malls
  - `department_stores`: Department stores
  - `retail_stores`: Retail store
- `corporate_commercial`: Corporate / Commercial
  - `office_buildings`: Office buildings
  - `coworking_spaces`: Co-working spaces
  - `business_parks`: Business parks
  - `headquarters`: Headquarters
- `transport_infrastructure`: Transport & Infrastructure
  - `airports`: Airports
  - `train_metro_bus_ferry`: Train/Metro/Bus/Ferry
  - `parking_structures`: Parking structures
- `government_civic`: Government & Civic
  - `council_buildings`: Council buildings
  - `public_libraries`: Public libraries
  - `community_centers`: Community centers
  - `courthouses`: Courthouses
  - `licensing_service_centers`: Licensing or service centers
  - `community_halls`: Community halls
- `construction_industrial`: Construction & Industrial
  - `construction_sites`: Construction sites
  - `warehouses`: Warehouses
  - `manufacturing_plants`: Manufacturing plants
  - `logistics_hubs`: Logistics hubs
  - `mining_operations`: Mining operations
- `hospitality_tourism`: Hospitality & Tourism
  - `hotels_resorts`: Hotels and resorts
  - `hostels_lodges`: Hostels and lodges
  - `museums_galleries`: Museums and galleries
  - `tourist_attractions`: Tourist attractions
  - `information_centers`: Information centers
- `sports_entertainment`: Sports & Entertainment
  - `stadiums_arenas`: Stadiums and arenas
  - `convention_centers`: Convention centers
  - `amusement_parks`: Amusement parks
- `exhibitions_events`: Exhibitions & Events
  - `exhibitions`: Exhibitions
  - `trade_shows_conferences`: Trade shows/Conferences

### Organization size

- `employees_1_10`: 1–10
- `employees_11_50`: 11–50
- `employees_51_100`: 51–100
- `employees_over_100`: More than 100

### Current signage-management method

- `pdf`: PDF
- `spreadsheet`: Spreadsheet
- `other`: Other

## Approved permission catalog

Permission identifiers are stable API and persistence values. `organization` permissions apply within one organization. `site` permissions apply only to an explicitly assigned site. Future product features MUST extend this catalog through an approved specification rather than reusing an unrelated permission.

### Organization and administration

- `organization.view`: View ordinary organization profile and settings.
- `organization.update`: Edit ordinary organization profile and settings.
- `organization.delete`: Delete the organization; Owner only.
- `organization.ownership.transfer`: Transfer sole ownership through the approved transfer flow; Owner only.
- `organization.security.manage`: Change organization security settings.
- `organization.audit.view`: View organization security and administrative audit history.

### Billing

- `billing.view`: View subscription, invoices, and payment-method summaries.
- `billing.manage`: Change plan, payment method, billing details, and cancellation state.

### Members and roles

- `members.view`: View organization members and pending invitations.
- `members.invite`: Invite a person into the organization, subject to the grantable-role boundary.
- `members.remove`: Remove a non-Owner member from the organization.
- `roles.view`: View system roles, custom roles, and their permissions.
- `roles.manage`: Create, rename, edit, or retire permitted custom roles.
- `roles.assign`: Assign or replace a non-Owner organization role within the actor's grant authority.

### Sites and site access

- `sites.view`: View sites visible within the organization assignment.
- `sites.create`: Create a site.
- `sites.update`: Edit ordinary site settings.
- `sites.delete`: Delete a site through the approved destructive-action flow.
- `site_access.view`: View assignments and pending invitations for an authorized site.
- `site_access.invite`: Invite a person to an authorized site with a grantable site role.
- `site_access.remove`: Remove a non-Owner site assignment.
- `site_access.assign`: Assign or replace a site role within the actor's grant authority.

### Product content

- `content.view`: View files, folders, audits, blueprints, signs, mappings, schedules, and related ordinary product content within the effective organization or site scope.
- `content.create`: Create that product content within scope.
- `content.update`: Edit, organize, duplicate, or otherwise operate on that product content within scope.
- `content.delete`: Delete that product content through its approved destructive-action flow within scope.

### Protected system-role mappings

- `Owner`: every current and future permission in the owned organization, with exactly one Owner.
- `Admin`: every approved permission except `organization.delete` and `organization.ownership.transfer`. Admin cannot modify or assign Owner and cannot grant beyond their own effective permissions.
- `Editor`: `organization.view`, `organization.update`, `members.view`, bounded `members.invite`, `roles.view`, `sites.view`, `sites.create`, `sites.update`, `sites.delete`, `site_access.view`, bounded `site_access.invite`, and organization-scoped `content.view`, `content.create`, `content.update`, and `content.delete`. Editor invitations may grant only Editor or Viewer at organization scope and Site Editor or Site Viewer at site scope. Editor cannot remove members or assignments, change roles, manage custom roles, access billing, manage security, transfer ownership, or delete the organization.
- `Viewer`: `organization.view`, `members.view`, `sites.view`, and `content.view` for content otherwise visible within the organization assignment.
- `Site Admin`: `sites.view`, `sites.update`, `site_access.view`, bounded `site_access.invite`, `site_access.remove`, `site_access.assign`, and site-scoped `content.view`, `content.create`, `content.update`, and `content.delete` for assigned sites. Site Admin may grant only Site Editor or Site Viewer and has no organization-wide or unrelated-site permission.
- `Site Editor`: `sites.view` plus site-scoped `content.view`, `content.create`, `content.update`, and `content.delete` for assigned sites.
- `Site Viewer`: `sites.view` plus site-scoped `content.view` for assigned sites.
- Custom role: any approved organization-scoped subset that excludes Owner-only permissions and does not exceed the creator's effective authority. Site-scoped custom roles are not part of the initial authorization model.

## Approved dummy plan catalog

This catalog is intentionally non-production content for Stripe test mode and visual or workflow development. It MUST later be replaced through the schema-validated plan JSON and corresponding environment-specific Stripe Product and Price configuration before a production deployment can enable billing.

- Currency: USD.
- Trial: three calendar months for eligible Plus and Pro subscriptions; payment method collected during onboarding; no charge before trial end.
- Additional site: USD 15 per month in the dummy catalog.
- `plus_monthly`: Plus, monthly, USD 50 per month.
- `plus_annual`: Plus, annual, USD 390 per year, displayed as USD 32.50 per month equivalent and 35% below twelve monthly payments.
- `pro_monthly`: Pro, monthly, USD 150 per month.
- `pro_annual`: Pro, annual, USD 1,170 per year, displayed as USD 97.50 per month equivalent and 35% below twelve monthly payments.
- `enterprise`: Enterprise, custom price, contact sales; no self-service payment or trial activation.
- Plus and Pro descriptions and three feature bullets MAY use clearly marked dummy copy from the approved Figma composition in non-production only. Placeholder copy MUST NOT be represented as a real entitlement and MUST be blocked from production by catalog validation.

## API and integrations

The approved version will add an OpenAPI 3.1 contract before implementation. Expected capability boundaries, with exact routes and schemas still subject to approval, are:

- begin or resume onboarding;
- create a local account or complete an approved external-identity exchange;
- verify email and request a replacement code;
- read and update personal profile;
- read the validated plan catalog, create or resume the Stripe subscription handoff, read normalized payment state, and receive verified Stripe webhooks;
- read and update organization profile;
- read and update discovery responses or mark them skipped;
- inspect and accept an invitation;
- complete onboarding.

All mutation contracts must define authentication state, authorization, idempotency, optimistic or transactional concurrency behavior, stable machine-readable error codes, retry semantics, and generic user-facing messages. Resend is the approved transactional email provider; AWS remains the platform for API Gateway or ALB TLS ingress, ECS/Fargate for Express, RDS PostgreSQL for authoritative state, Secrets Manager and KMS for secrets and encryption, WAF for abuse controls, and CloudWatch/X-Ray for privacy-safe observability. Cognito is excluded. Stripe owns payment collection and subscription processing, while verified webhooks feed Hansel's normalized subscription state. Service choice must not alter product behavior.

## Data and migration

No migration is authorized while the spec is draft. The approved Prisma model is expected to distinguish at least User, Identity, EmailVerificationChallenge, Organization, Site, Membership, Invitation, OnboardingJourney, OnboardingStepState, OrganizationProfile, DiscoveryResponse, PlanSelection, SubscriptionReference, and AuditEvent. Exact fields, enums, retention, indexes, foreign keys, deletion behavior, and tenant constraints require a schema review before migration generation.

Stable identifiers must be stored for taxonomy values while display labels remain changeable. Verification and invitation secrets must never be stored in plaintext. Onboarding state and side effects must share transaction boundaries where consistency requires it. Database constraints must prevent duplicate active memberships, multiple consumption of one invitation, and duplicate completion for one journey.

## Security and privacy

All onboarding traffic must use HTTPS. Hansel owns password authentication and session management; Amazon Cognito is excluded. The first release includes email/password, Google, Microsoft, and Apple. Passwords must never be logged or stored in plaintext and must be processed only by the approved Hansel credential subsystem using the separately approved hashing and password policy. External-provider flows must use server-validated OAuth/OIDC authorization responses and must issue a new Hansel session after identity verification; provider tokens are not application sessions. Verification and invitation endpoints require rate limits by subject and abuse signal without relying exclusively on IP address. Responses must resist account and tenant enumeration. Session fixation, CSRF, XSS, open redirects, OAuth login CSRF, authorization-code replay, nonce replay, token substitution, brute force, IDOR, cross-tenant access, mass assignment, and concurrent double-submission must be covered by design and tests.

Collect only data required by the approved path. Terms of Service acceptance and Privacy Policy acknowledgement use an explicit unchecked control and immutable document versions; marketing consent remains separate and optional. Consent evidence retains the user, policy versions, server timestamp, onboarding path, and IP-derived country or `unknown`, never the full IP address. The approved automated retention schedule and authenticated export, correction, and deletion workflows apply. Payment card data must go directly to Stripe; Hansel must not receive or persist raw card data.

## Reliability and observability

Every mutation must be safe to retry or explicitly report that its outcome is unknown. Email delivery should be asynchronous with durable dispatch, delivery and bounce status, bounded retries, and a replacement-code flow. A dependency outage must not corrupt onboarding state; the UI must distinguish retryable unavailability from invalid input without exposing provider internals.

Record structured events for journey started, step accepted, validation rejected, verification requested, verification succeeded or failed by reason category, invitation accepted or rejected by reason category, billing handoff initiated or completed, onboarding completed, and journey abandoned where determinable. Correlation identifiers must connect web, API, worker, and provider activity. Dashboards and alarms should cover elevated error rate, latency, email failure, verification abuse, invitation failure, payment handoff failure, and state-machine invariant violations without emitting sensitive values.

## Test strategy

- Specification and contract: validate approved status, Figma references, OpenAPI schemas, state transitions, taxonomy identifiers, Prisma constraints, and source-to-requirement traceability.
- Frontend unit: test every screen, field rule, conditional field, back/next/skip state, focus movement, status announcement, retry, and public component interface at 100% statement, branch, function, and line coverage.
- Backend unit: test Zod request and domain validation, state-machine transitions, authorization, normalization, redaction, idempotency, expiry, attempt limits, resend throttling, and error mapping at 100% statement, branch, function, and line coverage.
- Validation parity: drive React Hook Form/Yup and Express/Zod validation from shared accepted and rejected example tables and fail when duplicated constraints or stable error-code mappings diverge.
- PostgreSQL integration: test transactions, uniqueness, tenant isolation, invitation consumption, concurrent retries, resumability, and rollback of partial failures against a real PostgreSQL instance.
- Provider contract: test Resend, identity, and Stripe adapters against deterministic fakes locally and provider test environments where available; verify provider errors, webhook signatures, duplicate and out-of-order delivery, idempotency, trial dates, Price mapping, cancellation, failure, processing, and success; never send real customer email or charge real payment methods in CI.
- Accessibility: automate axe checks for every state and manually verify screen-reader announcements, keyboard order, zoom, reflow, password-manager compatibility, and segmented-code behavior.
- Visual regression: compare approved desktop and responsive Figma-derived states at deterministic viewports; prototype chrome and the laptop shell are excluded.
- E2E: cover each approved entry path, refresh/resume, back navigation, required validation, optional skip, valid and invalid verification, resend policy, expired and consumed invitations, email mismatch, duplicate submission, provider failure, and approved completion destination.
- Security: test account and tenant enumeration resistance, IDOR, CSRF, XSS, open redirect, replay, brute-force protections, token leakage, mass assignment, and cross-tenant concurrency.

## Rollout and rollback

Ship behind a server-controlled feature flag to internal and test tenants first. Apply expand-and-contract migrations before enabling traffic. Use synthetic onboarding accounts and non-production provider environments for smoke tests. Observe completion funnels, invariant failures, email delivery, invitation acceptance, and provider handoffs before gradual expansion.

Disabling the flag must stop new journeys without invalidating already accepted memberships or deleting progress. Application rollback must remain compatible with the expanded schema. Identity, membership, invitation-consumption, and payment side effects require compensating procedures rather than destructive database rollback. No rollout begins until security, accessibility, product, design, data, and operational approvals are recorded.

## Legacy product evidence

The private repository [hansel-app-dev/hanselapp](https://github.com/hansel-app-dev/hanselapp), inspected at commit `549eabf66f3dc6e3f1f0956d2402e5582cc3b3e0` dated `2025-11-11`, is a non-authoritative product-archaeology source. Its implementation, architecture, security choices, dependencies, schemas, and source code MUST NOT be copied into this application. The following concepts and data are candidates for product approval because they align with or clarify the Figma flow:

- Entry paths: an owner creates a new organization; an invitee joins an organization; or an invitee collaborates on one site.
- Intended new-owner sequence: create account, verify email, complete personal profile, choose a plan or trial, complete payment when applicable, create the organization profile, answer or skip discovery, then enter the dashboard.
- Intended invitee sequence: accept an invitation with first name, last name, and password; complete job title and department; then enter the dashboard without plan, payment, or organization-creation steps.
- Identity-provider vocabulary: email, Google, Microsoft, and Apple. Only Google had a discernible provider flow, so the presence of all four names does not prove release readiness.
- Candidate job titles: Manager, Facility manager, Project manager, In-house designer, Signage wayfinding designer, and Other.
- Candidate departments: Marketing & Communications, Development / Advancement Office, Facilities Management / Campus Maintenance, and Other.
- Candidate industry and place/service taxonomy:
  - Healthcare: Hospitals, Clinics, Aged care facilities.
  - Education: University/Schools.
  - Retail: Shopping malls, Department stores, Retail store.
  - Corporate / Commercial: Office buildings, Co-working spaces, Business parks, Headquarters.
  - Transport & Infrastructure: Airports, Train/Metro/Bus/Ferry, Parking structures.
  - Government & Civic: Council buildings, Public libraries, Community centers, Courthouses, Licensing or service centers, Community halls.
  - Construction & Industrial: Construction sites, Warehouses, Manufacturing plants, Logistics hubs, Mining operations.
  - Hospitality & Tourism: Hotels and resorts, Hostels and lodges, Museums and galleries, Tourist attractions, Information centers.
  - Sports & Entertainment: Stadiums and arenas, Convention centers, Amusement parks.
  - Exhibitions & Events: Exhibitions, Trade shows/Conferences.
- Candidate organization-size bands: 1–10, 11–50, 51–100, and More than 100.
- Candidate current signage-management methods: PDF, Spreadsheet, and Other, with conditional free text for Other; challenges remain optional free text.
- Legacy organization-role evidence included Owner, Admin, Member, Viewer, and Collaborator, while site roles included Admin, Editor, and Viewer. The approved model supersedes that vocabulary: `Member` is replaced by `Editor`, and `Collaborator` is not an active system role.
- Candidate invitation states: Pending, Accepted, Declined, Expired, and Cancelled, with a seven-day legacy expiry. Existing-user acceptance was not supported clearly enough to establish intended behavior.
- Candidate verification policy: a five-digit numeric code with a 15-minute expiry. This conflicts with the Figma copy stating 24 hours and therefore requires an explicit decision.
- Candidate password baseline: at least eight characters including uppercase, lowercase, number, and special character. No evidence established maximum length, compromised-password screening, Unicode handling, attempt controls, or the final managed-identity policy.
- Billing concept: plans were data-driven, monthly or yearly, and non-Enterprise choices led to Stripe payment in USD; Enterprise led to a sales call and a trial bypassed payment. Prices, entitlements, annual-discount copy, and descriptions were incomplete or placeholders.
- Geographic evidence: Australia was the only available country value, which is insufficient to establish a global or Australia-only product rule.

The legacy data model also demonstrates why implementation must be redesigned: it associated a user directly with one organization and associated a subscription with a user, while the desired SaaS and invitation concepts imply explicit memberships and likely organization-owned subscriptions. Verification codes, invitation credentials, refresh credentials, and provider credentials require the stronger digesting, scoping, lifecycle, and transactional rules already stated in this specification.

## Open questions

No approval-blocking questions remain for this onboarding slice. The following decision record defines its approved implementation. Items explicitly deferred to a separate specification do not authorize that deferred production behavior:

1. **Decided:** The first release supports Hansel-managed email/password plus Google, Microsoft, and Apple. Hansel owns application sessions and provider registrations; Amazon Cognito is excluded. Each environment has separate clients and exact HTTPS callbacks, with production at `app.hanselapp.io`; Apple development uses registered HTTPS rather than localhost. Scopes are Google and Microsoft `openid email profile` and Apple `name email`; no offline or downstream API access or provider-token persistence is allowed. Provider identities use immutable subject, email-only automatic linking is forbidden, existing-account linking requires authentication and explicit approval, provider email changes do not transfer ownership, Apple relay addresses are valid distinct addresses, and users cannot unlink their final authentication method.
2. **Decided:** Hansel email verification uses a six-digit numeric code valid for 15 minutes, permits five failed attempts, allows resending after 60 seconds with at most five sends per rolling hour, invalidates all previous codes when replaced, consumes the code on success, stores only a keyed digest, and returns generic anti-enumeration responses. A provider identity skips this step only for an explicitly provider-verified usable email accepted by the account-linking policy. Verified-email password recovery reuses this challenge policy but authorizes only one bounded password reset.
3. **Decided:** Hansel passwords use a 15–128 Unicode-character boundary and require at least one Unicode uppercase letter, lowercase letter, number, and punctuation or symbol character; whitespace is allowed but does not satisfy the special-character requirement, while paste, password managers, and generators remain supported. Passwords use Argon2id with a unique salt, an application pepper in AWS Secrets Manager, and a minimum baseline of `m=19456`, `t=2`, `p=1`. Production-equivalent Fargate load testing must increase that work factor as capacity permits while targeting 250–500 milliseconds per hash, store parameters with every hash, rehash older settings after successful authentication, bound concurrent hashing, and use the approved controlled-reset or dual-pepper rotation procedure. Compromised-password and common-password blocklist screening is explicitly excluded from the first release, is documented alongside the composition policy as a deviation from current NIST guidance, and must not be claimed as conformant. Credential endpoints use the account, operation, source-network, CloudFront, and AWS WAF thresholds in REQ-079 through REQ-081 with generic anti-enumeration behavior and atomic shared state. Ten one-time recovery codes with at least 128 bits of randomness are issued before onboarding completion and stored only as keyed digests. Recovery revokes every session and notifies verified channels; support cannot override it. Loss of every recovery method requires a separate manual identity-proofing specification.
4. **Decided:** The legacy/Figma job-title, department, industry, place/service, organization-size, and signage-management catalogs are approved with the stable identifiers in Approved product taxonomies. `Other` applies only to job title, department, and signage-management method and requires matching bounded text. Country uses the complete ISO 3166-1 alpha-2 catalog with Australia locale-prioritized but not exclusive. Label localization remains permitted without changing identifiers.
5. **Decided:** First name, last name, job title, department, organization name, country, industry, place/service, and size are required for the applicable new-owner steps. Names are 1–100 Unicode characters, organization name is 1–200, `Other` values are 1–100, and challenges are optional up to 1,000; text is trimmed and NFC-normalized. Discovery remains optional and skippable without fabricated data.
6. **Decided for non-production:** Use the Approved dummy plan catalog from schema-validated JSON: Plus and Pro monthly or annual in USD, 35% annual dummy discount, USD 15 monthly additional-site dummy price, three-calendar-month trial, and Enterprise contact sales. Dummy descriptions and feature bullets may support test-mode UI only. Still required before production: approve real plan names, prices, currency coverage, entitlements, additional-site rules, tax treatment, trial eligibility and repetition policy, Enterprise workflow, and production Stripe Product and Price identifiers.
7. **Decided for onboarding:** Use Stripe-hosted Checkout in subscription mode with card as the only enabled payment-method type. Checkout occurs after self-service plan selection and before organization profile; the server supplies the approved Price and three-calendar-month trial, with no charge before trial end. Cancellation returns to the payment page with `Payment cancelled.` Failure returns with `Payment failed. Please try again.` Plan and progress are retained, retries are idempotent, and a verified Stripe webhook—not the browser return—authorizes progression. Trial-end collection failure, dunning, refunds, disputes, production tax, and ongoing billing support belong to a separate billing-lifecycle specification and do not block implementation of the test-mode onboarding slice.
8. **Decided:** A new-organization path continues from confirmed Stripe state to organization profile, optional discovery, and the new organization dashboard. An organization invitation ends at the invited organization dashboard. A site invitation ends at the invited site. Enterprise creates or resumes a sales-contact request, shows a confirmation page, preserves progress, and grants no dashboard or paid entitlement until authorized activation.
9. **Decided for onboarding:** The organization creator is the sole initial protected Owner with every permission. The stable permission catalog and mappings for Admin, Editor, Viewer, Site Admin, Site Editor, Site Viewer, and organization-scoped custom roles are approved in Approved permission catalog. Editor may invite only Editor or Viewer organization members and Site Editor or Site Viewer collaborators, but cannot remove members or assignments or change roles. `Member` and `Collaborator` are not active roles. Invitations retain the approved seven-day, single-use, email-bound, transactional policy; organization and site invitations default respectively to Editor and Site Viewer. Ownership transfer is Owner-initiated, targets an active Admin, requires recent reauthentication and explicit target acceptance within 24 hours, atomically swaps Owner and Admin, permits one pending request, notifies both parties, and cannot be performed silently by support. Decline is explicit, confirmed, idempotent, terminal, reason-free, creates no access, and notifies the inviter; leaving the page keeps the invitation pending, and later access requires a new invitation. Ordinary account recovery cannot change ownership or bypass invitations. Emergency ownership recovery and the role-management view each require their own approved specifications and designs.
10. **Decided:** Account creation and invitation acceptance use the named primary action as consent after visibly stating that the action accepts immutable published Terms of Service and Privacy Policy versions; no separate consent checkbox is shown. The frontend sends `acceptsTerms: true` and both versions to the unchanged backend contract, while marketing consent remains separate and unselected. Evidence stores user, versions, server timestamp, onboarding path, and IP-derived country or `unknown`, but not the full IP address.
11. **Decided:** Incomplete journeys expire after 30 days of inactivity; verification records are deleted within 24 hours after expiry; terminal invitation metadata is retained for 90 days; security, consent, membership, role, and access audits are retained for seven years; optional discovery answers remain until organization deletion or authorized removal; payment storage is limited to Stripe references, normalized state, and legally required accounting metadata. Authenticated export, correction, and deletion workflows must enforce tenant and legal boundaries.
12. **Decided:** Support responsive reflow from 320 CSS pixels through desktop, portrait and landscape, 200% zoom, and text-spacing overrides. Narrow layouts use a single logical column without horizontal page scrolling; approved desktop Figma composition guides wider layouts, excluding the prototype laptop shell.
13. **Decided:** All non-payment onboarding forms and Google, Microsoft, and Apple redirects work without client JavaScript through HTTPS form submissions and server redirects. JavaScript progressively enhances the experience. Stripe payment is the sole approved exception and shows a server-rendered explanation and safe resume instructions when JavaScript is unavailable. React forms use React Hook Form with Yup; Express uses authoritative Zod validation; shared example-table contract tests prevent drift.
14. **Decided:** Hansel uses opaque, digest-backed cookie sessions with `Secure`, `HttpOnly`, and `SameSite=Lax`; access credentials expire within 15 minutes; refresh credentials rotate on use; each session family has a non-sliding 30-day lifetime; reuse revokes the family; users may hold at most five active families and can inspect and revoke them; logout revokes the current family; logout-everywhere, password change, and recovery revoke every family; state-changing requests require CSRF protection. Device information must remain privacy-minimized and must not become a persistent fingerprint.
