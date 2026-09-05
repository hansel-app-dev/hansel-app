# FigJam object catalog

This document preserves the product objects and data points shown in the Hansel Software Structure FigJam board so feature specifications can reference them without repeatedly re-reading the board.

## Source and authority

- Source: [Hansel Software Structure FigJam board](https://www.figma.com/board/knRFrSCIwWv7vrzCb2wTFU/Software-Structure?node-id=0-1&p=f)
- File key: `knRFrSCIwWv7vrzCb2wTFU`
- Root node: `0:1`
- Captured: `2026-09-05`
- Extraction: Figma's structured FigJam tree; a follow-up screenshot was unavailable because the connected Professional View seat reached its MCP call limit.

This catalog is discovery evidence, not an executable feature specification or database schema. [CONTEXT.md](../../CONTEXT.md) defines canonical product language. An approved feature specification remains the single source of truth for behavior, validation, authorization, cardinality, lifecycle, retention, API, and persistence decisions. If this catalog conflicts with an approved specification, the specification wins and the conflict must be recorded here.

## Board legend

The board communicates categories through sticky-note color and position rather than connectors:

- Blue: object
- Green: core content
- Yellow: metadata or policy data
- Teal: nested object

The separate `Organisation/Workspace` shape is the parent context for the role-and-permission area. The catalog uses the canonical term **Organization**.

## Objects and data points

Labels in the following table preserve the board's wording. Canonical interpretations are recommendations for feature discussion; they do not fill gaps in the source.

| Object                  | FigJam node | Core content                                 | Metadata or policy data                                                                 | Nested objects                                                   |
| ----------------------- | ----------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Organization            | `25:501`    | Name                                         | Sites allowance; Seats allowance; Space (MB) allowance; Date / time created; Activities | Sites; Allocation Plans; Signs; Documents; Images; Videos; Users |
| User                    | `24:84`     | Name; Lastname; Profile Pic; Email; Password | Role; Date / time joined; Site can access                                               | Sign Comments; Allocation Plan Comments; Sites                   |
| Site                    | `24:18`     | Name; Photo / Cover                          | Users with access; Date / time modified (shown twice)                                   | Allocation Plans; Sites; Sign Comments; Allocation Plan Comments |
| Allocation Plan         | `24:47`     | Name; PDF / Image                            | Date / time created; Date / time modified                                               | Signs                                                            |
| Sign                    | `24:25`     | Code; Photos                                 | Sign Type; Date / time created; Date / time modified; State                             | Sign Comments                                                    |
| Document                | `24:60`     | Filename                                     | Linked to; Tags / Category; Date uploaded; Uploaded by; Max file size                   | None shown                                                       |
| Image                   | `24:67`     | Filename                                     | Linked to; Date uploaded; Uploaded by; Max file size                                    | None shown                                                       |
| Video                   | `24:74`     | Filename                                     | Linked to; Date uploaded; Uploaded by; Max file size                                    | None shown                                                       |
| Sign Comment            | `30:835`    | Text; Image                                  | Posted by; Date posted; User Tag                                                        | None shown                                                       |
| Allocation Plan Comment | `30:874`    | Text; Image                                  | Posted by; Date posted; User Tag                                                        | None shown                                                       |

### Canonical interpretation notes

- `Lastname` should be discussed as **last name**, paired with **first name** rather than the board's generic `Name`.
- `Profile Pic` should be discussed as **profile image** in specifications unless exact UI copy requires otherwise.
- `Site can access` and `Users with access` both point toward **Site Access**, but the board does not define their cardinality or permission precedence.
- `Photo / Cover`, `Photos`, `PDF / Image`, and comment `Image` describe media usage, but the board does not say whether these are owned records, references to the Image object, or embedded values.
- `Linked to` implies an asset association but does not identify the allowed target object types or whether one asset may have multiple links.
- `Activities` appears in the Organization column as metadata, while the canonical model treats **Activity** as a product object. Its fields and retention rules are not shown.
- `Max file size` reads like an upload policy rather than immutable metadata on each asset. A feature specification must decide where that rule belongs.

## Nesting map

These relationships are inferred only from the board's teal `Nestings` columns:

- Organization contains Users, Sites, Allocation Plans, Signs, Documents, Images, and Videos.
- User relates to Sites, Sign Comments, and Allocation Plan Comments.
- Site relates to Allocation Plans, Sign Comments, Allocation Plan Comments, and a self-referential item labelled `Sites`.
- Allocation Plan contains Signs.
- Sign contains Sign Comments.

The board provides no connector semantics, identifiers, ownership rules, optionality, ordering, deletion behavior, or relationship cardinalities. Those details must never be inferred from proximity alone.

## Organization roles and permissions

The same board contains a role area under `Organisation/Workspace`. This is the captured wording, normalized only for Markdown:

### Owner — paid seat (`1:12`)

- Full access to account settings.
- User management: create, invite, and delete.
- Full access to and management of sites created by administrators and members.
- Can create and manage sites.
- Can manage signs: add, edit, delete, and comment.

### Owner — free account (`2:529`)

- Full access to account settings.
- User management requires an account upgrade.
- Full access to and management of sites created by administrators and members.
- Can create and manage one site only.
- Can manage ten signs only: add, edit, delete, and comment.
- Can comment on shared sites.

### Administrator (`2:157`)

- Can create and manage sites.
- Can manage signs: add, edit, delete, and comment.
- Can invite members and viewers to sites.
- Can share sites.

### Editor (`1:28`)

- Can manage signs: add, edit, delete, and comment.
- Can share sites.

### Viewer (`1:37`)

- Can view sites shared with them.
- Can comment.

Approved feature specifications may further constrain these broad statements. In particular, billing, ownership transfer, custom roles, and cross-organization sharing require their own acceptance criteria.

## Known ambiguities requiring specification

Do not implement any of the following without resolving it in the relevant feature specification:

1. The Site column contains a teal nested item labelled `Sites` (`25:310`), creating an unexplained self-reference. It may be intentional or a board typo.
2. The board places `Role` under User, while Hansel's canonical language assigns an Organization Role to a Membership so one User can participate in more than one Organization.
3. The board places `Password` under User but does not describe authentication providers or storage. Existing authentication specifications require passwords never to be stored in plain text; the label is not authorization to expose or persist a raw password.
4. `Users with access`, `Site can access`, and `shared sites` do not define whether access comes from Organization Role, a direct Site Access grant, an invitation, or a combination.
5. The Site column contains two separate notes both labelled `Date / time modified` (`25:173` and `31:925`) and no note labelled `Date / time created`; a feature must not silently rename either note.
6. The board does not define whether an Organization can have multiple Owners or how ownership may be transferred.
7. No lifecycle values are supplied for Sign `State`, invitations, comments, assets, Activities, or deletion and archival.
8. No upload types, byte limits, virus scanning, retention, privacy, or storage-allocation behavior is supplied for Documents, Images, or Videos.
9. `User Tag` does not define mention syntax, notification behavior, or whether tagged users must already have access to the parent object.
10. The board provides no IDs, uniqueness rules, required/optional markers, string limits, time-zone rules, audit semantics, or tenant-isolation boundaries.

## Source node index

Use these IDs to return to an exact FigJam note when its wording changes or needs clarification.

| Object                  | Data-point nodes                                                                                                                                                 | Nested-object nodes                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Organization            | Name `25:508`; Sites allowance `39:988`; Seats allowance `39:981`; Space (MB) allowance `25:562`; Date / time created `25:534`; Activities `30:828`              | Sites `25:589`; Allocation Plans `25:596`; Signs `25:572`; Documents `25:600`; Images `25:601`; Videos `25:602`; Users `25:579` |
| User                    | Name `24:91`; Lastname `25:342`; Profile Pic `25:338`; Email `24:116`; Password `46:1036`; Role `24:123`; Date / time joined `25:180`; Site can access `39:1014` | Sign Comments `31:901`; Allocation Plan Comments `31:909`; Sites `39:995`                                                       |
| Site                    | Name `25:154`; Photo / Cover `25:444`; Users with access `25:165`; Date / time modified `25:173`; Date / time modified `31:925`                                  | Allocation Plans `25:303`; Sites `25:310`; Sign Comments `31:913`; Allocation Plan Comments `31:914`                            |
| Allocation Plan         | Name `25:208`; PDF / Image `25:215`; Date / time created `25:229`; Date / time modified `25:236`                                                                 | Signs `25:296`                                                                                                                  |
| Sign                    | Code `25:246`; Photos `25:253`; Sign Type `25:437`; Date / time created `25:271`; Date / time modified `25:272`; State `25:360`                                  | Sign Comments `25:373`                                                                                                          |
| Document                | Filename `25:391`; Linked to `39:932`; Tags / Category `25:402`; Date uploaded `25:410`; Uploaded by `25:420`; Max file size `39:939`                            | None shown                                                                                                                      |
| Image                   | Filename `25:471`; Linked to `39:953`; Date uploaded `25:482`; Uploaded by `25:483`; Max file size `39:967`                                                      | None shown                                                                                                                      |
| Video                   | Filename `25:478`; Linked to `39:960`; Date uploaded `25:490`; Uploaded by `25:491`; Max file size `39:974`                                                      | None shown                                                                                                                      |
| Sign Comment            | Text `30:842`; Image `30:863`; Posted by `30:849`; Date posted `30:856`; User Tag `30:870`                                                                       | None shown                                                                                                                      |
| Allocation Plan Comment | Text `30:875`; Image `30:876`; Posted by `30:877`; Date posted `30:878`; User Tag `30:879`                                                                       | None shown                                                                                                                      |

## Current implementation alignment

This section is an index for discovery, not a promise that the current data model is complete.

| Domain concept                        | Current repository representation                                  | Alignment                                            |
| ------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| Organization                          | Prisma `Tenant`; product contracts and UI use Organization         | Partial naming mismatch; keep `Tenant` internal only |
| User                                  | Prisma `User` plus provider and credential records                 | Implemented for current authentication scope         |
| Membership and Organization Role      | Prisma `Membership.roleId`; centralized permission map             | Implemented for current site scope                   |
| Plan allowances                       | `OnboardingPlanSelection` including `maximumSites`                 | Partial; seat and storage allowances are not modeled |
| Site and Site Access                  | Prisma `Site`, `SiteGrant`, and `SiteInvitation`                   | Implemented for approved creation scope              |
| Allocation Plan                       | No approved persistent model                                       | Source-only concept                                  |
| Sign                                  | No approved persistent model                                       | Source-only concept                                  |
| Document, Image, Video                | No approved persistent models                                      | Source-only concepts                                 |
| Sign Comment, Allocation Plan Comment | No approved persistent models                                      | Source-only concepts                                 |
| Activity                              | Activity route placeholder only; no approved activity record model | Partial/source-only concept                          |

When code and this table diverge, update the table in the same documentation change or explicitly explain why the new specification supersedes it.

## How feature work must use this catalog

Before drafting or implementing a feature:

1. Read [CONTEXT.md](../../CONTEXT.md) and use its canonical terms.
2. Find every affected object in this catalog and cite the relevant section in the feature specification's `Domain references` field.
3. Treat listed data points as discovery prompts, not automatically required fields.
4. Turn every selected data point, relationship, and permission into explicit testable requirements, including ownership, visibility, validation, lifecycle, privacy, and failure behavior.
5. Put unresolved conflicts in the specification's Open questions and stop implementation until they are resolved and the specification is approved.
6. Update this catalog when the source board changes or an approved product decision resolves one of its ambiguities.
