/* eslint-disable @typescript-eslint/require-await -- Async callbacks model persistence. */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Sign, SignType } from '@hansel/contracts';
import { SignageSchedule } from './SignageSchedule.js';
const now = '2026-09-06T00:00:00.000Z';
const typeId = '00000000-0000-4000-8000-000000000010';
const sign: Sign = {
  id: '00000000-0000-4000-8000-000000000011',
  signTypeId: typeId,
  code: 'RS.101',
  quantity: 1,
  location: 'G001',
  content: 'Fire safety',
  comments: '',
  createdAt: now,
  updatedAt: now,
};
const type: SignType = {
  id: typeId,
  name: 'Regulatory Signs',
  color: 'RED',
  createdAt: now,
  updatedAt: now,
  quantityTotal: 1,
  signs: [sign],
};
afterEach(cleanup);
describe('SignageSchedule [site-signage-schedule AC-001..AC-005]', () => {
  it('renders real groups and performs inline create and edit actions', async () => {
    const createType = vi.fn(async (name: string) => ({
      ...type,
      id: '00000000-0000-4000-8000-000000000020',
      name,
      signs: [],
      quantityTotal: 0,
    }));
    const updateType = vi.fn(async (_type: typeof type, name: string) => ({
      ...type,
      name,
    }));
    const createSign = vi.fn(async () => ({
      ...sign,
      id: '00000000-0000-4000-8000-000000000021',
      code: 'RS.102',
    }));
    const updateSign = vi.fn(
      async (_sign: typeof sign, field: string, value: string | number) => ({
        ...sign,
        [field]: value,
      }),
    );
    render(
      <SignageSchedule
        initial={{ canManageSigns: true, signTypes: [type] }}
        createType={createType}
        updateType={updateType}
        createSign={createSign}
        updateSign={updateSign}
      />,
    );
    expect(screen.getByDisplayValue('RS.101')).toBeVisible();
    // signage-schedule-remove-status REQ-001,002
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /status/i })).toBeNull();
    expect(screen.getByDisplayValue('1')).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'Location' }),
    ).toHaveAttribute('colspan', '2');
    expect(
      screen.getByRole('columnheader', { name: 'Content' }),
    ).toHaveAttribute('colspan', '2');
    expect(screen.getByRole('table')).toHaveClass('min-w-[998px]');
    expect(screen.getByText('map').closest('td')).toHaveClass(
      'align-middle',
      'text-[#a8adb5]',
    );
    expect(screen.getByText('visibility').closest('td')).toHaveClass(
      'align-middle',
    );
    // Status labels must not remain hidden searchable attributes.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search signs' }), {
      target: { value: 'approved' },
    });
    expect(screen.queryByDisplayValue('RS.101')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Regulatory Signs' }),
    );
    expect(screen.queryByDisplayValue('RS.101')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Expand Regulatory Signs' }),
    );
    const location = screen.getByRole('textbox', { name: 'RS.101 location' });
    fireEvent.change(location, { target: { value: 'G002' } });
    fireEvent.blur(location);
    await waitFor(() => {
      expect(updateSign).toHaveBeenCalledWith(sign, 'location', 'G002');
    });
    const name = screen.getByRole('textbox', { name: 'Regulatory Signs name' });
    fireEvent.change(name, { target: { value: 'Regulatory' } });
    fireEvent.blur(name);
    await waitFor(() => {
      expect(updateType).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: /Add sign/ }));
    const code = screen.getByRole('textbox', { name: /New sign code/ });
    fireEvent.change(code, { target: { value: 'RS.102' } });
    fireEvent.blur(code);
    await waitFor(() => {
      expect(createSign).toHaveBeenCalledWith(typeId, 'RS.102');
    });
    fireEvent.click(screen.getByRole('button', { name: /New sign type/ }));
    const newName = screen.getByRole('textbox', { name: 'New sign type name' });
    fireEvent.change(newName, { target: { value: 'Wayfinding' } });
    fireEvent.blur(newName);
    await waitFor(() => {
      expect(createType).toHaveBeenCalledWith('Wayfinding');
    });
  });

  it('filters, sorts, selects, cancels drafts, and keeps failed values editable', async () => {
    const older = {
      ...sign,
      id: '00000000-0000-4000-8000-000000000012',
      code: 'RS.2',
      createdAt: '2026-09-05T00:00:00.000Z',
    };
    const initial = {
      canManageSigns: true,
      signTypes: [{ ...type, signs: [sign, older], quantityTotal: 2 }],
    };
    const rejected = vi.fn().mockRejectedValue(new Error('conflict'));
    render(
      <SignageSchedule
        initial={initial}
        createType={rejected}
        updateType={rejected}
        createSign={rejected}
        updateSign={rejected}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort signs' }), {
      target: { value: 'ZA' },
    });
    expect(
      screen
        .getAllByLabelText(/ code$/)
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(['RS.101', 'RS.2']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort signs' }), {
      target: { value: 'NEWEST' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort signs' }), {
      target: { value: 'OLDEST' },
    });
    fireEvent.click(screen.getByText('Filter'));
    expect(screen.queryByText('Statuses')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Approved' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Regulatory Signs' }));
    expect(screen.getByDisplayValue('RS.2')).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select sign RS.2' }));
    expect(screen.getByText('1 signs selected')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Select all visible/ }),
    );
    expect(screen.getByText('2 signs selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add sign/ }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: /New sign code/ }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('textbox', { name: /New sign code/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add sign/ }));
    const failedCode = screen.getByRole('textbox', { name: /New sign code/ });
    fireEvent.change(failedCode, { target: { value: 'duplicate' } });
    fireEvent.blur(failedCode);
    expect(await screen.findByText(/Could not add this sign/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /New sign type/ }));
    const draft = screen.getByRole('textbox', { name: 'New sign type name' });
    fireEvent.change(draft, { target: { value: 'Duplicate' } });
    fireEvent.blur(draft);
    expect(
      await screen.findByText(/Could not add this sign type/),
    ).toBeVisible();
    fireEvent.keyDown(draft, { key: 'Escape' });
    expect(
      screen.queryByRole('textbox', { name: 'New sign type name' }),
    ).toBeNull();
    const typeName = screen.getByRole('textbox', {
      name: 'Regulatory Signs name',
    });
    fireEvent.change(typeName, { target: { value: 'Broken' } });
    fireEvent.keyDown(typeName, { key: 'Enter' });
    expect(
      await screen.findByText('Could not save this sign type.'),
    ).toBeVisible();
    fireEvent.keyDown(typeName, { key: 'Escape' });
    const location = screen.getByRole('textbox', { name: 'RS.101 location' });
    fireEvent.change(location, { target: { value: 'failed value' } });
    fireEvent.blur(location);
    expect(await screen.findByText(/Could not save this value/)).toBeVisible();
    fireEvent.keyDown(location, { key: 'Escape' });
    expect(screen.queryByRole('combobox', { name: /status/i })).toBeNull();
  });

  it('renders viewers without mutation controls', () => {
    render(
      <SignageSchedule
        initial={{ canManageSigns: false, signTypes: [type] }}
        createType={vi.fn()}
        updateType={vi.fn()}
        createSign={vi.fn()}
        updateSign={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /New sign type/ })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'RS.101 code' })).toBeDisabled();
    expect(
      screen.getByRole('heading', { name: 'Regulatory Signs' }),
    ).toBeVisible();
  });

  it('reconciles mutations without changing unrelated groups', async () => {
    const other: SignType = {
      ...type,
      id: '00000000-0000-4000-8000-000000000030',
      name: 'Wayfinding',
      color: 'TEAL',
      signs: [],
      quantityTotal: 0,
    };
    const updated = { ...sign, location: 'G009' };
    render(
      <SignageSchedule
        initial={{ canManageSigns: true, signTypes: [type, other] }}
        createType={() => Promise.resolve(other)}
        updateType={() => Promise.resolve(type)}
        createSign={() =>
          Promise.resolve({
            ...sign,
            id: '00000000-0000-4000-8000-000000000040',
          })
        }
        updateSign={() => Promise.resolve(updated)}
      />,
    );
    const location = screen.getByRole('textbox', { name: 'RS.101 location' });
    fireEvent.change(location, { target: { value: 'G009' } });
    fireEvent.blur(location);
    const add = screen.getAllByRole('button', { name: /Add sign/ })[0];
    if (!add) throw new Error('Expected an Add sign button');
    fireEvent.click(add);
    const code = screen.getByRole('textbox', {
      name: /New sign code in Regulatory/,
    });
    fireEvent.change(code, { target: { value: 'RS.200' } });
    fireEvent.blur(code);
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'RS.101 location' }),
      ).toHaveValue('G009'),
    );
    expect(
      screen.getByRole('textbox', { name: 'Wayfinding name' }),
    ).toBeVisible();
  });
});

