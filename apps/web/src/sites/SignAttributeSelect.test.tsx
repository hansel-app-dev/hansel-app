/** @spec sign-attribute-custom-dropdowns REQ-001..REQ-006 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SignAttributeSelect } from './SignAttributeSelect.js';

afterEach(cleanup);
const options = [
  'Identification',
  'Directional',
  'Informational',
  'Regulatory/Statutory',
];
it('REQ-003,004: navigates with keys, commits once and keeps focus', () => {
  const onChange = vi.fn();
  render(
    <SignAttributeSelect
      label="Function"
      value="Directional"
      options={options}
      onChange={onChange}
    />,
  );
  const trigger = screen.getByRole('combobox', { name: 'Function' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: ' ' });
  expect(screen.getByRole('option', { name: 'Directional' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  fireEvent.keyDown(trigger, { key: 'End' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'ArrowUp' });
  fireEvent.keyDown(trigger, { key: 'Home' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledExactlyOnceWith('Identification');
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('REQ-003..005: dismisses without saving and never reopens after disable', () => {
  const onChange = vi.fn();
  const props = { label: 'Colour', value: 'Red', options: ['Red'], onChange };
  const view = render(<SignAttributeSelect {...props} />);
  const trigger = screen.getByRole('combobox');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('option', { name: 'Red' }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Escape' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.keyDown(trigger, { key: 'Tab' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  view.rerender(<SignAttributeSelect {...props} disabled />);
  expect(trigger).toBeDisabled();
  view.rerender(<SignAttributeSelect {...props} />);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

it('REQ-001,003: follows scroll and zoom, fits above a low field and dismisses on focus leaving', () => {
  const onChange = vi.fn();
  render(
    <SignAttributeSelect
      label="Function"
      value="Directional"
      options={options}
      onChange={onChange}
    />,
  );
  const trigger = screen.getByRole('combobox');
  const bounds = vi
    .spyOn(trigger, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(10, 700, 250, 40));
  const readStyle = getComputedStyle;
  const styles = vi
    .spyOn(globalThis, 'getComputedStyle')
    .mockImplementation((element) => {
      const result = readStyle(element);
      Object.defineProperty(result, 'zoom', {
        value: element === document.documentElement ? '2' : '1',
      });
      return result;
    });
  document.documentElement.style.zoom = '2';
  document.body.style.zoom = '1';
  try {
    fireEvent.click(trigger);
    const popup = screen.getByRole('listbox');
    expect(popup).toHaveStyle({ width: '125px', top: '180px' });
    fireEvent.pointerDown(trigger);
    fireEvent.pointerDown(
      screen.getByRole('option', { name: 'Informational' }),
    );
    expect(popup).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Informational' }));
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Informational' }));
    expect(trigger).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Informational' }).id,
    );
    fireEvent.blur(trigger, { relatedTarget: popup });
    expect(popup).toBeInTheDocument();
    bounds.mockReturnValue(new DOMRect(10, 20, 250, 40));
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(popup).toHaveStyle({ top: '32px' });
    fireEvent.keyDown(trigger, { key: 'x' });
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  } finally {
    document.documentElement.style.zoom = '';
    document.body.style.zoom = '';
    bounds.mockRestore();
    styles.mockRestore();
  }
});

it('allocation-plan-add-area REQ-007 supports display-only custom fields without a mutation callback', () => {
  render(
    <SignAttributeSelect
      label="Fixed value"
      value="Floor"
      options={['Floor', 'Preview']}
    />,
  );
  fireEvent.click(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: 'Preview' }));
  expect(screen.getByRole('combobox')).toHaveTextContent('Floor');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
