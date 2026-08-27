import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const requiredSections = [
  'Problem',
  'Outcome and success metrics',
  'Non-goals',
  'Requirements',
  'Acceptance scenarios',
  'UX and accessibility',
  'API and integrations',
  'Data and migration',
  'Security and privacy',
  'Reliability and observability',
  'Test strategy',
  'Rollout and rollback',
  'Open questions',
];

async function validateFeatureSpecs(): Promise<string[]> {
  const root = path.resolve('specs/features');
  const entries = await readdir(root, { withFileTypes: true });
  const errors: string[] = [];

  for (const entry of entries.filter((item) => item.isDirectory())) {
    const specPath = path.join(root, entry.name, 'spec.md');
    let content: string;
    try {
      content = await readFile(specPath, 'utf8');
    } catch {
      errors.push(`${entry.name}: missing spec.md`);
      continue;
    }

    if (!content.includes(`- ID: \`${entry.name}\``))
      errors.push(`${entry.name}: ID must match its directory`);
    if (!/- Status: `(draft|approved|implemented|retired)`/.test(content))
      errors.push(`${entry.name}: invalid or missing Status`);
    for (const section of requiredSections) {
      if (!content.includes(`## ${section}`))
        errors.push(`${entry.name}: missing section "${section}"`);
    }
    const requirementIds = new Set(content.match(/REQ-\d{3}/g) ?? []);
    if (requirementIds.size === 0)
      errors.push(`${entry.name}: at least one REQ-### is required`);
    if (!/### AC-\d{3}[^\n]*\[REQ-\d{3}/.test(content))
      errors.push(`${entry.name}: acceptance criteria must cite a requirement`);
  }
  return errors;
}

async function validateOpenApi(): Promise<string[]> {
  const document = parse(
    await readFile(path.resolve('specs/openapi.yaml'), 'utf8'),
  ) as Record<string, unknown>;
  return document.openapi === '3.1.0' && typeof document.paths === 'object'
    ? []
    : ['openapi.yaml: expected OpenAPI 3.1 with paths'];
}

const errors = [
  ...(await validateFeatureSpecs()),
  ...(await validateOpenApi()),
];
if (errors.length > 0) {
  for (const error of errors) console.error(`spec error: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Specifications are valid.');
}
