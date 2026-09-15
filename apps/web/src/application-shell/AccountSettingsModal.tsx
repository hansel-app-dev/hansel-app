/** @spec organization-tray-settings REQ-005..REQ-011, REQ-016 */
import type { DashboardResponse } from '@hansel/contracts';
import { Modal } from '../design-system/Modal.js';

function Symbol({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className="material-symbols-200 inline-flex size-6 items-center justify-center text-[22px] text-[#687182]"
    >
      {children}
    </span>
  );
}

export interface AccountSettingsModalProps {
  viewer: DashboardResponse['viewer'];
  onClose: () => void;
}

const unavailableSections = [
  ['tune', 'Preferences'],
  ['settings', 'General'],
  ['group', 'Members'],
  ['credit_card', 'Billing'],
] as const;

export function AccountSettingsModal({
  viewer,
  onClose,
}: AccountSettingsModalProps) {
  return (
    <Modal
      title="Settings"
      onClose={onClose}
      size="wide"
      backdrop="blurred"
      initialFocus="dialog"
    >
      <div className="grid h-[716px] max-h-[calc(100vh-2rem)] grid-cols-[250px_1fr] max-md:h-auto max-md:grid-cols-1">
        <aside className="bg-[#f7f7f8] p-6 max-md:border-b">
          <p className="mb-[11px] text-[13px] text-content-muted">Account</p>
          <div className="flex h-6 min-w-0 items-center gap-[7px] text-[15px]">
            <span className="grid size-6 place-items-center rounded-full bg-[#64748b] text-[11px] text-white">
              {viewer.initials}
            </span>
            <span className="truncate">{viewer.displayName}</span>
          </div>
          <nav className="mt-3 grid" aria-label="Settings sections">
            {unavailableSections.map(([icon, label], index) => (
              <div key={label} className={index === 1 ? 'mt-[25px]' : 'mt-3'}>
                {index === 1 ? (
                  <p className="mb-[7px] text-[13px] text-content-muted">
                    Organization
                  </p>
                ) : null}
                <button
                  aria-disabled="true"
                  disabled
                  className="flex h-6 items-center gap-[7px] text-left text-[15px] disabled:cursor-default disabled:opacity-100"
                  type="button"
                >
                  <Symbol>{icon}</Symbol>
                  {label}
                </button>
              </div>
            ))}
          </nav>
        </aside>
        <section className="relative min-w-0 px-6 pb-6 pt-16 max-md:pt-16">
          <div>
            <div>
              <h2 className="text-[26px] font-semibold leading-8">Account</h2>
              <p className="mt-[2px] text-[15px] text-content-muted">
                Manage your profile and login information
              </p>
            </div>
            <button
              aria-label="Close settings"
              className="absolute right-5 top-5 grid size-8 place-items-center rounded focus-visible:outline-2 focus-visible:outline-focus"
              onClick={onClose}
              type="button"
            >
              <Symbol>close</Symbol>
            </button>
          </div>
          <h3 className="mt-[38px] border-b border-[#dedede] pb-[10px] text-[17px] font-medium">
            Profile
          </h3>
          <div className="flex h-[126px] min-w-0 items-start gap-[10px] pt-[22px]">
            <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-[#64748b] text-[16px] text-white">
              {viewer.initials}
            </span>
            <div className="min-w-0">
              <span className="block text-[13px] text-content-muted">
                Your name
              </span>
              <span className="mt-[3px] block h-7 w-[200px] max-w-full truncate rounded-[4px] border border-[#d8d8dc] bg-[#f4f4f5] px-[10px] py-[3px] text-[15px]">
                {viewer.displayName}
              </span>
              <span className="mt-[7px] inline-block max-w-full truncate rounded-[3px] bg-[#e4e9ef] px-2 py-[2px] text-[11px] leading-4">
                {viewer.roleLabel}
              </span>
            </div>
          </div>
          <h3 className="border-b border-[#dedede] pb-[10px] text-[17px] font-medium">
            Profile
          </h3>
          <SettingRow
            title="Email"
            detail={viewer.email ?? 'Email unavailable'}
            action="Manage email"
          />
          <SettingRow
            title="Password"
            detail="Set a password for your account"
            action="Manage password"
          />
          <SettingRow
            title="Two-step verification"
            detail="Add another layer of security to your account"
            action="Enable 2FA"
          />
          <h3 className="mt-6 border-b border-[#dedede] pb-[10px] text-[17px] font-medium">
            Support
          </h3>
          <SettingRow
            title="Delete my account"
            detail="Permanently delete your account. You’ll no longer be able to access any sites or organizations."
            action="Delete account"
            danger
          />
        </section>
      </div>
    </Modal>
  );
}

function SettingRow({
  title,
  detail,
  action,
  danger = false,
}: {
  title: string;
  detail: string;
  action: string;
  danger?: boolean;
}) {
  return (
    <div className="flex h-16 min-w-0 items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[15px]">{title}</p>
        <p className="mt-[1px] break-words text-[13px] leading-[15px] text-[#58708f]">
          {detail}
        </p>
      </div>
      <button
        aria-disabled="true"
        disabled
        type="button"
        className={`h-[33px] shrink-0 rounded-[4px] border px-3 text-[15px] disabled:cursor-default disabled:opacity-100 ${danger ? 'border-[#ffd8d8] bg-[#fff0f0] text-[#ff1717]' : 'border-[#d1d3d8] bg-white'}`}
      >
        {action}
      </button>
    </div>
  );
}
