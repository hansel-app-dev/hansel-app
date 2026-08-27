import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const root = process.cwd();

async function text(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8');
}

function expectEqual(
  errors: string[],
  requirement: string,
  actual: string,
  expected: string,
  subject: string,
): void {
  if (actual.trim() !== expected) {
    errors.push(
      `${requirement}: ${subject} must be "${expected}", received "${actual.trim()}"`,
    );
  }
}

async function validatePackageContract(errors: string[]): Promise<void> {
  const packageJson = JSON.parse(await text('package.json')) as {
    engines?: { node?: string };
    devDependencies?: { '@types/node'?: string };
  };
  expectEqual(
    errors,
    'REQ-001',
    packageJson.engines?.node ?? '',
    '>=24 <25',
    'package engine',
  );
  expectEqual(
    errors,
    'REQ-006',
    packageJson.devDependencies?.['@types/node'] ?? '',
    '^24.0.0',
    'root Node type declaration',
  );
  if (!(await text('.npmrc')).split(/\r?\n/).includes('engine-strict=true')) {
    errors.push('REQ-001: .npmrc must enforce engine-strict=true');
  }
}

async function validateLocalSelectors(errors: string[]): Promise<void> {
  for (const selector of ['.nvmrc', '.node-version']) {
    expectEqual(errors, 'REQ-004', await text(selector), '24', selector);
  }
  if (!(await text('README.md')).includes('Requirements: Node.js 24 LTS')) {
    errors.push(
      'REQ-005: README must identify Node.js 24 LTS as a requirement',
    );
  }
}

async function validateWorkflows(errors: string[]): Promise<void> {
  const workflowDirectory = '.github/workflows';
  const workflows = (await readdir(path.join(root, workflowDirectory))).filter(
    (file) => /\.ya?ml$/.test(file),
  );

  for (const file of workflows) {
    const workflow = `${workflowDirectory}/${file}`;
    const document = parse(await text(workflow)) as {
      jobs?: Record<
        string,
        {
          steps?: {
            run?: string;
            uses?: string;
            with?: { 'node-version'?: number | string };
          }[];
        }
      >;
    };
    for (const [jobName, job] of Object.entries(document.jobs ?? {})) {
      const steps = job.steps ?? [];
      const executesDependencies = steps.some(
        (step) =>
          typeof step.run === 'string' &&
          /(^|\s)(node|npx|pnpm)(\s|$)/m.test(step.run),
      );
      const nodeSetups = steps.filter((step) =>
        step.uses?.startsWith('actions/setup-node@'),
      );
      if (
        nodeSetups.some(
          (step) => String(step.with?.['node-version'] ?? '') !== '24',
        )
      ) {
        errors.push(
          `REQ-002: every Node setup in ${workflow} job ${jobName} must use major 24`,
        );
      }
      if (
        executesDependencies &&
        !nodeSetups.some(
          (step) => String(step.with?.['node-version'] ?? '') === '24',
        )
      ) {
        errors.push(
          `REQ-002: dependency-running job ${jobName} in ${workflow} must configure Node 24`,
        );
      }
    }
  }
}

async function validateDocker(errors: string[]): Promise<void> {
  const dockerfile = await text('apps/api/Dockerfile');
  const baseImages = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map(
    (match) => match[1],
  );
  if (
    baseImages.length !== 2 ||
    baseImages.some((image) => image !== 'node:24-alpine')
  ) {
    errors.push('REQ-003: both API Docker stages must use node:24-alpine');
  }
}

async function validateNodeTypes(errors: string[]): Promise<void> {
  for (const packagePath of [
    'apps/api/package.json',
    'apps/web/package.json',
    'infra/package.json',
  ]) {
    const packageJson = JSON.parse(await text(packagePath)) as {
      devDependencies?: { '@types/node'?: string };
    };
    expectEqual(
      errors,
      'REQ-006',
      packageJson.devDependencies?.['@types/node'] ?? '',
      '^24.0.0',
      `${packagePath} Node type declaration`,
    );
  }
}

async function validateProhibitedMajors(errors: string[]): Promise<void> {
  const activeFiles = [
    'package.json',
    '.nvmrc',
    '.node-version',
    'apps/api/Dockerfile',
    '.github/workflows/ci.yml',
    '.github/workflows/deploy.yml',
  ];
  for (const file of activeFiles) {
    const content = await text(file);
    if (/node(?::|-version["']?\s*:?)\s*2[26]\b|>=2[26]\s*</i.test(content)) {
      errors.push(
        `REQ-007: ${file} contains a prohibited Node 22 or Node 26 runtime declaration`,
      );
    }
  }
}

const errors: string[] = [];
await validatePackageContract(errors);
await validateLocalSelectors(errors);
await validateWorkflows(errors);
await validateDocker(errors);
await validateNodeTypes(errors);
await validateProhibitedMajors(errors);

if (errors.length > 0) {
  for (const error of errors) console.error(`runtime error: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Node 24 runtime contract is valid.');
}
