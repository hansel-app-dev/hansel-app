import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SiteShareControls } from './SiteShareControls.js';

afterEach(cleanup);
const members = [
  { membershipId: 'one', displayName: 'John Smith', initials: 'JS' },
];

it('site-share-hover-design AC-002: preserves truthful members and unavailable actions', () => {
  render(<SiteShareControls memberPreview={members} memberCount={4} />);
  const group = screen.getByRole('group', { name: /John Smith; 3 more/ });
  expect(group).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByText('+3')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Share site' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Share options' })).toBeDisabled();
  fireEvent.click(group);
  fireEvent.keyDown(group, { key: 'Enter' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('site-share-hover-design AC-002: zero members creates no fake avatar', () => {
  render(<SiteShareControls memberPreview={[]} memberCount={0} />);
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Share site' })).toBeDisabled();
});
