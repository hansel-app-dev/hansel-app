import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve();

async function read(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8');
}

const packageJson = JSON.parse(await read('apps/web/package.json')) as Record<
  string,
  Record<string, string>
>;
const viteConfig = await read('apps/web/vite.config.ts');
const stylesheet = await read('apps/web/src/styles.css');
const app = await read('apps/web/src/App.tsx');
const errors: string[] = [];

if (!packageJson.devDependencies?.tailwindcss?.startsWith('^4.')) {
  errors.push(
    'REQ-001: apps/web must declare Tailwind CSS 4 as a development dependency',
  );
}
if (!packageJson.devDependencies?.['@tailwindcss/vite']?.startsWith('^4.')) {
  errors.push(
    'REQ-002: apps/web must declare the Tailwind CSS Vite integration',
  );
}
if (!viteConfig.includes("import tailwindcss from '@tailwindcss/vite'")) {
  errors.push('REQ-002: Vite config must import @tailwindcss/vite');
}
if (!/plugins:\s*\[react\(\),\s*tailwindcss\(\)\]/.test(viteConfig)) {
  errors.push('REQ-002: Vite config must register the Tailwind plugin');
}
if (!stylesheet.includes("@import 'tailwindcss';")) {
  errors.push('REQ-002: the frontend stylesheet must import Tailwind CSS');
}
if (!app.includes('min-h-screen')) {
  errors.push(
    'REQ-003: React components must use representative Tailwind utilities',
  );
}

if (errors.length > 0) {
  for (const error of errors)
    console.error(`tailwind contract error: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Tailwind CSS frontend contract is valid.');
}
