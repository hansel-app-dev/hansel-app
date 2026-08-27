import type { Preview } from '@storybook/react-vite';
import '@fontsource-variable/figtree';
import '../src/styles.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    options: { storySort: { order: ['Design System', 'Onboarding'] } },
  },
};

export default preview;
