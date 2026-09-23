/** @spec allocation-plan-tool-cursors REQ-001,002,005 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { planToolCursors } from '../src/sites/plan-tool-cursors.js';
function CursorGallery() {
  return (
    <div className="grid max-w-5xl grid-cols-2 gap-4 p-6">
      {Object.entries(planToolCursors).map(([tool, cursor]) => {
        const src = cursor.split('"')[1];
        return (
          <section
            key={tool}
            aria-label={`${tool} cursor preview`}
            style={{ cursor }}
            className="rounded border border-[#e2e2e7] p-4"
          >
            <h2 className="mb-3 text-base font-semibold">
              {tool === 'add'
                ? 'Add sign'
                : tool === 'area'
                  ? 'Add area'
                  : tool === 'line'
                    ? 'Add linear (preview only)'
                    : tool === 'comment'
                      ? 'Comment (preview only)'
                      : tool === 'hand'
                        ? 'Hand'
                        : 'Move'}
            </h2>
            <div className="flex gap-4">
              <div className="grid h-28 w-28 place-items-center bg-white">
                <img src={src} alt="Cursor artwork on white" />
              </div>
              <div className="grid h-28 w-28 place-items-center bg-[#27272a]">
                <img src={src} alt="Cursor artwork on dark" />
              </div>
            </div>
            <p className="mt-3 text-sm">
              Hover to preview. Original size and transparency preserved.
            </p>
          </section>
        );
      })}
    </div>
  );
}
const meta = {
  title: 'Sites/Tool Cursors',
  component: CursorGallery,
} satisfies Meta<typeof CursorGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SuppliedArtwork: Story = {};
