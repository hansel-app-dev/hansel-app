import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthFormLayout, ProviderAction } from './index.js';

afterEach(cleanup);

describe('AuthFormLayout [design-system-foundation REQ-014]', () => {
  it('composes the shared labelled authentication regions', () => {
    render(
      <AuthFormLayout
        footer={<p>Supporting copy</p>}
        heading="Authentication form"
        providerActions={<ProviderAction provider="google" />}
        providerLabel="or continue with"
      >
        <form>
          <label htmlFor="email">Email</label>
          <input id="email" />
          <button type="submit">Continue</button>
        </form>
      </AuthFormLayout>,
    );

    const region = screen.getByRole('region', {
      name: 'Authentication form',
    });
    expect(within(region).getByLabelText('Email')).toBeVisible();
    expect(
      within(region).getByRole('button', { name: 'Continue with Google' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Hansel home' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByText('Supporting copy')).toBeVisible();
  });
});
