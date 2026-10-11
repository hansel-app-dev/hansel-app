import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InviteMembersModal } from './InviteMembersModal.js';

afterEach(cleanup);

it('renders the empty Figma state with disabled send action', () => {
  render(<InviteMembersModal onClose={vi.fn()} />);

  expect(screen.getByRole('dialog', { name: 'Invite members' })).toBeVisible();
  expect(screen.getByText('People you invite will appear here.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Send invites' })).toBeDisabled();
});

it('stages a role-specific invite and allows it to be removed', () => {
  render(<InviteMembersModal onClose={vi.fn()} onSubmit={vi.fn()} />);

  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
    target: { value: 'person@example.com' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Invite role' }), {
    target: { value: 'Editor' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(screen.getByText('person@example.com')).toBeVisible();
  expect(screen.getAllByText('Editor')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Send 1 invite' })).toBeEnabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove person@example.com' }),
  );
  expect(screen.getByText('People you invite will appear here.')).toBeVisible();
});
