import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddSiteModal } from './AddSiteModal.js';
import { SiteCreateError } from '../api.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseProps = {
  canInviteMembers: true,
  creator: {
    email: 'owner@example.com',
    displayName: 'Nabin Singh',
    initials: 'NS',
  },
  createSite: () =>
    Promise.resolve({
      siteId: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
      destination: '/sites/ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9/activity',
    }),
  members: [
    { email: 'editor@example.com', displayName: 'Ed Itor', initials: 'EI' },
  ],
  onClose: vi.fn(),
  onCreated: vi.fn(),
  organizationName: 'Hansel',
};

function selectAccess(name: 'People you invite' | 'Private') {
  fireEvent.click(screen.getByRole('combobox', { name: 'Who has access' }));
  fireEvent.click(screen.getByRole('option', { name }));
}

describe('AddSiteModal [sites-add-new REQ-001..REQ-010, REQ-017, REQ-018]', () => {
  it('selects and creates a Private site from the Figma access dropdown [sites-access-scope REQ-001..REQ-005, REQ-010, REQ-013, REQ-015]', async () => {
    const createSite = vi.fn(baseProps.createSite);
    render(<AddSiteModal {...baseProps} createSite={createSite} />);

    const access = screen.getByRole('combobox', { name: 'Who has access' });
    expect(access).toHaveTextContent('Hansel');
    expect(screen.getByText('Only people in your organization')).toBeVisible();
    fireEvent.click(access);
    expect(screen.getByRole('option', { name: 'Hansel' })).toBeVisible();
    expect(
      screen.getByRole('option', { name: 'People you invite' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('option', { name: 'Private' }));

    expect(screen.getByText('Only you and organization owners')).toBeVisible();
    expect(screen.queryByText('What they can do')).not.toBeInTheDocument();
    expect(screen.getByText('Step 1 of 1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add new site' }));
    await waitFor(() => {
      expect(createSite).toHaveBeenCalledOnce();
    });
    expect(createSite).toHaveBeenCalledWith({
      name: 'New site',
      accessScope: 'PRIVATE',
      idempotencyKey: expect.any(String),
    });
  });

  it('creates an Organization site with only its selected default capability [sites-access-scope REQ-005, REQ-006, REQ-015]', async () => {
    const createSite = vi.fn(baseProps.createSite);
    render(<AddSiteModal {...baseProps} createSite={createSite} />);
    fireEvent.click(
      screen.getByRole('radio', {
        name: /Edit sites, invite people, and change their permissions/,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add new site' }));
    await waitFor(() => {
      expect(createSite).toHaveBeenCalledWith({
        name: 'New site',
        accessScope: 'ORGANIZATION',
        organizationAccess: 'EDIT_MANAGE',
        idempotencyKey: expect.any(String),
      });
    });
  });

  it('supports the specified access-dropdown keyboard model [sites-access-scope REQ-022]', () => {
    const onClose = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AddSiteModal {...baseProps} onClose={onClose} />);
    const access = screen.getByRole('combobox', { name: 'Who has access' });
    access.focus();
    fireEvent.keyDown(access, { key: 'Enter' });
    expect(access).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(access, { key: 'End' });
    expect(access).toHaveAttribute(
      'aria-activedescendant',
      'site-access-option-PRIVATE',
    );
    fireEvent.keyDown(access, { key: 'Enter' });
    expect(access).toHaveTextContent('Private');
    expect(access).toHaveAttribute('aria-expanded', 'false');
    expect(access).toHaveFocus();
    fireEvent.keyDown(access, { key: 'ArrowDown' });
    expect(access).toHaveAttribute(
      'aria-activedescendant',
      'site-access-option-ORGANIZATION',
    );
    fireEvent.keyDown(access, { key: 'ArrowUp' });
    expect(access).toHaveAttribute(
      'aria-activedescendant',
      'site-access-option-PRIVATE',
    );
    fireEvent.keyDown(access, { key: 'Home' });
    expect(access).toHaveAttribute(
      'aria-activedescendant',
      'site-access-option-ORGANIZATION',
    );
    fireEvent.keyDown(access, { key: 'Escape' });
    expect(access).toHaveAttribute('aria-expanded', 'false');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(access, { key: ' ' });
    expect(access).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(access, { key: ' ' });
    expect(access).toHaveTextContent('Hansel');
    expect(access).toHaveAttribute('aria-expanded', 'false');
  });

  it('preserves step-one values and submits internal and external Viewer access once', async () => {
    const createSite = vi.fn(baseProps.createSite);
    const onCreated = vi.fn();
    render(
      <AddSiteModal
        {...baseProps}
        createSite={createSite}
        onCreated={onCreated}
      />,
    );
    expect(screen.getByDisplayValue('New site')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Sydney Central' },
    });
    selectAccess('People you invite');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Invite team members')).toBeVisible();
    expect(screen.getByText('Nabin Singh')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Email or team member'), {
      target: { value: 'guest@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'VIEWER' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('guest@example.com')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByDisplayValue('Sydney Central')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create site' }));
    await waitFor(() => {
      expect(createSite).toHaveBeenCalledOnce();
    });
    expect(createSite).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sydney Central',
        accessScope: 'PEOPLE_INVITED',
        assignments: [{ email: 'guest@example.com', role: 'VIEWER' }],
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        '/sites/ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9/activity',
      );
    });
  });

  it('stages but blocks an external paid-seat role until changed or removed', async () => {
    render(<AddSiteModal {...baseProps} />);
    selectAccess('People you invite');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Invite team members');
    fireEvent.change(screen.getByLabelText('Email or team member'), {
      target: { value: 'external@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'paid seat to be an administrator',
    );
    expect(screen.getByRole('button', { name: 'Create site' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Role for external@example.com'), {
      target: { value: 'EDITOR' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'paid seat to be an editor',
    );
    fireEvent.change(screen.getByLabelText('Role for external@example.com'), {
      target: { value: 'VIEWER' },
    });
    expect(screen.queryByText(/needs a paid seat/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create site' })).toBeEnabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove external@example.com' }),
    );
    expect(screen.queryByText('external@example.com')).not.toBeInTheDocument();
  });

  it('requires at least one direct assignment for People You Invite [sites-access-scope REQ-008, REQ-015, REQ-022]', async () => {
    const createSite = vi.fn(baseProps.createSite);
    render(<AddSiteModal {...baseProps} createSite={createSite} />);
    selectAccess('People you invite');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create site' }));
    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Invite at least one person.');
    expect(
      screen.getByRole('button', { name: 'Create site' }),
    ).toHaveAccessibleDescription('Invite at least one person.');
    expect(createSite).not.toHaveBeenCalled();
  });

  it('validates, protects staged work, and blocks People You Invite on Free [sites-access-scope REQ-011, REQ-014]', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AddSiteModal {...baseProps} canInviteMembers={false} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add new site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a site name',
    );
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Only site' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('combobox', { name: 'Who has access' }));
    const inviteOnly = screen.getByRole('option', {
      name: 'People you invite',
    });
    expect(inviteOnly).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(inviteOnly);
    expect(
      await screen.findByText(
        'Upgrade your plan to invite people to this site.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Next' }),
    ).not.toBeInTheDocument();
  });

  it('fails safely if invite permission is lost while the invite step is open [sites-access-scope REQ-009, REQ-014]', async () => {
    const { rerender } = render(<AddSiteModal {...baseProps} />);
    selectAccess('People you invite');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Invite team members');

    rerender(<AddSiteModal {...baseProps} canInviteMembers={false} />);
    expect(
      screen.getByText(
        'Existing team members can be added. Upgrade to invite external people.',
      ),
    ).toBeVisible();

    const email = screen.getByLabelText('Email or team member');
    const add = screen.getByRole('button', { name: 'Add' });
    fireEvent.change(email, { target: { value: 'not-an-email' } });
    const invitationForm = email.closest('form');
    if (!invitationForm) throw new Error('Expected the invitation form');
    fireEvent.submit(invitationForm);
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();

    fireEvent.change(email, { target: { value: 'owner@example.com' } });
    fireEvent.click(add);
    expect(await screen.findByText('You already have access.')).toBeVisible();

    fireEvent.change(email, { target: { value: 'outside@example.com' } });
    fireEvent.click(add);
    expect(
      await screen.findByText(
        'Upgrade your plan to invite external team members.',
      ),
    ).toBeVisible();

    fireEvent.change(email, { target: { value: 'editor@example.com' } });
    fireEvent.click(add);
    expect(
      await screen.findByRole('button', {
        name: 'Remove editor@example.com',
      }),
    ).toBeVisible();
  });

  it('submits at most once while pending and bounds an unexpected failure', async () => {
    let reject: ((reason: Error) => void) | undefined;
    const createSite = vi.fn(
      () =>
        new Promise<never>((_resolve, fail) => {
          reject = fail;
        }),
    );
    render(<AddSiteModal {...baseProps} createSite={createSite} />);
    const create = screen.getByRole('button', { name: 'Add new site' });
    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => {
      expect(createSite).toHaveBeenCalledOnce();
    });
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    reject?.(new Error('private'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "couldn't create the site",
    );
  });

  it('recognizes tenant members, replaces duplicates, and updates only the selected row', async () => {
    render(<AddSiteModal {...baseProps} />);
    selectAccess('People you invite');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Invite team members');
    const add = async (email: string, role: string) => {
      fireEvent.change(screen.getByLabelText('Email or team member'), {
        target: { value: email },
      });
      fireEvent.change(screen.getByLabelText('Role'), {
        target: { value: role },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      await screen.findByRole('button', { name: `Remove ${email}` });
    };
    await add('editor@example.com', 'ADMINISTRATOR');
    await add('external@example.com', 'VIEWER');
    await add('editor@example.com', 'EDITOR');
    expect(screen.getAllByText('Ed Itor')).toHaveLength(1);
    expect(screen.getByText('editor@example.com · Internal')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Role for editor@example.com'), {
      target: { value: 'VIEWER' },
    });
    expect(screen.getByLabelText('Role for external@example.com')).toHaveValue(
      'VIEWER',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove editor@example.com' }),
    );
    expect(screen.getByText('external@example.com')).toBeVisible();
  });

  it('retains staged invitees while omitting them from a Private request [sites-access-scope REQ-011, REQ-015]', async () => {
    const createSite = vi.fn(baseProps.createSite);
    render(<AddSiteModal {...baseProps} createSite={createSite} />);
    selectAccess('People you invite');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Invite team members');
    fireEvent.change(screen.getByLabelText('Email or team member'), {
      target: { value: 'editor@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByRole('button', { name: 'Remove editor@example.com' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    selectAccess('Private');
    fireEvent.click(screen.getByRole('button', { name: 'Add new site' }));
    await waitFor(() => {
      expect(createSite).toHaveBeenCalledWith({
        name: 'New site',
        accessScope: 'PRIVATE',
        idempotencyKey: expect.any(String),
      });
    });
    selectAccess('People you invite');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByRole('button', { name: 'Remove editor@example.com' }),
    ).toBeVisible();
  });

  it('allows confirmed dismissal of staged work', () => {
    const onClose = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AddSiteModal {...baseProps} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ['sites_forbidden', 'do not have permission'],
    ['sites_paid_seat_required', 'needs a paid seat'],
    ['sites_conflict', 'changed while it was being retried'],
  ] as const)('maps %s to a bounded retry message', async (code, message) => {
    render(
      <AddSiteModal
        {...baseProps}
        createSite={() => Promise.reject(new SiteCreateError(code))}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add new site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
