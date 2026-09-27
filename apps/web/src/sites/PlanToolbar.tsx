/** @spec allocation-plan-toolbar REQ-001..002, REQ-007 */
export type PlanTool = 'move' | 'hand' | 'add' | 'area' | 'line' | 'comment';

/** @spec allocation-plan-toolbar-icons REQ-001..REQ-004 */
const tools = [
  { id: 'move', label: 'Move', icon: '/assets/move_toolbar.png' },
  { id: 'hand', label: 'Hand', icon: '/assets/hand_toolbar.png' },
  { id: 'add', label: 'Add sign', icon: '/assets/add_sign_toolbar.png' },
  {
    id: 'area',
    label: 'Add area',
    icon: '/assets/add_area_toolbar.png',
  },
  {
    id: 'line',
    label: 'Add linear',
    icon: '/assets/add_linear_toolbar.png',
  },
  {
    id: 'comment',
    label: 'Add comment',
    icon: '/assets/comment_toolbar.png',
  },
] as const;

export function PlanToolbar({
  tool,
  canAdd,
  canAddArea = false,
  canComment = false,
  disabled = false,
  onChange,
}: {
  tool: PlanTool;
  canAdd: boolean;
  canAddArea?: boolean;
  canComment?: boolean;
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
          aria-pressed={tool === item.id}
          disabled={
            disabled ||
            (item.id === 'comment'
              ? !canComment
              : item.id === 'area'
                ? !canAddArea
                : (item.id === 'add' || item.id === 'line') && !canAdd)
          }
          onClick={() => {
            onChange(item.id);
          }}
          className={`grid size-[34px] shrink-0 place-items-center rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4096ff] disabled:cursor-not-allowed ${tool === item.id ? 'bg-[#4096ff] text-white' : 'text-[#27272a] enabled:hover:bg-[#f4f4f5]'}`}
        >
          <img
            src={item.icon}
            alt=""
            aria-hidden="true"
            width="34"
            height="34"
            draggable={false}
            className="block size-[34px] object-contain"
            style={{
              filter: tool === item.id ? 'brightness(0) invert(1)' : 'none',
            }}
          />
        </button>
      ))}
    </div>
  );
}
