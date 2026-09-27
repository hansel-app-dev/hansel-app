import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SignDeleteDialog } from './SignDeleteDialog.js';
import { PhotoDeleteDialog } from './PhotoDeleteDialog.js';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  const previous = document.createElement('button');
  document.body.append(previous);
  previous.focus();
  return previous;
}
it('plan-sign-delete-dialog REQ-002..006: measures the drawing region, handles cancel/reload and restores focus', () => {
  const previous = setup(),
    host = document.createElement('div'),
    parent = document.createElement('div');
  parent.append(host);
  document.body.append(parent);
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 50,
    right: 1000,
    bottom: 600,
    width: 900,
    height: 550,
  } as DOMRect);
  const cancel = vi.fn(),
    confirm = vi.fn(),
    reload = vi.fn(),
    props = {
      code: 'SG.001',
      host,
      pending: false,
      error: '',
      conflict: false,
      onCancel: cancel,
      onConfirm: confirm,
      onReload: reload,
    };
  const view = render(<SignDeleteDialog {...props} />);
  const dialog = screen.getByRole('dialog');
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(cancel).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(confirm).toHaveBeenCalledOnce();
  const drawer = document.createElement('div');
  drawer.setAttribute('aria-label', 'Sign details');
  host.append(drawer);
  vi.spyOn(drawer, 'getBoundingClientRect').mockReturnValue({
    left: 700,
  } as DOMRect);
  fireEvent.resize(window);
  fireEvent.scroll(window);
  expect(screen.getByTestId('sign-delete-backdrop')).toHaveStyle({
    width: '600px',
  });
  view.rerender(<SignDeleteDialog {...props} error="Stale version" conflict />);
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(reload).toHaveBeenCalledOnce();
  view.rerender(<SignDeleteDialog {...props} pending />);
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  view.unmount();
  expect(previous).toHaveFocus();
  previous.remove();
  parent.remove();
  const detached = document.createElement('div');
  const second = render(<SignDeleteDialog {...props} host={detached} />);
  previous.remove();
  second.unmount();
});
it('sign-photos REQ-009: confirms deletion, blocks closing while pending and shows retry failure', () => {
  const previous = setup(),
    cancel = vi.fn(),
    confirm = vi.fn(),
    props = {
      filename: 'photo.png',
      pending: false,
      error: '',
      onCancel: cancel,
      onConfirm: confirm,
    };
  const view = render(<PhotoDeleteDialog {...props} />);
  const dialog = screen.getByRole('dialog');
  fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(cancel).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(confirm).toHaveBeenCalledOnce();
  view.rerender(<PhotoDeleteDialog {...props} pending error="Retry" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Retry');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(cancel).toHaveBeenCalledOnce();
  view.unmount();
  expect(previous).toHaveFocus();
  previous.remove();
  const second = render(<PhotoDeleteDialog {...props} />);
  second.unmount();
});
