/** @spec site-share-hover-design REQ-001..REQ-006 */
import type { SiteMemberPreview } from '@hansel/contracts';
import { AppSymbol } from '../application-shell/ApplicationShell.js';

export function SiteShareControls({
  memberPreview = [],
  memberCount = 0,
}: {
  memberPreview?: readonly SiteMemberPreview[];
  memberCount?: number;
}) {
  const members = memberPreview.slice(0, 3);
  const remaining = Math.max(0, memberCount - members.length);
  const label = [
    `Members: ${members.map((member) => member.displayName).join(', ')}`,
    remaining ? `${String(remaining)} more` : null,
  ]
    .filter(Boolean)
    .join('; ');
  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-y-2 pr-1 text-[#27272a] max-md:w-full max-md:pr-0">
      <div className="flex max-w-full items-center gap-2">
        {memberCount > 0 && (
          <div
            role="group"
            aria-label={label}
            aria-description="Access management unavailable"
            aria-disabled="true"
            tabIndex={0}
            className="group flex h-8 cursor-default items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span
              className="relative z-10 isolate flex items-center"
              aria-hidden="true"
            >
              {members.map((member, index) => (
                <span
                  key={`${member.displayName}-${String(index)}`}
                  style={{ zIndex: 3 - index }}
                  className="-ml-3 grid size-8 shrink-0 place-items-center rounded-full border border-white bg-[#4096ff] text-[12px] font-medium leading-4 text-white first:ml-0"
                >
                  {member.initials}
                </span>
              ))}
            </span>
            {remaining > 0 && (
              <span
                aria-hidden="true"
                className="grid h-8 min-w-8 place-items-center bg-[#e4e4e7] px-1 text-[12px]"
              >
                +{remaining}
              </span>
            )}
            <span
              aria-hidden="true"
              data-testid="site-access-pill"
              className="relative -ml-3 h-8 w-7 shrink-0 overflow-hidden rounded-r-full bg-[#e4e4e7] transition-[width] duration-200 ease-out motion-reduce:duration-0 motion-reduce:transition-none group-hover:w-[115px] group-focus-within:w-[115px]"
            >
              <AppSymbol className="absolute right-[5px] top-[6px] !size-5 text-[20px] text-[#90909c] transition-opacity duration-150 ease-out motion-reduce:duration-0 motion-reduce:transition-none group-hover:opacity-0 group-focus-within:opacity-0">
                add_circle
              </AppSymbol>
              <span className="invisible absolute right-[10px] top-2 w-[90px] translate-x-1 whitespace-nowrap text-[12px] leading-4 opacity-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:duration-0 motion-reduce:transition-none group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-x-0 group-focus-within:opacity-100">
                Manage access
              </span>
            </span>
          </div>
        )}
        <div className="flex h-8 w-24 shrink-0 overflow-hidden rounded border border-[#d4d4d8] bg-[#fafafa]">
          <button
            aria-label="Share site"
            disabled
            type="button"
            className="h-full w-[63px] shrink-0 cursor-default text-[14px] leading-5"
          >
            Share
          </button>
          <button
            aria-label="Share options"
            disabled
            type="button"
            className="grid h-full flex-1 cursor-default place-items-center border-l border-[#d4d4d8]"
          >
            <AppSymbol className="!size-4 text-[16px]">
              keyboard_arrow_down
            </AppSymbol>
          </button>
        </div>
      </div>
      <div className="ml-6 flex h-8 items-center">
        <span aria-hidden="true" className="h-8 w-px bg-[#e4e4e7]" />
        <button
          aria-label="Notifications"
          disabled
          type="button"
          className="ml-[19px] grid size-8 cursor-default place-items-center"
        >
          <AppSymbol>notifications_none</AppSymbol>
        </button>
        <button
          aria-label="Site settings"
          disabled
          type="button"
          className="ml-2 grid size-8 cursor-default place-items-center text-[#73737f]"
        >
          <AppSymbol>tune</AppSymbol>
        </button>
      </div>
    </div>
  );
}
