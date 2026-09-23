# Hansel Domain Language

Hansel helps organizations manage sites, signs, plans, media, and the people who can work with them. These terms are the canonical product language used when writing feature specifications.

## Identity and access

**Organization**:
A customer-owned workspace containing its members, sites, content, and plan allowances.
_Avoid_: Organisation, Workspace, Account, Tenant

**User**:
A person with a Hansel identity, independent of any particular organization.
_Avoid_: Member when no organization relationship is meant

**Membership**:
The relationship that joins a User to an Organization and carries that User's Organization Role.
_Avoid_: User Role, Seat

**Organization Role**:
The named permission set held by a Membership: Owner, Administrator, Editor, or Viewer.
_Avoid_: Account Role, User Type

**Owner**:
The highest Organization Role, initially held by the User who creates the Organization.
_Avoid_: Superadmin, Primary Admin

**Administrator**:
An Organization Role that can manage sites, signs, sharing, and users but does not own the Organization.
_Avoid_: Admin in product copy

**Editor**:
An Organization Role that can manage signs and share sites but cannot manage billing, users, or roles.
_Avoid_: Collaborator, Contributor

**Viewer**:
An Organization Role for viewing shared sites and commenting without content-management permission.
_Avoid_: Read-only User, Guest

**Site Access**:
The relationship that determines which Site a Membership may use and what it may do there.
_Avoid_: Site can access, Site Membership

**Site Access Scope**:
The audience rule selected for a Site: Organization, People You Invite, or Private.
_Avoid_: Workspace Access, Visibility when access rights are meant

## Managed content

**Site**:
A place or service managed in Hansel that groups its allocation plans, signs, access, media, and discussion.
_Avoid_: Property, Location when referring to the whole managed object

**Allocation Plan**:
A named plan for a Site with exactly one uploaded PDF or Image that organizes the Signs associated with that file. The Allocation Details dropdown switches between Allocation Plans within the Site.
_Avoid_: Floor Plan when the plan is not necessarily a floor

**Area**:
A rectangular annotation owned by one Allocation Plan and its file, separate from a Sign and the Signage Schedule. The approved Add area scope uses Floor, Environmental and Blue, with its own code, content, orientation and geometry.
_Avoid_: Sign when referring to an Area annotation

**Sign**:
A managed signage record identified by a code and described by its type and state.
_Avoid_: Marker, Pin

**Document**:
An uploaded file treated as a document that may be linked to another Hansel object.
_Avoid_: Attachment when referring to the stored object itself

**Image**:
An uploaded image asset that may be linked to another Hansel object.
The approved Sign Photos feature stores PNG/JPEG Images owned by a Sign separately from its Documents. The drawer uses “Photos” as UI copy; deleting one Image does not delete its Sign.
_Avoid_: Photo when the asset may not be a photograph

**Video**:
An uploaded video asset that may be linked to another Hansel object.
_Avoid_: Clip

**Sign Comment**:
A discussion entry attached to a Sign.
The approved `sign-comments` scope includes one-level replies, private PNG/JPEG/PDF attachments, Site-access Membership mentions without notifications, and emoji reactions. All current Site-access roles may participate. Sign Comments are distinct from Site Activity comments and the legacy Signage Schedule comment cell; deleting the shared Sign removes its discussion.
_Avoid_: Note, Message

**Allocation Plan Comment**:
A discussion entry attached to an Allocation Plan.
_Avoid_: Plan Note, Message

**Activity**:
A record of a meaningful action within an Organization.
_Avoid_: Event when referring to product-facing history

**Site Comment**:
A text discussion entry attached directly to a Site and represented as Site Activity.
_Avoid_: Sign Comment, Allocation Plan Comment, Message

## Plans and allowances

**Plan**:
The commercial offering selected for an Organization, defining its allowances and payment requirements.
_Avoid_: Package, Tier when naming the selected offering

**Site Allowance**:
The maximum number of Sites permitted by a Plan.
_Avoid_: Site quota in product copy

**Seat Allowance**:
The maximum number of paid Memberships permitted by a Plan.
_Avoid_: User allowance

**Storage Allowance**:
The maximum storage capacity available to an Organization.
_Avoid_: Space allowance
