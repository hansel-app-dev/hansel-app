/** @spec sites-access-scope REQ-001..REQ-015, REQ-022..REQ-025 @figma 2029:1630, 2097:6260, 2130:1285, 2151:1744 */
import { yupResolver } from '@hookform/resolvers/yup';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import type {
  CreateSiteRequest,
  CreateSiteResponse,
  SiteAssignment,
  SiteAccessScope,
  SiteMemberChoice,
  SiteOrganizationAccess,
  SiteRole,
} from '@hansel/contracts';
import {
  Button,
  Modal,
  SelectField,
  TextField,
} from '../design-system/index.js';
import { AppSymbol } from '../application-shell/ApplicationShell.js';
import { SiteCreateError } from '../api.js';

interface StepOneValues {
  name: string;
  organizationAccess: SiteOrganizationAccess;
}

interface InvitationValues {
  email: string;
  role: SiteRole;
}

const stepOneSchema: yup.ObjectSchema<StepOneValues> = yup.object({
  name: yup
    .string()
    .transform((value: string) => value.normalize('NFC'))
    .trim()
    .required('Enter a site name.')
    .test('unicode-length', 'Use 100 characters or fewer.', (value) =>
      value ? Array.from(value).length <= 100 : true,
    ),
  organizationAccess: yup
    .mixed<SiteOrganizationAccess>()
    .oneOf(['VIEW_COMMENT', 'EDIT_MANAGE'])
    .required(),
});

const invitationSchema: yup.ObjectSchema<InvitationValues> = yup.object({
  email: yup
    .string()
    .trim()
    .lowercase()
    .email('Enter a valid email address.')
    .required('Enter an email address.'),
  role: yup
    .mixed<SiteRole>()
    .oneOf(['ADMINISTRATOR', 'EDITOR', 'VIEWER'])
    .required(),
});

const roleOptions = [
  { id: 'ADMINISTRATOR', label: 'Administrator' },
  { id: 'EDITOR', label: 'Editor' },
  { id: 'VIEWER', label: 'Viewer' },
] as const;

const accessScopeOptionsById: Record<
  SiteAccessScope,
  { icon: string; id: SiteAccessScope; label: string }
> = {
  ORGANIZATION: {
    id: 'ORGANIZATION',
    label: 'Organization',
    icon: 'corporate_fare',
  },
  PEOPLE_INVITED: {
    id: 'PEOPLE_INVITED',
    label: 'People you invite',
    icon: 'lock',
  },
  PRIVATE: { id: 'PRIVATE', label: 'Private', icon: 'visibility_off' },
};
const accessScopeOptions = Object.values(accessScopeOptionsById);
const nextAccessScope: Record<SiteAccessScope, SiteAccessScope> = {
  ORGANIZATION: 'PEOPLE_INVITED',
  PEOPLE_INVITED: 'PRIVATE',
  PRIVATE: 'ORGANIZATION',
};
const previousAccessScope: Record<SiteAccessScope, SiteAccessScope> = {
  ORGANIZATION: 'PRIVATE',
  PEOPLE_INVITED: 'ORGANIZATION',
  PRIVATE: 'PEOPLE_INVITED',
};

const accessScopeHelp: Record<SiteAccessScope, string> = {
  ORGANIZATION: 'Only people in your organization',
  PEOPLE_INVITED: 'Only people you directly invite',
  PRIVATE: 'Only you and organization owners',
};

const errorMessages = {
  sites_forbidden: 'You do not have permission to create a site.',
  sites_upgrade_required:
    'Your current plan does not allow another site or team invitation.',
  sites_paid_seat_required:
    'An external Administrator or Editor needs a paid seat.',
  sites_conflict: 'This request changed while it was being retried. Try again.',
  sites_unavailable: "We couldn't create the site. Please try again.",
} as const;

function MemberIdentity({
  displayName,
  email,
  initials,
  status,
}: {
  displayName: string;
  email?: string;
  initials: string;
  status: 'Internal' | 'External';
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-muted text-xs font-semibold text-content">
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {displayName}
        </span>
        <span className="block truncate text-xs text-content-muted">
          {email ? `${email} · ` : ''}
          {status}
        </span>
      </span>
    </div>
  );
}

export interface AddSiteModalProps {
  canInviteMembers: boolean;
  createSite: (input: CreateSiteRequest) => Promise<CreateSiteResponse>;
  creator: SiteMemberChoice;
  members: SiteMemberChoice[];
  onClose: () => void;
  onCreated: (destination: string) => void;
  organizationName: string;
}

