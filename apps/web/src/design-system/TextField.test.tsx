import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TextField } from './index.js';

afterEach(cleanup);

describe('TextField [design-system-foundation REQ-005]', () => {
  it('associates its visible label and description without caller IDs', () => {
    render(
      <TextField
        description="We will only use this for account access."
        label="Email"
        name="email"
        type="email"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAccessibleDescription(
      'We will only use this for account access.',
    );
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('communicates error and disabled states while retaining native attributes', () => {
    render(
      <>
        <p id="account-context">Account field</p>
        <TextField
          aria-describedby="account-context account-email-description account-email-error"
          aria-invalid={false}
          className="max-w-sm"
          description="Use your work address."
          disabled
          error="Enter a valid email address."
          id="account-email"
          label="Work email"
          placeholder="name@example.com"
        />
      </>,
    );

    const input = screen.getByRole('textbox', { name: 'Work email' });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute(
      'aria-describedby',
      'account-context account-email-description account-email-error',
    );
    expect(input).toHaveAttribute('placeholder', 'name@example.com');
    expect(input).toHaveClass('max-w-sm');
    expect(input).toHaveAccessibleDescription(
      'Account field Use your work address. Enter a valid email address.',
    );
  });

  it('renders a minimal field without an accessible description', () => {
    render(<TextField aria-invalid="grammar" label="Organization" />);

    const input = screen.getByRole('textbox', { name: 'Organization' });
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).toHaveAttribute('aria-invalid', 'grammar');
  });
});
