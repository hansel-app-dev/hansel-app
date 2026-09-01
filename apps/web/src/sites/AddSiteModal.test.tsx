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
  createSite: vi.fn().mockResolvedValue({
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

describe('AddSiteModal [sites-add-new REQ-001..REQ-010, REQ-017, REQ-018]', () => {
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
    fireEvent.click(
      screen.getByRole('radio', {
        name: /Edit sites, invite people, and change their permissions/,
      }),
    );
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
        organizationAccess: 'EDIT_MANAGE',
        assignments: [{ email: 'guest@example.com', role: 'VIEWER' }],
        idempotencyKey: expect.any(String),
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(
      '/sites/ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9/activity',
    );
  });

  it('stages but blocks an external paid-seat role until changed or removed', async () => {
    render(<AddSiteModal {...baseProps} />);
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

  it('validates, protects staged work, limits Free to existing members, and retains retry state', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const createSite = vi
      .fn()
      .mockRejectedValue(new SiteCreateError('sites_upgrade_required'));
    render(
      <AddSiteModal
        {...baseProps}
        canInviteMembers={false}
        createSite={createSite}
      />,
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a site name',
    );
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Only site' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(baseProps.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Invite team members');
    expect(screen.getByLabelText('Email or team member')).toBeEnabled();
    expect(
      screen.getByText(/Existing team members can be added/),
    ).toBeVisible();
    const invitationForm = screen
      .getByRole('button', { name: 'Add' })
      .closest('form');
    if (!invitationForm) throw new Error('Expected the invitation form');
    fireEvent.submit(invitationForm);
    expect(await screen.findByText('Enter an email address.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Email or team member'), {
      target: { value: 'editor@example.com' },
    });
    fireEvent.submit(invitationForm);
    expect(await screen.findByText('Ed Itor')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Email or team member'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.submit(invitationForm);
    expect(await screen.findByText('You already have access.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Email or team member'), {
      target: { value: 'blocked@example.com' },
    });
    fireEvent.submit(invitationForm);
    expect(
      await screen.findByText(/Upgrade your plan to invite external/),
    ).toBeVisible();
    expect(screen.queryByText('blocked@example.com')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create site' }));
    expect(await screen.findByText(/current plan/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByDisplayValue('Only site')).toBeVisible();
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const create = await screen.findByRole('button', { name: 'Create site' });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(createSite).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    reject?.(new Error('private'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "couldn't create the site",
    );
  });

  it('recognizes tenant members, replaces duplicates, and updates only the selected row', async () => {
    render(<AddSiteModal {...baseProps} />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create site' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
