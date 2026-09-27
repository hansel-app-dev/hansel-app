/** @spec site-signage-schedule REQ-006..REQ-018 */
import {
  Fragment,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type {
  Sign,
  SignType,
  SignageScheduleResponse,
} from '@hansel/contracts';
import { AppSymbol } from '../application-shell/ApplicationShell.js';
import { Button } from '../design-system/index.js';

const colors = {
  SLATE: { text: 'text-[#62748d]', rail: 'border-l-[#62748d]' },
  RED: { text: 'text-[#ff3b3b]', rail: 'border-l-[#ff3b3b]' },
  TEAL: { text: 'text-[#00b8a9]', rail: 'border-l-[#00b8a9]' },
} as const;
type EditableField = 'code' | 'quantity' | 'location' | 'content' | 'comments';
type Sort = 'AZ' | 'ZA' | 'NEWEST' | 'OLDEST';

export function SignageSchedule({
  initial,
  createType,
  updateType,
  createSign,
  updateSign,
}: {
  initial: SignageScheduleResponse;
  createType: (name: string) => Promise<SignType>;
  updateType: (type: SignType, name: string) => Promise<SignType>;
  createSign: (typeId: string, code: string) => Promise<Sign>;
  updateSign: (
    sign: Sign,
    field: EditableField,
    value: string | number,
  ) => Promise<Sign>;
}) {
  const [types, setTypes] = useState(initial.signTypes);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('AZ');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newTypeDraft, setNewTypeDraft] = useState<string>();
  const [newTypeError, setNewTypeError] = useState('');
  const [signDrafts, setSignDrafts] = useState<Record<string, string>>({});
  const [signDraftErrors, setSignDraftErrors] = useState<
    Record<string, string>
  >({});
  const normalized = query.trim().toLocaleLowerCase();
  const shown = useMemo(
    () =>
      types
        .filter((type) => typeFilters.size === 0 || typeFilters.has(type.id))
        .map((type) => ({
          ...type,
          signs: type.signs
            .filter((sign) =>
              [
                type.name,
                sign.code,
                sign.location,
                sign.content,
                sign.comments,
              ].some((value) => value.toLocaleLowerCase().includes(normalized)),
            )
            .sort((left, right) => {
              if (sort === 'NEWEST' || sort === 'OLDEST') {
                const result = left.createdAt.localeCompare(right.createdAt);
                return sort === 'NEWEST' ? -result : result;
              }
              const result = left.code.localeCompare(right.code, undefined, {
                numeric: true,
                sensitivity: 'base',
              });
              return sort === 'ZA' ? -result : result;
            }),
        })),
    [normalized, sort, typeFilters, types],
  );
  const replaceType = (next: SignType) => {
    setTypes((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
  };
  const replaceSign = (next: Sign) => {
    setTypes((current) =>
      current.map((type) =>
        type.id !== next.signTypeId
          ? type
          : {
              ...type,
              signs: type.signs.map((sign) =>
                sign.id === next.id ? next : sign,
              ),
              quantityTotal: type.signs.reduce(
                (sum, sign) =>
                  sum + (sign.id === next.id ? next.quantity : sign.quantity),
                0,
              ),
            },
      ),
    );
  };
  const toggle = <T,>(setter: Dispatch<SetStateAction<Set<T>>>, value: T) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  return (
    <section aria-label="Signage Schedule" className="mt-2 min-w-0">
      <div className="flex flex-wrap items-center gap-7 py-2 text-sm">
        <label className="flex items-center gap-2">
          <AppSymbol weight={100}>search</AppSymbol>
          <span className="sr-only">Search signs</span>
          <input
            className="w-[38px] bg-transparent outline-none focus:w-44"
            placeholder="Search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>
        <details className="relative">
          <summary className="flex min-h-6 cursor-pointer list-none items-center gap-2">
            <AppSymbol weight={100}>filter_alt</AppSymbol>Filter
            <AppSymbol weight={100}>keyboard_arrow_down</AppSymbol>
          </summary>
          <fieldset className="absolute z-10 mt-2 min-w-56 rounded border bg-white p-3 shadow">
            <legend className="font-semibold">Sign types</legend>
            {types.map((type) => (
              <label className="mt-2 flex gap-2" key={type.id}>
                <input
                  checked={typeFilters.has(type.id)}
                  type="checkbox"
                  onChange={() => {
                    toggle(setTypeFilters, type.id);
                  }}
                />
                {type.name}
              </label>
            ))}
          </fieldset>
        </details>
        <label className="relative flex items-center gap-2 focus-within:outline-2 focus-within:outline-focus">
          <AppSymbol weight={100}>swap_vert</AppSymbol>Sort
          <select
            aria-label="Sort signs"
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as Sort);
            }}
          >
            <option value="AZ">Sign code A–Z</option>
            <option value="ZA">Sign code Z–A</option>
            <option value="NEWEST">Newest</option>
            <option value="OLDEST">Oldest</option>
          </select>
        </label>
      </div>
      <p className="sr-only" aria-live="polite">
        {selected.size} signs selected
      </p>
      {shown.map((type) => {
        const draft = signDrafts[type.id];
        const ids = type.signs.map((sign) => sign.id);
        const allSelected =
          ids.length > 0 && ids.every((id) => selected.has(id));
        return (
          <section
            className="mt-6"
            key={type.id}
            aria-labelledby={`type-${type.id}`}
          >
            <div
              className={`flex h-6 items-center gap-2 font-semibold ${colors[type.color].text}`}
            >
              <button
                className="min-h-6 min-w-6"
                aria-expanded={!collapsed.has(type.id)}
                aria-label={`${collapsed.has(type.id) ? 'Expand' : 'Collapse'} ${type.name}`}
                onClick={() => {
                  toggle(setCollapsed, type.id);
                }}
                type="button"
              >
                <AppSymbol weight={100}>keyboard_arrow_down</AppSymbol>
              </button>
              <span aria-hidden="true">●</span>
              {initial.canManageSigns ? (
                <EditableTypeName
                  type={type}
                  save={async (name) => {
                    replaceType(await updateType(type, name));
                  }}
                />
              ) : (
                <h2 id={`type-${type.id}`}>{type.name}</h2>
              )}
            </div>
            {!collapsed.has(type.id) ? (
              <div className="mt-4 max-w-full overflow-x-auto">
                <table
                  className={`w-full min-w-[998px] table-fixed border-separate border-spacing-0 text-left text-sm [&_thead_th]:border-t [&_thead_th:last-child]:border-r [&_thead_th:last-child]:rounded-tr-md [&_thead_th:first-child]:rounded-tl-md [&_tbody_td:last-child]:border-r [&_tbody_tr:last-child_td]:border-b [&_thead]:bg-white [&_tbody]:bg-white [&_thead_th:first-child]:border-l-[6px] [&_tbody_td:first-child]:border-l-[6px] ${type.color === 'RED' ? '[&_thead_th:first-child]:border-l-[#ff3b3b] [&_tbody_td:first-child]:border-l-[#ff3b3b]' : type.color === 'TEAL' ? '[&_thead_th:first-child]:border-l-[#00b8a9] [&_tbody_td:first-child]:border-l-[#00b8a9]' : '[&_thead_th:first-child]:border-l-[#62748d] [&_tbody_td:first-child]:border-l-[#62748d]'}`}
                >
                  <colgroup>
                    <col className="w-[40px]" />
                    <col className="w-[150px]" />
                    <col className="w-[80px]" />
                    <col className="w-[116px]" />
                    <col className="w-[34px]" />
                    <col className="w-[136px]" />
                    <col className="w-[34px]" />
                    <col className="w-[150px]" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr className="h-[35px]">
                      <th className="border-b border-r border-control-border p-0 text-center">
                        <input
                          aria-label={`Select all visible signs in ${type.name}`}
                          checked={allSelected}
                          type="checkbox"
                          onChange={() => {
                            setSelected((current) => {
                              const next = new Set(current);
                              ids.forEach((id) =>
                                allSelected ? next.delete(id) : next.add(id),
                              );
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th className="border-b border-r border-control-border px-3 font-normal">
                        Sign code
                      </th>
                      <th className="border-b border-r border-control-border px-3 font-normal">
                        Quantity
                      </th>
                      <th
                        className="border-b border-r border-control-border px-3 font-normal"
                        colSpan={2}
                      >
                        Location
                      </th>
                      <th
                        className="border-b border-r border-control-border px-3 font-normal"
                        colSpan={2}
                      >
                        Content
                      </th>
                      <th className="border-b border-r border-control-border px-3 font-normal">
                        Comments
                      </th>
                      <th
                        className="border-b border-control-border"
                        aria-hidden="true"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {type.signs.map((sign) => (
                      <SignRow
                        canEdit={initial.canManageSigns}
                        checked={selected.has(sign.id)}
                        key={sign.id}
                        sign={sign}
                        onCheck={() => {
                          toggle(setSelected, sign.id);
                        }}
                        save={async (field, value) => {
                          replaceSign(await updateSign(sign, field, value));
                        }}
                      />
                    ))}
                    {initial.canManageSigns ? (
                      <tr>
                        <td className="h-[35px] border-r border-control-border" />
                        <td
                          colSpan={8}
                          className="h-[35px] border-control-border px-3 text-content-muted"
                        >
                          {draft !== undefined ? (
                            <DraftInput
                              label={`New sign code in ${type.name}`}
                              value={draft}
                              error={signDraftErrors[type.id]}
                              onChange={(value) => {
                                setSignDrafts((current) => ({
                                  ...current,
                                  [type.id]: value,
                                }));
                              }}
                              onCancel={() => {
                                setSignDrafts(
                                  ({ [type.id]: _, ...rest }) => rest,
                                );
                                setSignDraftErrors(
                                  ({ [type.id]: _, ...rest }) => rest,
                                );
                              }}
                              onSave={async (code) => {
                                try {
                                  const sign = await createSign(type.id, code);
                                  setTypes((current) =>
                                    current.map((item) =>
                                      item.id === type.id
                                        ? {
                                            ...item,
                                            signs: [...item.signs, sign],
                                            quantityTotal:
                                              item.quantityTotal +
                                              sign.quantity,
                                          }
                                        : item,
                                    ),
                                  );
                                  setSignDrafts(
                                    ({ [type.id]: _, ...rest }) => rest,
                                  );
                                } catch {
                                  setSignDraftErrors((current) => ({
                                    ...current,
                                    [type.id]:
                                      'Could not add this sign. Check that its code is unique.',
                                  }));
                                }
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSignDrafts((current) => ({
                                  ...current,
                                  [type.id]: '',
                                }));
                              }}
                            >
                              + Add sign
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot>
                    <tr className="h-[35px]">
                      <td />
                      <td />
                      <td className="rounded-bl-md border-b border-l border-r border-control-border bg-white px-3">
                        {type.signs.reduce(
                          (sum, sign) => sum + sign.quantity,
                          0,
                        )}
                      </td>
                      <td
                        colSpan={6}
                        className="rounded-br-md border-b border-r border-control-border bg-white"
                      />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}
      {initial.canManageSigns ? (
        newTypeDraft !== undefined ? (
          <DraftInput
            className="mt-8 rounded border px-3 py-2"
            label="New sign type name"
            value={newTypeDraft}
            error={newTypeError}
            onChange={setNewTypeDraft}
            onCancel={() => {
              setNewTypeDraft(undefined);
              setNewTypeError('');
            }}
            onSave={async (name) => {
              try {
                const type = await createType(name);
                setTypes((current) => [...current, type]);
                setNewTypeDraft(undefined);
              } catch {
                setNewTypeError(
                  'Could not add this sign type. Check that its name is unique.',
                );
              }
            }}
          />
        ) : (
          <Button
            className="mt-8"
            variant="primary"
            onClick={() => {
              setNewTypeDraft('');
            }}
          >
            ＋ New sign type
          </Button>
        )
      ) : null}
    </section>
  );
}

function DraftInput({
  label,
  value,
  error,
  onChange,
  onSave,
  onCancel,
  className = '',
}: {
  label: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const persist = async () => {
    const next = value.trim();
    if (!next || saving) return;
    setSaving(true);
    await onSave(next);
    setSaving(false);
  };
  return (
    <span className="inline-flex flex-col">
      <input
        autoFocus
        aria-describedby={error ? `${label}-error` : undefined}
        aria-label={label}
        className={`${className} outline-none`}
        disabled={saving}
        placeholder={label.includes('type') ? 'Sign type name' : 'Sign code'}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
          if (event.key === 'Enter') void persist();
        }}
        onBlur={() => void persist()}
      />
      {saving ? <span role="status">Saving…</span> : null}
      {error ? (
        <span id={`${label}-error`} className="text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function EditableTypeName({
  type,
  save,
}: {
  type: SignType;
  save: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(type.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const persist = async () => {
    const next = value.trim();
    if (!next || next === type.name || saving) return;
    setSaving(true);
    setError('');
    try {
      await save(next);
    } catch {
      setError('Could not save this sign type.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <span className="inline-flex flex-col">
      <input
        id={`type-${type.id}`}
        aria-describedby={error ? `type-${type.id}-error` : undefined}
        className="bg-transparent font-semibold outline-none"
        disabled={saving}
        value={value}
        aria-label={`${type.name} name`}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void persist();
          if (event.key === 'Escape') setValue(type.name);
        }}
        onBlur={() => void persist()}
      />
      {saving ? <span role="status">Saving…</span> : null}
      {error ? (
        <span id={`type-${type.id}-error`} className="text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function SignRow({
  sign,
  canEdit,
  checked,
  onCheck,
  save,
}: {
  sign: Sign;
  canEdit: boolean;
  checked: boolean;
  onCheck: () => void;
  save: (field: EditableField, value: string | number) => Promise<void>;
}) {
  return (
    <tr className="h-[35px]">
      <td className="border-b border-r border-control-border p-0 text-center">
        <input
          aria-label={`Select sign ${sign.code}`}
          checked={checked}
          type="checkbox"
          onChange={onCheck}
        />
      </td>
      {(
        [
          'code',
          'quantity',
          'location',
          'content',
          'comments',
        ] as EditableField[]
      ).map((field) => (
        <Fragment key={field}>
          <SignCell canEdit={canEdit} field={field} sign={sign} save={save} />
          {field === 'location' ? <IndicatorCell glyph="map" /> : null}
          {field === 'content' ? <IndicatorCell glyph="visibility" /> : null}
        </Fragment>
      ))}
      <td className="border-b border-control-border" aria-hidden="true" />
    </tr>
  );
}

function SignCell({
  sign,
  field,
  canEdit,
  save,
}: {
  sign: Sign;
  field: EditableField;
  canEdit: boolean;
  save: (field: EditableField, value: string | number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(sign[field]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const persist = async (raw = value) => {
    const next = field === 'quantity' ? Number(raw) : raw;
    if (next === sign[field] || saving) return;
    setSaving(true);
    setError('');
    try {
      await save(field, next);
    } catch {
      setError('Could not save this value. Reload if it changed elsewhere.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <td className="border-b border-r border-control-border p-0">
      <input
        aria-describedby={error ? `${sign.id}-${field}-error` : undefined}
        aria-label={`${sign.code} ${field}`}
        className="h-[34px] w-full min-w-0 truncate bg-transparent px-3 outline-none"
        disabled={!canEdit || saving}
        value={value}
        type={field === 'quantity' ? 'number' : 'text'}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void persist();
          if (event.key === 'Escape') setValue(String(sign[field]));
        }}
        onBlur={() => void persist()}
      />
      {saving ? (
        <span className="sr-only" role="status">
          Saving {field}
        </span>
      ) : null}
      {error ? (
        <span
          id={`${sign.id}-${field}-error`}
          className="block px-3 text-danger"
          role="alert"
        >
          {error}
        </span>
      ) : null}
    </td>
  );
}

function IndicatorCell({ glyph }: { glyph: 'map' | 'visibility' }) {
  return (
    <td
      className="border-b border-r border-control-border text-center align-middle text-[#a8adb5]"
      aria-hidden="true"
    >
      <AppSymbol className="!size-[18px] text-[18px]" weight={100}>
        {glyph}
      </AppSymbol>
    </td>
  );
}
