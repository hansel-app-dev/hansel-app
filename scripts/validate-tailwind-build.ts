import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const assetsDirectory = path.resolve('dist/assets');
const assetNames = await readdir(assetsDirectory);
const cssNames = assetNames.filter((name) => name.endsWith('.css'));

if (cssNames.length === 0) {
  throw new Error(
    'REQ-001: Tailwind build validation failed: no CSS asset was emitted',
  );
}

const stylesheets = await Promise.all(
  cssNames.map((name) => readFile(path.join(assetsDirectory, name), 'utf8')),
);

if (!stylesheets.some((css) => css.includes('.min-h-screen'))) {
  throw new Error(
    'REQ-001: Tailwind build validation failed: representative utility .min-h-screen was not emitted',
  );
}

console.log('Tailwind production CSS is valid.');
