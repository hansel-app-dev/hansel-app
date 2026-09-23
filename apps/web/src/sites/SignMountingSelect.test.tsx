/** @spec sign-additional-type-options REQ-001..REQ-006 */
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
  ).toEqual([
    'Freestanding',
    'Wall-mounted',
    'Overhead',
    'Cantilevered',
    'Floor',
    'Safety Decal',
    'Privacy Decal',
    'Environmental',
  ]);
  for (const option of screen.getAllByRole('option'))
    expect(option.querySelector('img')).toHaveAttribute('width', '24');
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(change).toHaveBeenCalledWith('Overhead');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('allocation-plan-add-sign-tool REQ-006,007 sign-additional-type-options REQ-006 wraps across all eight options', () => {
  const change = vi.fn();
  render(<SignMountingSelect value="Environmental" onChange={change} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Home' });
  fireEvent.keyDown(trigger, { key: 'ArrowUp' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'End' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(change).toHaveBeenCalledWith('Freestanding');
});
it('sign-mounting-options REQ-005 is read-only when disabled', () => {
  render(
    <SignMountingSelect value="Cantilevered" disabled onChange={vi.fn()} />,
  );
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByText('Cantilevered')).toBeInTheDocument();
});

it.each([
  ['Safety Decal', 'safety-decal'],
  ['Privacy Decal', 'privacy-decal'],
  ['Environmental', 'environmental'],
])(
  'REQ-001,002,003: selects %s with its supplied icon once',
  (label, asset) => {
    const change = vi.fn();
    render(<SignMountingSelect value="Wall-mounted" onChange={change} />);
    fireEvent.click(screen.getByRole('combobox'));
    const option = screen.getByRole('option', { name: label });
    expect(option.querySelector('img')).toHaveAttribute(
      'src',
      `/assets/sign-${asset}.png`,
    );
    fireEvent.click(option);
    expect(change).toHaveBeenCalledExactlyOnceWith(label);
  },
);
