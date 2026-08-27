import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerificationCodeField } from './VerificationCodeField.js';

afterEach(cleanup);

describe('VerificationCodeField [REQ-084]', () => {
  it('exposes one autofill-ready logical input and six visual cells', () => {
    const { container } = render(
      <VerificationCodeField
        label="Verification code"
        value="12"
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText('Verification code');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6);
  });

  it('normalizes typed, pasted, or autofilled content to six digits', () => {
    const onChange = vi.fn();
    render(
      <VerificationCodeField
        label="Verification code"
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '1a23-4567' },
    });
    expect(onChange).toHaveBeenCalledWith('123456');
  });

  it('associates an accessible error with the logical input', () => {
    render(
      <VerificationCodeField
        aria-describedby="verification-help"
        error="Enter all six digits"
        id="verification-code"
        label="Verification code"
        value="123"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Verification code')).toHaveAttribute(
      'aria-describedby',
      'verification-help verification-code-error',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter all six digits');
  });
});
