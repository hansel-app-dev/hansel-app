/** @spec site-share-hover-design AC-001..AC-003 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { SiteShareControls } from '../src/sites/SiteShareControls.js';
import { ApplicationShell } from '../src/application-shell/ApplicationShell.js';

const members = ['John Smith', 'Jane Smith', 'James Smith'].map(
  (displayName) => ({ displayName, initials: 'JS' }),
);
const dashboard = {
  viewer: { displayName: 'John Smith', initials: 'JS', roleLabel: 'Owner' },
};
const meta = {
  title: 'Sites/Share Controls',
  component: SiteShareControls,
  args: { memberPreview: members, memberCount: 3 },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <ApplicationShell
        activePage="Sites"
        siteHeader
        workspaceName="Workspace Name"
        preloadedDashboard={dashboard}
        loadDashboard={() => Promise.resolve(dashboard)}
        loadErrorMessage="Unable to load"
        logout={() => Promise.resolve()}
        headerLeading={
          <div className="truncate text-[14px]">
            Sites <span className="mx-5">›</span>
            <strong>Building A - General Teaching Space</strong>
          </div>
        }
        headerActions={<Story />}
      >
        <div className="min-h-[calc(100vh-64px)] bg-[#fafafa]" />
      </ApplicationShell>
    ),
  ],
} satisfies Meta<typeof SiteShareControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Hover: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.hover(
      within(canvasElement).getByRole('group', { name: /Members:/ }),
    );
  },
};
export const Focus: Story = {
  play: ({ canvasElement }) => {
    within(canvasElement)
      .getByRole('group', { name: /Members:/ })
      .focus();
  },
};
export const ZeroMembers: Story = {
  args: { memberPreview: [], memberCount: 0 },
};
export const OneMember: Story = {
  args: { memberPreview: members.slice(0, 1), memberCount: 1 },
};
export const MoreMembers: Story = { args: { memberCount: 7 } };
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
