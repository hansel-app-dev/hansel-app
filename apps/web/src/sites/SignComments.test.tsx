import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SignComments } from './SignComments.js';
afterEach(cleanup);
it('sign-comments REQ-001,003,006: empty composer expands and retains a failed draft', async () => {
  const api = {
    list: vi.fn().mockResolvedValue({
      comments: [],
      nextCursor: null,
      viewer: { id: 'viewer', name: 'John Smith', initials: 'JS' },
    }),
    submit: vi.fn().mockRejectedValue(new Error('offline')),
    people: vi.fn(),
    react: vi.fn(),
    initiate: vi.fn(),
    complete: vi.fn(),
    download: vi.fn(),
    thumbnail: vi.fn(),
    discard: vi.fn(),
  };
  render(<SignComments api={api} signId="sign" onStateChange={vi.fn()} />);
  expect(
    await screen.findByText('There are no comments yet.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  fireEvent.focus(screen.getByPlaceholderText('Write a comment...'));
  // REQ-003: all toolbar icons share the reference SVG size and rounded stroke.
  for (const name of ['Attach files', 'Mention a person', 'Insert emoji']) {
    const icon = screen.getByRole('button', { name }).querySelector('svg');
    expect(icon).toHaveAttribute('width', '20');
    expect(icon).toHaveAttribute('height', '20');
    expect(icon).toHaveAttribute('stroke-linecap', 'round');
    expect(icon).toHaveAttribute('stroke-linejoin', 'round');
  }
  expect(
    screen.getByRole('button', { name: 'Attach files' }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Write a comment...'), {
    target: { value: 'Please move this sign.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t submit');
  expect(screen.getByPlaceholderText('Write a comment...')).toHaveValue(
    'Please move this sign.',
  );
});
