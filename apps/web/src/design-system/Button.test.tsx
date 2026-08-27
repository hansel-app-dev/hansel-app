import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './index.js';

afterEach(cleanup);

describe('Button [design-system-foundation REQ-004]', () => {
  it('defaults to a safe native button and retains native attributes', () => {
    const onClick = vi.fn();
    render(
      <Button aria-label="Create site" className="w-full" onClick={onClick}>
        Create
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Create site' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('w-full');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('supports secondary styling, explicit submit type, and disabled behavior', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} type="submit" variant="secondary">
        Continue
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('type', 'submit');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
