import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal.js';

afterEach(cleanup);

describe('Modal [sites-add-new REQ-017, REQ-020, REQ-021]', () => {
  it('labels and traps the dialog, closes with Escape/backdrop, and restores focus', () => {
    const close = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Invoker</button>
      </>,
    );
    screen.getByRole('button', { name: 'Invoker' }).focus();
    rerender(
      <>
        <button type="button">Invoker</button>
        <Modal onClose={close} title="Add new site">
          <button type="button">First</button>
          <button type="button">Last</button>
        </Modal>
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'Add new site' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    screen.getByRole('button', { name: 'Last' }).focus();
    screen.getByRole('button', { name: 'Last' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(close).toHaveBeenCalledOnce();
    const backdrop = screen.getByRole('dialog').parentElement;
    if (!backdrop) throw new Error('Expected a modal backdrop');
    fireEvent.mouseDown(backdrop);
    expect(close).toHaveBeenCalledTimes(2);
    rerender(<button type="button">Invoker</button>);
    expect(screen.getByRole('button', { name: 'Invoker' })).toHaveFocus();
  });

  it('keeps focus in a dialog that has no interactive controls', () => {
    render(
      <Modal onClose={() => undefined} title="Notice">
        <p>Nothing to choose</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Notice' });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog).toHaveFocus();
  });

  it('preserves active focus while using the latest close handler', () => {
    const firstClose = vi.fn();
    const latestClose = vi.fn();
    const { rerender } = render(
      <Modal onClose={firstClose} title="Stable">
        <input aria-label="Name" />
      </Modal>,
    );
    const name = screen.getByLabelText('Name');
    name.focus();
    rerender(
      <Modal onClose={latestClose} title="Stable">
        <input aria-label="Name" />
      </Modal>,
    );
    expect(screen.getByLabelText('Name')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(firstClose).not.toHaveBeenCalled();
    expect(latestClose).toHaveBeenCalledOnce();
  });
});
