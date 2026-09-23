/** @spec allocation-plan-add-area REQ-006..008,010,011 */
import type { ReactNode } from 'react';
import { planSignOrientationSchema, type PlanArea } from '@hansel/contracts';
import { SignAttributeSelect } from './SignAttributeSelect.js';
import { SignMountingIcon } from './SignMountingSelect.js';
const arrows = ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'];
const field =
  'h-10 w-full rounded border border-[#e2e2e7] bg-white px-2 focus-visible:outline-2 focus-visible:outline-[#4096ff]';
export function AreaDetails({
  area,
  canManage,
  pending,
  code,
  content,
  onCode,
  onContent,
  onSaveText,
  onOrientation,
  onClose,
  onDelete,
  notice,
}: {
  area: PlanArea;
  canManage: boolean;
  pending: boolean;
  code: string;
  content: string;
  onCode: (value: string) => void;
  onContent: (value: string) => void;
  onSaveText: () => void;
  onOrientation: (value: PlanArea['orientation']) => void;
  onClose: () => void;
  onDelete: () => void;
  notice: ReactNode;
}) {
  return (
    <aside
      aria-label="Area details"
      className="absolute -right-8 top-0 bottom-0 z-20 flex w-[350px] max-w-full flex-col overflow-hidden border-l border-[#e2e2e7] bg-white text-[#27272a] shadow-[-8px_0_20px_#00000014] max-md:right-0 max-[1050px]:bottom-[134px]"
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="shrink-0 px-6 pt-6">
        <button
          type="button"
          aria-label="Close area details"
          disabled={pending}
          onClick={onClose}
          className="mb-4 grid size-5 place-items-center text-2xl text-[#72727e]"
        >
          ×
        </button>
        <input
          aria-label="Area code"
          className={`${field} text-xl`}
          readOnly={!canManage}
          disabled={pending}
          value={code}
          onChange={(e) => {
            onCode(e.target.value);
          }}
          onBlur={onSaveText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSaveText();
            }
          }}
        />
      </div>
      <div
        role="tablist"
        aria-label="Area sections"
        className="mt-3 flex h-[38px] shrink-0 gap-4 border-b border-[#e2e2e7] px-6 text-sm"
      >
        {['General', 'Docs', 'Photos', 'Comments'].map((tab, i) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={i === 0}
            disabled={i !== 0}
            className={i === 0 ? 'border-b-[3px] border-[#27272a]' : ''}
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label="General"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5"
      >
        <p className="text-[13px] leading-[15px] text-[#72727e]">
          <strong>General area attributes</strong>
          <br />
          Record area type, function, content, and how it appears on the plan.
        </p>
        <div className="mt-5 space-y-4 text-sm">
          <SignAttributeSelect
            label="Type"
            value="Floor"
            options={['Floor']}
            disabled={!canManage || pending}
            icon={<SignMountingIcon value="Floor" />}
          />
          <SignAttributeSelect
            label="Function"
            value="Environmental"
            options={['Environmental']}
            disabled={!canManage || pending}
          />
          <SignAttributeSelect
            label="Colour"
            value="Blue"
            options={['Blue']}
            disabled={!canManage || pending}
            icon={
              <span
                aria-hidden="true"
                className="size-5 shrink-0 rounded-full bg-[#4096ff]"
              />
            }
          />
          <fieldset>
            <legend>Orientation</legend>
            <div className="mt-2 flex h-10 overflow-hidden rounded border border-[#e2e2e7]">
              {planSignOrientationSchema.options.map((direction, i) => (
                <button
                  key={direction}
                  type="button"
                  aria-label={`Orient area ${direction}`}
                  aria-pressed={area.orientation === direction}
                  disabled={!canManage || pending}
                  onClick={() => {
                    if (area.orientation !== direction)
                      onOrientation(direction);
                  }}
                  className={`flex-1 border-r border-[#e2e2e7] text-lg text-[#72727e] last:border-0 ${area.orientation === direction ? 'bg-[#f4f4f5]' : 'bg-white'}`}
                >
                  {arrows[i]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            Content
            <textarea
              value={content}
              readOnly={!canManage}
              disabled={pending}
              onChange={(e) => {
                onContent(e.target.value);
              }}
              onBlur={onSaveText}
              className="mt-2 h-[120px] w-full resize-none rounded border border-[#e2e2e7] p-3 focus-visible:outline-2 focus-visible:outline-[#4096ff]"
            />
          </label>
          <div className="flex items-center gap-2 text-xs text-[#72727e]">
            <button
              type="button"
              role="switch"
              aria-label="Doubleside"
              aria-checked={false}
              disabled
              className="flex h-5 w-8 items-center rounded-full bg-[#d4d4d8] p-0.5"
            >
              <span
                aria-hidden="true"
                className="size-4 rounded-full bg-white"
              />
            </button>
            Doubleside
          </div>
        </div>
        <div className="my-3">{notice}</div>
        {canManage && (
          <button
            type="button"
            disabled={pending || code !== area.code || content !== area.content}
            onClick={onDelete}
            className="mt-auto self-start rounded border border-[#ff3b3b] px-2 py-1 text-sm text-[#d92d20]"
          >
            Delete area
          </button>
        )}
      </div>
    </aside>
  );
}
