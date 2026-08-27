import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SelectField } from './SelectField.js';
afterEach(cleanup);

describe('SelectField [REQ-086]', () => {
  it('associates its label, placeholder, and options', () => {
    render(
      <SelectField
        label="Job title"
        options={[{ id: 'manager', label: 'Manager' }]}
      />,
    );
    expect(screen.getByLabelText('Job title')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Select' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Manager' })).toHaveValue(
      'manager',
    );
  });
  it('exposes errors and disabled state', () => {
    render(
      <SelectField
        disabled
        error="Choose a department."
        id="department"
        label="Department"
        options={[]}
        placeholder="Choose"
      />,
    );
    const field = screen.getByLabelText('Department');
    expect(field).toBeDisabled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Choose a department.');
  });
});
