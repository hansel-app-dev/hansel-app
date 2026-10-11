import { useState } from 'react';
import { Button, Modal } from '../design-system/index.js';

export type WorkspaceInvite = { email: string; role: 'Viewer' | 'Editor' };

export interface InviteMembersModalProps {
  initialInvites?: readonly WorkspaceInvite[];
  onClose: () => void;
  onSubmit?: (invites: readonly WorkspaceInvite[]) => void | Promise<void>;
}

export function InviteMembersModal({
  initialInvites = [],
  onClose,
  onSubmit,
}: InviteMembersModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceInvite['role']>('Viewer');
  const [invites, setInvites] = useState<WorkspaceInvite[]>(() => [
    ...initialInvites,
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addInvite = () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return;
    if (invites.some((invite) => invite.email === normalized)) return;
    setInvites((current) => [...current, { email: normalized, role }]);
    setEmail('');
  };

  const submit = async () => {
    if (!invites.length || !onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(invites);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} size="compact" title="Invite members">
      <div className="flex flex-col overflow-hidden rounded-t-[6px] bg-white">
        <div className="flex h-[52px] items-center justify-between border-b border-[#d4d4d8] px-6 py-[14px]">
          <h2 className="text-[15px] font-medium leading-[19.6px]">
            Invite members
          </h2>
          <button
            aria-label="Close invite members"
            className="grid size-6 place-items-center rounded-[4px] text-[20px] leading-none text-[#686763] hover:bg-[#f4f4f5]"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="flex flex-col gap-3 border-b border-[#cbd5e1] px-6 pb-4 pt-[24px]">
          <p className="text-[13px] leading-[19.6px]">
            Invite people to collaborate in this workspace
          </p>
          <div className="flex items-end gap-2">
            <input
              aria-label="Email address"
              className="h-10 min-w-0 flex-1 rounded-[6px] border border-[#e4e4e7] px-4 py-2 text-[13px] outline-none focus:border-[#64748b] focus:ring-2 focus:ring-[#cbd5e1]"
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addInvite();
                }
              }}
              placeholder="team@example.com"
              type="email"
              value={email}
            />
            <select
              aria-label="Invite role"
              className="h-10 w-[110px] rounded-[6px] border border-[#e4e4e7] bg-white px-4 py-2 text-[13px] outline-none focus:border-[#64748b] focus:ring-2 focus:ring-[#cbd5e1]"
              onChange={(event) =>
                setRole(event.target.value as WorkspaceInvite['role'])
              }
              value={role}
            >
              <option>Viewer</option>
              <option>Editor</option>
            </select>
            <Button
              className="h-10 min-h-10 rounded-[4px] bg-[#334155] px-4 text-[13px] font-normal text-white hover:bg-[#334155]"
              disabled={!email.trim() || !email.includes('@')}
              onClick={addInvite}
            >
              Add
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-6 py-5">
          {invites.length ? (
            <>
              <p className="text-[13px] leading-[19.6px]">You are inviting</p>
              {invites.map((invite) => (
                <div
                  className="flex items-center justify-between rounded-[6px] border border-[#a855f7] bg-[#faf5ff] p-3"
                  key={`${invite.email}-${invite.role}`}
                >
                  <span className="min-w-0 truncate text-[13px] font-semibold">
                    {invite.email}{' '}
                    <span className="font-normal text-[#a855f7]">External</span>
                  </span>
                  <span className="ml-3 flex shrink-0 items-center gap-2">
                    <span className="rounded-[4px] bg-[#e2e8f0] px-2 py-[3px] text-[11px] font-medium">
                      {invite.role}
                    </span>
                    <button
                      aria-label={`Remove ${invite.email}`}
                      className="grid size-6 place-items-center rounded-[4px] text-[18px] leading-none text-[#686763] hover:bg-white"
                      onClick={() =>
                        setInvites((current) =>
                          current.filter((item) => item !== invite),
                        )
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-[13px] leading-[19.6px] text-[#71717a]">
              People you invite will appear here.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-4 rounded-b-[6px] bg-[#f8fafc] px-6 py-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!invites.length || !onSubmit || submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? 'Sending…'
            : invites.length
              ? `Send ${invites.length} invite${invites.length === 1 ? '' : 's'}`
              : 'Send invites'}
        </Button>
      </div>
    </Modal>
  );
}