export function AddSiteModal({
  canInviteMembers,
  createSite,
  creator,
  members,
  onClose,
  onCreated,
  organizationName,
}: AddSiteModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [accessScope, setAccessScope] =
    useState<SiteAccessScope>('ORGANIZATION');
  const [accessOpen, setAccessOpen] = useState(false);
  const [activeAccessScope, setActiveAccessScope] =
    useState<SiteAccessScope>('ORGANIZATION');
  const [accessError, setAccessError] = useState('');
  const [assignments, setAssignments] = useState<SiteAssignment[]>([]);
  const [submissionError, setSubmissionError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const creating = useRef(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const {
    formState: { errors: stepErrors, isDirty: stepOneDirty },
    getValues,
    register,
    trigger,
  } = useForm<StepOneValues>({
    defaultValues: {
      name: 'New site',
      organizationAccess: 'VIEW_COMMENT',
    },
    resolver: yupResolver(stepOneSchema),
  });
  const invitation = useForm<InvitationValues>({
    defaultValues: { email: '', role: 'ADMINISTRATOR' },
    resolver: yupResolver(invitationSchema),
  });
  const memberByEmail = new Map(
    members.map((member) => [member.email.toLowerCase(), member]),
  );
  const hasPaidSeatWarning = assignments.some(
    ({ email, role }) => !memberByEmail.has(email) && role !== 'VIEWER',
  );
  const selectedAccess = accessScopeOptionsById[accessScope];
  const selectedAccessLabel =
    accessScope === 'ORGANIZATION' ? organizationName : selectedAccess.label;
  const isDirty =
    stepOneDirty || accessScope !== 'ORGANIZATION' || assignments.length > 0;
  const requestClose = () => {
    if (
      isDirty &&
      !window.confirm('Discard your site details and close this dialog?')
    )
      return;
    onClose();
  };
  const addAssignment = invitation.handleSubmit((value) => {
    const next = { email: value.email.trim().toLowerCase(), role: value.role };
    if (next.email === creator.email.toLowerCase()) {
      invitation.setError('email', { message: 'You already have access.' });
      return;
    }
    if (!canInviteMembers && !memberByEmail.has(next.email)) {
      invitation.setError('email', {
        message: 'Upgrade your plan to invite external team members.',
      });
      return;
    }
    setAssignments((current) => [
      ...current.filter(({ email }) => email !== next.email),
      next,
    ]);
    invitation.reset({ email: '', role: value.role });
  });
  const chooseAccessScope = (nextScope: SiteAccessScope) => {
    if (nextScope === 'PEOPLE_INVITED' && !canInviteMembers) {
      setAccessError('Upgrade your plan to invite people to this site.');
      return;
    }
    setAccessScope(nextScope);
    setAccessOpen(false);
    setAccessError('');
    setSubmissionError('');
  };
  const submit = async () => {
    if (creating.current) return;
    creating.current = true;
    setSubmissionError('');
    setIsCreating(true);
    try {
      const values = getValues();
      const common = {
        idempotencyKey: idempotencyKey.current,
        name: values.name.trim().normalize('NFC'),
      };
      const request: CreateSiteRequest =
        accessScope === 'ORGANIZATION'
          ? {
              ...common,
              accessScope,
              organizationAccess: values.organizationAccess,
            }
          : accessScope === 'PEOPLE_INVITED'
            ? { ...common, accessScope, assignments }
            : { ...common, accessScope };
      const result = await createSite(request);
      onCreated(result.destination);
    } catch (error) {
      setSubmissionError(
        error instanceof SiteCreateError
          ? errorMessages[error.code]
          : errorMessages.sites_unavailable,
      );
    } finally {
      creating.current = false;
      setIsCreating(false);
    }
  };

  return (
    <Modal onClose={requestClose} title="Add new site">
      <header className="flex items-center justify-between border-b border-control-border px-6 py-5">
        <h2 className="text-xl font-semibold">Add new site</h2>
        <button
          aria-label="Close"
          className="grid size-9 place-items-center rounded-control hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
          onClick={requestClose}
          type="button"
        >
          <AppSymbol className="!size-5 text-[20px]">close</AppSymbol>
        </button>
      </header>

      {step === 1 ? (
        <div className="grid gap-7 px-6 py-6">
          <TextField
            error={stepErrors.name?.message}
            label="Name"
            maxLength={100}
            {...register('name')}
          />
          <section aria-labelledby="site-access-heading" className="grid gap-3">
            <h3 className="text-sm font-semibold" id="site-access-heading">
              Who has access
            </h3>
            <div className="relative">
              <button
                aria-activedescendant={
                  accessOpen
                    ? `site-access-option-${activeAccessScope}`
                    : undefined
                }
                aria-controls="site-access-options"
                aria-describedby="site-access-help"
                aria-expanded={accessOpen}
                aria-haspopup="listbox"
                aria-labelledby="site-access-heading"
                className="flex min-h-14 w-full items-center gap-3 rounded-md border border-control-border bg-surface px-4 py-3 text-left shadow-control outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                onClick={() => {
                  setActiveAccessScope(accessScope);
                  setAccessOpen((current) => !current);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && accessOpen) {
                    event.preventDefault();
                    event.stopPropagation();
                    setAccessOpen(false);
                    return;
                  }
                  if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    setAccessOpen(true);
                    setActiveAccessScope(
                      event.key === 'Home' ? 'ORGANIZATION' : 'PRIVATE',
                    );
                    return;
                  }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setAccessOpen(true);
                    setActiveAccessScope((current) =>
                      event.key === 'ArrowDown'
                        ? nextAccessScope[current]
                        : previousAccessScope[current],
                    );
                    return;
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (!accessOpen) {
                      setAccessOpen(true);
                      return;
                    }
                    chooseAccessScope(activeAccessScope);
                  }
                }}
                role="combobox"
                type="button"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded bg-surface-muted">
                  <AppSymbol className="!size-5 text-[20px]">
                    {selectedAccess.icon}
                  </AppSymbol>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {selectedAccessLabel}
                </span>
                <AppSymbol className="!size-5 text-[20px] text-content-muted">
                  {accessOpen ? 'expand_less' : 'expand_more'}
                </AppSymbol>
              </button>
              {accessOpen ? (
                <ul
                  className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-control-border bg-surface py-1 shadow-lg"
                  id="site-access-options"
                  role="listbox"
                >
                  {accessScopeOptions.map((option) => {
                    const disabled =
                      option.id === 'PEOPLE_INVITED' && !canInviteMembers;
                    const label =
                      option.id === 'ORGANIZATION'
                        ? organizationName
                        : option.label;
                    return (
                      <li
                        aria-disabled={disabled || undefined}
                        aria-selected={accessScope === option.id}
                        className={`flex min-h-12 items-center gap-3 px-4 py-2 text-sm outline-none ${activeAccessScope === option.id ? 'bg-surface-muted' : ''} ${disabled ? 'cursor-not-allowed text-content-muted' : 'cursor-pointer'}`}
                        id={`site-access-option-${option.id}`}
                        key={option.id}
                        onClick={() => {
                          chooseAccessScope(option.id);
                        }}
                        role="option"
                      >
                        <AppSymbol className="!size-5 text-[20px]">
                          {option.icon}
                        </AppSymbol>
                        <span className="min-w-0 flex-1 break-words">
                          {label}
                        </span>
                        {disabled ? (
                          <span className="text-xs" aria-hidden="true">
                            Upgrade required
                          </span>
                        ) : accessScope === option.id ? (
                          <AppSymbol className="!size-5 text-[20px]">
                            check
                          </AppSymbol>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
            <p className="text-xs text-content-muted" id="site-access-help">
              {accessScopeHelp[accessScope]}
            </p>
            {accessError ? (
              <p className="text-sm text-danger" role="alert">
                {accessError}
              </p>
            ) : null}
          </section>
          {accessScope === 'ORGANIZATION' ? (
            <fieldset className="grid gap-3">
              <legend className="mb-1 text-sm font-semibold">
                What they can do
              </legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-control-border p-4 has-[:checked]:border-action-primary">
                <input
                  className="mt-0.5 size-4 accent-action-primary"
                  type="radio"
                  value="VIEW_COMMENT"
                  {...register('organizationAccess')}
                />
                <span>
                  <span className="block text-sm font-medium">
                    View and comment
                  </span>
                  <span className="block text-xs leading-5 text-content-muted">
                    People in your organization can view and comment on this
                    site.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-control-border p-4 has-[:checked]:border-action-primary">
                <input
                  className="mt-0.5 size-4 accent-action-primary"
                  type="radio"
                  value="EDIT_MANAGE"
                  {...register('organizationAccess')}
                />
                <span>
                  <span className="block text-sm font-medium">
                    Edit sites, invite people, and change their permissions
                  </span>
                  <span className="block text-xs leading-5 text-content-muted">
                    People in your organization can manage this site.
                  </span>
                </span>
              </label>
            </fieldset>
          ) : null}
          {submissionError ? (
            <p
              className="text-sm text-danger"
              id="site-create-error"
              role="alert"
            >
              {submissionError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 px-6 py-6">
          <section
            aria-labelledby="invite-members-heading"
            className="grid gap-3"
          >
            <h3 className="text-base font-semibold" id="invite-members-heading">
              Invite team members
            </h3>
            <form
              className="grid grid-cols-[minmax(0,1fr)_150px_auto] items-end gap-2 max-sm:grid-cols-1"
              onSubmit={(event) => void addAssignment(event)}
            >
              <TextField
                error={invitation.formState.errors.email?.message}
                label="Email or team member"
                placeholder="name@example.com"
                type="email"
                {...invitation.register('email')}
              />
              <SelectField
                label="Role"
                options={roleOptions}
                placeholder="Select role"
                {...invitation.register('role')}
              />
              <Button type="submit" variant="secondary">
                Add
              </Button>
            </form>
            {!canInviteMembers ? (
              <p className="text-sm text-content-muted" role="status">
                Existing team members can be added. Upgrade to invite external
                people.
              </p>
            ) : null}
          </section>
          <section
            aria-labelledby="who-has-access-heading"
            className="grid gap-3"
          >
            <h3 className="text-sm font-semibold" id="who-has-access-heading">
              Who has access
            </h3>
            <div className="divide-y divide-control-border rounded-md border border-control-border">
              <div className="flex items-center justify-between gap-4 p-4">
                <MemberIdentity
                  displayName={creator.displayName}
                  email={creator.email}
                  initials={creator.initials}
                  status="Internal"
                />
                <span className="text-sm font-medium">Administrator</span>
              </div>
              {assignments.map((assignment) => {
                const member = memberByEmail.get(assignment.email);
                const external = !member;
                return (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_150px_auto] items-center gap-3 p-4 max-sm:grid-cols-[minmax(0,1fr)_auto]"
                    key={assignment.email}
                  >
                    <MemberIdentity
                      displayName={member?.displayName ?? assignment.email}
                      initials={
                        member?.initials ??
                        assignment.email.slice(0, 1).toUpperCase()
                      }
                      status={external ? 'External' : 'Internal'}
                      {...(member ? { email: member.email } : {})}
                    />
                    <select
                      aria-label={`Role for ${assignment.email}`}
                      className="min-h-10 rounded-control border border-control-border bg-surface px-3 text-sm max-sm:col-start-1"
                      onChange={(event) => {
                        const role = event.target.value as SiteRole;
                        setAssignments((current) =>
                          current.map((item) =>
                            item.email === assignment.email
                              ? { ...item, role }
                              : item,
                          ),
                        );
                      }}
                      value={assignment.role}
                    >
                      {roleOptions.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label={`Remove ${assignment.email}`}
                      className="grid size-9 place-items-center rounded-control hover:bg-surface-muted"
                      onClick={() => {
                        setAssignments((current) =>
                          current.filter(
                            ({ email }) => email !== assignment.email,
                          ),
                        );
                      }}
                      type="button"
                    >
                      <AppSymbol className="!size-5 text-[20px]">
                        close
                      </AppSymbol>
                    </button>
                    {external && assignment.role !== 'VIEWER' ? (
                      <p
                        className="col-span-full text-sm text-danger"
                        role="alert"
                      >
                        This user needs a paid seat to be{' '}
                        {assignment.role === 'ADMINISTRATOR'
                          ? 'an administrator'
                          : 'an editor'}
                        .{' '}
                        <a className="underline" href="/help/paid-seats">
                          Learn more
                        </a>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
          {submissionError ? (
            <p
              className="text-sm text-danger"
              id="site-create-error"
              role="alert"
            >
              {submissionError}
            </p>
          ) : null}
        </div>
      )}

      <footer className="flex items-center justify-between gap-4 border-t border-control-border px-6 py-4">
        <p className="text-sm text-content-muted">
          Step {step} of {accessScope === 'PEOPLE_INVITED' ? 2 : 1}
        </p>
        <div className="flex gap-2">
          {step === 1 ? (
            <>
              <Button onClick={requestClose} variant="secondary">
                Cancel
              </Button>
              {accessScope === 'PEOPLE_INVITED' ? (
                <Button
                  onClick={() => {
                    void trigger('name').then((valid) => {
                      if (valid) setStep(2);
                    });
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  disabled={isCreating}
                  onClick={() => {
                    const fields: (keyof StepOneValues)[] =
                      accessScope === 'ORGANIZATION'
                        ? ['name', 'organizationAccess']
                        : ['name'];
                    void trigger(fields).then((valid) => {
                      if (valid) void submit();
                    });
                  }}
                >
                  {isCreating ? 'Creating…' : 'Add new site'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  setStep(1);
                }}
                variant="secondary"
              >
                Back
              </Button>
              <Button
                aria-describedby={
                  submissionError ? 'site-create-error' : undefined
                }
                disabled={hasPaidSeatWarning || isCreating}
                onClick={() => {
                  if (assignments.length === 0) {
                    setSubmissionError('Invite at least one person.');
                    return;
                  }
                  void submit();
                }}
              >
                {isCreating ? 'Creating…' : 'Create site'}
              </Button>
            </>
          )}
        </div>
      </footer>
    </Modal>
  );
}
