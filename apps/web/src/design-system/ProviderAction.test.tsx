import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProviderAction } from './index.js';

afterEach(cleanup);

describe('ProviderAction [design-system-foundation REQ-014]', () => {
  it('renders a native provider button with the committed mark', () => {
    render(<ProviderAction provider="google" />);

    const action = screen.getByRole('button', {
      name: 'Continue with Google',
    });
    expect(action).toHaveAttribute('type', 'button');
    expect(action.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/google-logo.svg',
    );
  });

  it('preserves navigation-link semantics with the same provider content', () => {
    render(
      <ProviderAction href="/auth/start/apple?intent=login" provider="apple" />,
    );

    const action = screen.getByRole('link', { name: 'Continue with Apple' });
    expect(action).toHaveAttribute('href', '/auth/start/apple?intent=login');
    expect(action.querySelector('img')).toHaveAttribute(
      'src',
      '/assets/apple-logo.svg',
    );
  });
});
