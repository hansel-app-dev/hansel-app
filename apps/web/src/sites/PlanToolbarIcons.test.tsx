/** @spec allocation-plan-toolbar-icons REQ-001..REQ-004 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlanToolbar } from './PlanToolbar.js';

afterEach(cleanup);
const assets = [
  'move',
  'hand',
  'add_sign',
  'add_area',
  'add_linear',
  'comment',
];
it.each(['move', 'hand', 'add'] as const)(
  'renders supplied artwork and active %s state',
  (tool) => {
    const change = vi.fn();
    const outside = vi.fn();
    render(
      <div onClick={outside}>
        <PlanToolbar tool={tool} canAdd onChange={change} />
      </div>,
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button, index) => {
      const img = button.querySelector('img');
      const asset = assets[index];
      if (!asset) throw new Error('Unexpected toolbar button');
      expect(img).toHaveAttribute('src', `/assets/${asset}_toolbar.png`);
      expect(img).toHaveAttribute('width', '34');
      expect(img).toHaveAttribute('height', '34');
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveStyle({
        filter:
          button.getAttribute('aria-pressed') === 'true'
            ? 'brightness(0) invert(1)'
            : 'none',
      });
    });
    for (const [label, value] of [
      ['Move', 'move'],
      ['Hand', 'hand'],
      ['Add sign', 'add'],
    ] as const) {
      const image = screen
        .getByRole('button', { name: label })
        .querySelector('img');
      if (!image) throw new Error('Missing supplied icon');
      fireEvent.click(image);
      expect(change).toHaveBeenLastCalledWith(value);
    }
    expect(change).toHaveBeenCalledTimes(3);
    expect(outside).not.toHaveBeenCalled();
    expect(
      buttons.filter((button) => button.hasAttribute('disabled')),
    ).toHaveLength(2);
  },
);
it('preserves Viewer and pending availability', () => {
  const change = vi.fn();
  const view = render(
    <PlanToolbar tool="move" canAdd={false} onChange={change} />,
  );
  expect(screen.getByRole('button', { name: 'Add sign' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Hand' })).toBeEnabled();
  view.rerender(<PlanToolbar tool="move" canAdd disabled onChange={change} />);
  for (const button of screen.getAllByRole('button')) {
    expect(button).toBeDisabled();
    fireEvent.click(button);
  }
  expect(change).not.toHaveBeenCalled();
});