it('preserves sibling Types and Signs through edits and toggles group selection in all colour groups', async () => {
  const sibling = {
    ...sign,
    id: '00000000-0000-4000-8000-000000000012',
    code: 'RS.102',
    quantity: 2,
  };
  const teal = {
      ...type,
      id: '00000000-0000-4000-8000-000000000020',
      name: 'Teal',
      color: 'TEAL' as const,
      signs: [],
    },
    slate = {
      ...teal,
      id: '00000000-0000-4000-8000-000000000030',
      name: 'Slate',
      color: 'SLATE' as const,
    };
  const updateType = vi.fn(async (_type: SignType, name: string) => ({
      ...type,
      name,
      signs: [sign, sibling],
    })),
    updateSign = vi.fn(
      async (_sign: Sign, field: string, value: string | number) => ({
        ...sign,
        [field]: value,
      }),
    );
  const createSign = vi.fn(async () => sibling),
    createType = vi.fn(async () => teal);
  render(
    <SignageSchedule
      initial={{
        canManageSigns: true,
        signTypes: [{ ...type, signs: [sign, sibling] }, teal, slate],
      }}
      createType={createType}
      updateType={updateType}
      createSign={createSign}
      updateSign={updateSign}
    />,
  );
  const select = screen.getByRole('checkbox', {
    name: 'Select all visible signs in Regulatory Signs',
  });
  fireEvent.click(select);
  expect(select).toBeChecked();
  fireEvent.click(select);
  expect(select).not.toBeChecked();
  const name = screen.getByRole('textbox', { name: 'Regulatory Signs name' });
  fireEvent.keyDown(name, { key: 'Enter' });
  expect(updateType).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: 'Renamed' } });
  fireEvent.keyDown(name, { key: 'Enter' });
  fireEvent.blur(name);
  await waitFor(() => {
    expect(updateType).toHaveBeenCalledOnce();
  });
  expect(screen.getByDisplayValue('Teal')).toBeVisible();
  const quantity = screen.getByRole('spinbutton', { name: 'RS.101 quantity' });
  fireEvent.keyDown(quantity, { key: 'Enter' });
  expect(updateSign).not.toHaveBeenCalled();
  fireEvent.change(quantity, { target: { value: '3' } });
  fireEvent.keyDown(quantity, { key: 'Escape' });
  expect(quantity).toHaveValue(1);
  fireEvent.change(quantity, { target: { value: '3' } });
  fireEvent.keyDown(quantity, { key: 'Enter' });
  await waitFor(() => {
    expect(updateSign).toHaveBeenCalledOnce();
  });
  expect(screen.getByDisplayValue('RS.102')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /New sign type/ }));
  const input = screen.getByRole('textbox', { name: 'New sign type name' });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(
    screen.queryByRole('textbox', { name: 'New sign type name' }),
  ).toBeNull();
});

it('creates a Type through the draft Enter shortcut', async () => {
  const createType = vi.fn().mockResolvedValue(type);
  render(
    <SignageSchedule
      initial={{ canManageSigns: true, signTypes: [] }}
      createType={createType}
      updateType={vi.fn()}
      createSign={vi.fn()}
      updateSign={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /New sign type/ }));
  const input = screen.getByRole('textbox', { name: 'New sign type name' });
  fireEvent.change(input, { target: { value: 'Regulatory Signs' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => {
    expect(createType).toHaveBeenCalledWith('Regulatory Signs');
  });
});
