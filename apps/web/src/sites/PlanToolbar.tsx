/** @spec allocation-plan-toolbar REQ-001..002, REQ-007 */
export type PlanTool = 'move' | 'add';

const tools = [
  { id: 'move', label: 'Move', path: 'M6 3 20 13 13 14 9 21Z' },
  {
    id: 'hand',
    label: 'Hand (coming soon)',
    path: 'M8 13V6a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v6c0 4-2 7-6 7-3 0-5-2-7-5l-3-4a1.5 1.5 0 0 1 2-2l2 2Z',
  },
  {
    id: 'add',
    label: 'Add sign',
    path: 'M3 1v6M0 4h6M22 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  },
  {
    id: 'rectangle',
    label: 'Rectangle (coming soon)',
    path: 'M3 1v6M0 4h6M8 7h14v15H8Z',
  },
  {
    id: 'line',
    label: 'Line (coming soon)',
    path: 'M3 1v6M0 4h6M7 8l14 13M6 7h2v2H6ZM20 20h2v2h-2Z',
  },
  { id: 'comment', label: 'Comment (coming soon)', path: 'M3 3h19v14H9l-6 5Z' },
] as const;

export function PlanToolbar({
  tool,
  canAdd,
  disabled = false,
  onChange,
}: {
  tool: PlanTool;
  canAdd: boolean;
  disabled?: boolean;
  onChange: (tool: PlanTool) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Plan tools"
      className="flex h-12 w-[282px] max-w-full items-center justify-between gap-1 rounded-lg border border-[#e2e2e7] bg-white px-2 shadow-[0_2px_3px_#00000008]"
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {tools.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-label={item.label}
          title={item.label}
          aria-pressed={
            item.id === 'move' || item.id === 'add'
              ? tool === item.id
              : undefined
          }
          disabled={
            disabled || (item.id !== 'move' && (item.id !== 'add' || !canAdd))
          }
          onClick={
            item.id === 'move'
              ? () => {
                  onChange('move');
                }
              : () => {
                  onChange('add');
                }
          }
          className={`grid size-[34px] shrink-0 place-items-center rounded-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4096ff] disabled:cursor-not-allowed ${tool === item.id ? 'bg-[#4096ff] text-white' : 'text-[#27272a] enabled:hover:bg-[#f4f4f5]'}`}
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d={item.path}
              strokeDasharray={item.id === 'rectangle' ? '3 2' : undefined}
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
