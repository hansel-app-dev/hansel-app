import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve();
const errors: string[] = [];

async function read(relativePath: string): Promise<string> {
  try {
    return await readFile(path.join(root, relativePath), 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(`REQ-012: cannot read ${relativePath} (${reason})`);
    return '';
  }
}

async function mustExist(relativePath: string): Promise<void> {
  try {
    await access(path.join(root, relativePath));
  } catch {
    errors.push(`REQ-009, REQ-012: missing ${relativePath}`);
  }
}

const webPackage = JSON.parse(await read('apps/web/package.json')) as {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const rootPackage = JSON.parse(await read('package.json')) as {
  scripts?: Record<string, string>;
};
const styles = await read('apps/web/src/styles.css');
const button = await read('apps/web/src/design-system/Button.tsx');
const textField = await read('apps/web/src/design-system/TextField.tsx');
const selectField = await read('apps/web/src/design-system/SelectField.tsx');
const publicInterface = await read('apps/web/src/design-system/index.ts');
const storybookConfig = await read('apps/web/.storybook/main.ts');
const storybookPreview = await read('apps/web/.storybook/preview.ts');
const browserTest = await read(
  'apps/web/design-system-e2e/design-system.spec.ts',
);

for (const token of [
  '--color-foundation-brown-500: #634739',
  '--color-foundation-off-white-500: #f7f5eb',
  '--color-foundation-white: #ffffff',
  '--color-canvas:',
  '--color-surface:',
  '--color-content:',
  '--color-action-primary:',
  '--color-control-border:',
  '--color-focus:',
  '--color-danger:',
  '--font-sans:',
  '--spacing-control-inline:',
  '--spacing-control-block:',
  '--spacing-field-inline:',
  '--spacing-field-block:',
  '--spacing-field-gap:',
  '--spacing-component-gap:',
  '--spacing-workbench:',
  '--radius-control:',
  '--border-width-control:',
  '--shadow-control:',
  '--focus-ring-width:',
  '--focus-ring-offset:',
]) {
  if (!styles.includes(token)) {
    errors.push(`REQ-001, REQ-002: styles.css must declare ${token}`);
  }
}

for (const exported of [
  'Button, type ButtonProps',
  'TextField, type TextFieldProps',
  'SelectField, type SelectFieldProps',
]) {
  if (!publicInterface.includes(exported)) {
    errors.push(`REQ-003: design-system interface must export ${exported}`);
  }
}

const designSystemSource = `${button}\n${textField}\n${selectField}\n${publicInterface}`;
for (const nodeId of ['1:3', '131:549', '2019:2296']) {
  if (!designSystemSource.includes(nodeId)) {
    errors.push(`REQ-011: design-system source must cite Figma node ${nodeId}`);
  }
}
if (/#[\da-f]{3,8}/i.test(`${button}\n${textField}\n${selectField}`)) {
  errors.push(
    'REQ-001: reusable design-system components must not contain raw color values',
  );
}

const requiredDependencies: [string, string][] = [
  ['storybook', '^10.'],
  ['@storybook/react-vite', '^10.'],
  ['@storybook/addon-a11y', '^10.'],
  ['@axe-core/playwright', '^4.'],
];
for (const [dependency, major] of requiredDependencies) {
  if (!webPackage.devDependencies?.[dependency]?.startsWith(major)) {
    errors.push(
      `REQ-007, REQ-008: apps/web must declare ${dependency} ${major}x`,
    );
  }
}
if (!webPackage.scripts?.storybook || !webPackage.scripts['build:storybook']) {
  errors.push('REQ-007: apps/web must expose Storybook dev and build commands');
}
if (!rootPackage.scripts?.['test:design-system']) {
  errors.push('REQ-008, REQ-009: root must expose test:design-system');
}
if (!rootPackage.scripts?.verify?.includes('test:design-system')) {
  errors.push('REQ-008, REQ-009: verify must run design-system tests');
}
if (!storybookConfig.includes("'@storybook/addon-a11y'")) {
  errors.push(
    'REQ-007, REQ-008: Storybook must register its accessibility addon',
  );
}
if (!storybookPreview.includes("a11y: { test: 'error' }")) {
  errors.push('REQ-008: Storybook accessibility violations must fail tests');
}
if (!browserTest.includes('new AxeBuilder({ page }).analyze()')) {
  errors.push('REQ-008: workbench browser tests must run axe');
}
if (!browserTest.includes('toHaveScreenshot')) {
  errors.push('REQ-009: workbench browser tests must compare screenshots');
}

await Promise.all(
  [
    'button-states.png',
    'text-field-states.png',
    'select-field-states.png',
    'onboarding-about-you.png',
  ].map((name) =>
    mustExist(`apps/web/design-system-e2e/__screenshots__/${name}`),
  ),
);

if (errors.length > 0) {
  for (const error of errors) console.error(`design system error: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Design system foundation contract is valid.');
}
