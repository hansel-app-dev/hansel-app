import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SignMountingSelect } from './SignMountingSelect.js';
afterEach(cleanup);
it('sign-mounting-options REQ-001,002,005 renders illustrated options and selects with keyboard', () => {
  const change = vi.fn();
  render(<SignMountingSelect value="Wall-mounted" onChange={change} />);
  const trigger = screen.getByRole('combobox', { name: 'Type' });
  fireEvent.click(trigger);
  expect(
    screen.getAllByRole('option').map((option) => option.textContent),
  ).toEqual(['Freestanding', 'Wall-mounted', 'Overhead', 'Cantilevered']);
  for (const option of screen.getAllByRole('option'))
    expect(option.querySelector('img')).toHaveAttribute('width', '24');
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(change).toHaveBeenCalledWith('Overhead');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('sign-mounting-options REQ-005 is read-only when disabled', () => {
  render(
    <SignMountingSelect value="Cantilevered" disabled onChange={vi.fn()} />,
  );
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByText('Cantilevered')).toBeInTheDocument();
});
