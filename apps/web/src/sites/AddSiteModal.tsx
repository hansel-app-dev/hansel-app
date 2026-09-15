/** @spec sites-access-scope REQ-001..REQ-015, REQ-022..REQ-025 @figma 2029:1630, 2097:6260, 2130:1285, 2151:1744 */
import { yupResolver } from '@hookform/resolvers/yup';
import { useRef, useState, type ReactNode } from 'react';
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
import { SiteCoverImageStep } from './SiteCoverImageStep.js';

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
  warning,
}: {
  displayName: string;
  email?: string;
  initials: string;
  status: 'Internal' | 'External';
  warning?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${status === 'Internal' ? 'bg-[#4096ff] text-[#10233e]' : 'bg-[#a54bff] text-[#191124]'}`}
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span
          className={`flex flex-wrap items-baseline gap-x-[6px] text-[13px] leading-4 font-semibold ${warning ? 'pr-[86px]' : ''}`}
        >
          <span className="break-all">{displayName}</span>
          <span
            className={
              status === 'Internal' ? 'text-[#1769bd]' : 'text-[#8131c5]'
            }
          >
            {status}
          </span>
        </span>
        {email ? (
          <span className="block break-all text-[11px] leading-4 text-content-muted">
            {email}
          </span>
        ) : null}
        {warning}
      </span>
    </div>
  );
}

export interface AddSiteModalProps {
  canInviteMembers: boolean;
  coverImageEnabled?: boolean;
  createSite: (input: CreateSiteRequest) => Promise<CreateSiteResponse>;
  creator: SiteMemberChoice;
  members: SiteMemberChoice[];
  onClose: () => void;
  onCreated: (destination: string) => void;
  organizationName: string;
  uploadCoverImage?: (siteId: string, file: File) => Promise<void>;
}

export function AddSiteModal({
  canInviteMembers,
  coverImageEnabled = false,
  createSite,
  creator,
  members,
  onClose,
  onCreated,
  organizationName,
  uploadCoverImage,
}: AddSiteModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [createdSite, setCreatedSite] = useState<CreateSiteResponse | null>(
    null,
  );
  const [accessScope, setAccessScope] =
    useState<SiteAccessScope>('ORGANIZATION');
  const [accessOpen, setAccessOpen] = useState(false);
  const [activeAccessScope, setActiveAccessScope] =
    useState<SiteAccessScope>('ORGANIZATION');
  const [accessError, setAccessError] = useState('');
  const [assignments, setAssignments] = useState<SiteAssignment[]>([]);
  const [submissionError, setSubmissionError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const creating = useRef(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const {
    formState: { errors: stepErrors, isDirty: stepOneDirty },
    getValues,
    register,
    trigger,
  } = useForm<StepOneValues>({
    defaultValues: {
      name: '',
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
    if (coverUploading) return;
    if (step === 3 && createdSite) {
      onCreated(createdSite.destination);
      return;
    }
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
      if (coverImageEnabled) {
        setCreatedSite(result);
        setStep(3);
      } else {
        onCreated(result.destination);
      }
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
    <div className="[&_[role=dialog]]:rounded-[6px] [&_[role=dialog]]:tracking-[0.2px]">
      <Modal
        backdrop="blurred"
        onClose={requestClose}
        title={step === 2 ? 'Invite team members' : 'Add new site'}
        size="compact"
      >
        <header
          className={`flex items-center justify-between border-b border-control-border px-6 ${step !== 1 ? 'h-[50px]' : 'h-[52px]'}`}
        >
          <h2 className={'text-[17px] font-semibold'}>
            {step === 3
              ? 'Add a cover image'
              : step === 2
                ? 'Invite team members'
                : 'Add new Site'}
          </h2>
          <button
            aria-label="Close"
            disabled={coverUploading}
            className="grid size-6 place-items-center rounded-control text-content-muted hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
            onClick={requestClose}
            type="button"
          >
            <AppSymbol className="!size-5 text-[20px]">close</AppSymbol>
          </button>
        </header>

        {step === 1 ? (
          <div className="grid gap-6 px-6 pb-8 pt-6">
            <div className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-2 [&>div>label]:sr-only [&>div]:gap-0">
              <span className="grid size-10 place-items-center rounded bg-[#f4f4f5]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="size-5 rounded-[2px] bg-[#4096ff] p-[2px] text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 21V10l7-4 7 4v11h-5v-6H8v6H3Z" />
                  <path d="M13 7V3h8v18h-4M17 6h1M17 10h1M20 14h1M20 18h1M6 11h1M12 11h1" />
                </svg>
              </span>
              <TextField
                className="h-10 min-w-0 px-[15px] py-0 font-normal shadow-none"
                error={stepErrors.name?.message}
                label="Name"
                placeholder="New site"
                maxLength={100}
                {...register('name')}
              />
            </div>
            <section
              aria-labelledby="site-access-heading"
              className="grid gap-2"
            >
              <h3 className="text-sm font-normal" id="site-access-heading">
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
                  className="flex h-10 w-full items-center gap-2 rounded-control border border-control-border bg-surface px-4 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
                  <span className="grid size-5 shrink-0 place-items-center text-content-muted">
                    <AppSymbol className="!size-5 text-[20px]">
                      {selectedAccess.icon}
                    </AppSymbol>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-normal">
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
              <p
                className="flex items-center gap-1 text-xs leading-5 text-content-muted"
                id="site-access-help"
              >
                <AppSymbol className="!size-[14px] shrink-0 !text-[14px]">
                  info
                </AppSymbol>
                {accessScopeHelp[accessScope]}
              </p>
              {accessError ? (
                <p className="text-sm text-danger" role="alert">
                  {accessError}
                </p>
              ) : null}
            </section>
            {accessScope === 'ORGANIZATION' ? (
              <fieldset className="grid gap-5">
                <legend className="mb-3 text-sm font-normal">
                  What they can do
                </legend>
                <label className="flex cursor-pointer items-start gap-[7px]">
                  <input
                    className="mt-0.5 size-4 accent-action-primary"
                    type="radio"
                    value="VIEW_COMMENT"
                    {...register('organizationAccess')}
                  />
                  <span>
                    <span className="block text-sm font-normal">
                      View and comment
                    </span>
                    <span className="sr-only">
                      People in your organization can view and comment on this
                      site.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-[7px]">
                  <input
                    className="mt-0.5 size-4 accent-action-primary"
                    type="radio"
                    value="EDIT_MANAGE"
                    {...register('organizationAccess')}
                  />
                  <span>
                    <span className="block text-sm font-normal">
                      Edit sites, invite people, and change their permissions
                    </span>
                    <span className="sr-only">
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
        ) : step === 2 ? (
          <div>
            <section
              aria-labelledby="invite-members-heading"
              className="grid gap-3 border-b border-control-border px-6 pb-[15px] pt-6"
            >
              <h3
                className="text-sm font-normal leading-5"
                id="invite-members-heading"
              >
                Invite people to access the site and collaborate
              </h3>
              <form
                className="grid grid-cols-[minmax(0,1fr)_110px_60px] items-start gap-2 max-[480px]:grid-cols-1 [&>div>label]:sr-only [&>div]:gap-0 [&_input]:min-w-0 [&_input]:h-10 [&_select]:h-10 [&_input]:shadow-none [&_select]:shadow-none"
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
                  options={roleOptions.map((role) => ({
                    ...role,
                    label: role.id === 'ADMINISTRATOR' ? 'Admin' : role.label,
                  }))}
                  placeholder="Select role"
                  {...invitation.register('role')}
                />
                <Button type="submit" className="px-0 font-normal shadow-none">
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
              className="grid gap-2 px-6 pb-6 pt-6"
            >
              <h3
                className="text-sm font-normal leading-5"
                id="who-has-access-heading"
              >
                Who has access
              </h3>
              <div className="grid gap-2">
                <div className="flex min-h-14 items-center justify-between gap-3 rounded-[6px] border border-[#4096ff] bg-[#f4f8ff] px-[11px] py-[10px]">
                  <MemberIdentity
                    displayName={creator.displayName}
                    email={creator.email}
                    initials={creator.initials}
                    status="Internal"
                  />
                  <span
                    aria-label="Administrator"
                    className="mr-8 rounded bg-[#e2e8f0] px-2 text-[11px] leading-5"
                  >
                    Admin
                  </span>
                </div>
                {assignments.map((assignment) => {
                  const member = memberByEmail.get(assignment.email);
                  const external = !member;
                  const warning = external && assignment.role !== 'VIEWER';
                  return (
                    <div
                      className={`relative grid min-h-14 grid-cols-[minmax(0,1fr)_54px_24px] items-center gap-x-2 rounded-[6px] border px-[11px] py-[10px] ${warning ? 'border-[#ffcb94] bg-[#fff8ef]' : external ? 'border-[#a54bff] bg-[#faf5ff]' : 'border-[#4096ff] bg-[#f4f8ff]'}`}
                      key={assignment.email}
                    >
                      <div className={warning ? 'col-span-full' : undefined}>
                        <MemberIdentity
                          displayName={member?.displayName ?? assignment.email}
                          initials={
                            member?.initials ??
                            assignment.email.slice(0, 1).toUpperCase()
                          }
                          status={external ? 'External' : 'Internal'}
                          {...(member ? { email: member.email } : {})}
                          warning={
                            warning ? (
                              <span
                                className="block text-[11px] leading-4 text-[#c42020]"
                                role="alert"
                              >
                                This user needs a paid seat to be{' '}
                                {assignment.role === 'ADMINISTRATOR'
                                  ? 'an administrator'
                                  : 'an editor'}
                                .{' '}
                                <a
                                  className="underline"
                                  href="/help/paid-seats"
                                >
                                  Learn more
                                </a>
                              </span>
                            ) : undefined
                          }
                        />
                      </div>
                      <select
                        aria-label={`Role for ${assignment.email}`}
                        className={`h-5 w-[54px] appearance-none rounded border-0 px-1 text-center text-[11px] outline-offset-2 ${warning ? 'absolute right-[43px] top-[10px] bg-[#ffe4e4] text-[#bd1717]' : 'bg-[#e2e8f0]'}`}
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
                          <option
                            aria-label={role.label}
                            key={role.id}
                            value={role.id}
                          >
                            {role.id === 'ADMINISTRATOR' ? 'Admin' : role.label}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label={`Remove ${assignment.email}`}
                        className={`grid size-6 place-items-center rounded-full text-content-muted hover:bg-surface-muted ${warning ? 'absolute right-[11px] top-2' : ''}`}
                        onClick={() => {
                          setAssignments((current) =>
                            current.filter(
                              ({ email }) => email !== assignment.email,
                            ),
                          );
                        }}
                        type="button"
                      >
                        <svg
                          aria-hidden="true"
                          className="size-5"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <circle cx="10" cy="10" r="8.5" />
                          <path d="m6.5 6.5 7 7m0-7-7 7" />
                        </svg>
                      </button>
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
        ) : createdSite ? (
          <SiteCoverImageStep
            totalSteps={accessScope === 'PEOPLE_INVITED' ? 3 : 2}
            onUploadingChange={setCoverUploading}
            destination={createdSite.destination}
            onComplete={onCreated}
            siteId={createdSite.siteId}
            {...(uploadCoverImage ? { uploadCoverImage } : {})}
          />
        ) : null}

        {step !== 3 ? (
          <footer className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 bg-[#f8f9fb] px-6 py-4">
            <p className="text-sm text-content-muted">
              Step {step} of{' '}
              {(accessScope === 'PEOPLE_INVITED' ? 2 : 1) +
                (coverImageEnabled ? 1 : 0)}
            </p>
            <div className="flex gap-4 [&>button]:font-normal [&>button]:shadow-none">
              {step === 1 ? (
                <>
                  <Button
                    className="w-20 bg-transparent"
                    onClick={requestClose}
                    variant="secondary"
                  >
                    Cancel
                  </Button>
                  {accessScope === 'PEOPLE_INVITED' ? (
                    <Button
                      className="min-w-[65px]"
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
                      className="min-w-[65px]"
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
                      {isCreating
                        ? 'Creating…'
                        : coverImageEnabled
                          ? 'Next'
                          : 'Add new site'}
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
        ) : null}
      </Modal>
    </div>
  );
}
