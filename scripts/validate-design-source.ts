import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

interface DesignSource {
  schemaVersion?: number;
  provider?: string;
  file?: { name?: string; key?: string; url?: string };
  nodes?: {
    id?: string;
    name?: string;
    kind?: string;
    implementationRole?: string;
    parentId?: string;
    featureSpec?: string;
    claimedScope?: string;
    url?: string;
    verificationMethod?: string;
    width?: number;
    height?: number;
  }[];
}

const root = path.resolve();
const errors: string[] = [];
const expectedFile = {
  name: 'Hansel App UI',
  key: '2zlJi8PzLXCbHqEGQI7Hn5',
  url: 'https://www.figma.com/design/2zlJi8PzLXCbHqEGQI7Hn5/Hansel-App-UI',
};

let source: DesignSource = {};
try {
  source = JSON.parse(
    await readFile(path.join(root, 'design/figma.json'), 'utf8'),
  ) as DesignSource;
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  errors.push(
    `REQ-010: design/figma.json must exist and contain valid JSON (${reason})`,
  );
}

if (source.schemaVersion !== 1) {
  errors.push('REQ-010: design registry schemaVersion must be 1');
}
if (source.provider !== 'figma') {
  errors.push('REQ-001: design registry provider must be figma');
}
for (const [field, expected] of Object.entries(expectedFile)) {
  if (source.file?.[field as keyof typeof expectedFile] !== expected) {
    errors.push(`REQ-001: canonical Figma file ${field} must be "${expected}"`);
  }
}

const expectedNodes = [
  {
    id: '0:1',
    name: 'Cover',
    kind: 'page',
    implementationRole: 'reference-only',
  },
  {
    id: '48:25',
    name: 'Cover',
    kind: 'frame',
    implementationRole: 'reference-only',
    parentId: '0:1',
  },
  {
    id: '1:2',
    name: 'Onboarding',
    kind: 'page',
    implementationRole: 'visual-reference',
    claimedScope: 'onboarding',
    verificationMethod: 'authenticated-browser',
    url: 'https://www.figma.com/design/2zlJi8PzLXCbHqEGQI7Hn5/Hansel-App-UI?node-id=1-2',
  },
  {
    id: '131:548',
    name: 'Emails',
    kind: 'page',
    implementationRole: 'visual-reference',
    claimedScope: 'emails',
    verificationMethod: 'authenticated-browser',
    url: 'https://www.figma.com/design/2zlJi8PzLXCbHqEGQI7Hn5/Hansel-App-UI?node-id=131-548',
  },
  {
    id: '40:502',
    name: 'Dashboard',
    kind: 'page',
    implementationRole: 'visual-reference',
    claimedScope: 'dashboard',
    verificationMethod: 'authenticated-browser',
    url: 'https://www.figma.com/design/2zlJi8PzLXCbHqEGQI7Hn5/Hansel-App-UI?node-id=40-502',
  },
  {
    id: '1:3',
    name: 'Onboarding > New user / New organization > Step 1',
    kind: 'frame',
    implementationRole: 'visual-reference',
    parentId: '1:2',
    verificationMethod: 'authenticated-browser',
    width: 1728,
    height: 1117,
    url: 'https://www.figma.com/design/2zlJi8PzLXCbHqEGQI7Hn5/Hansel-App-UI?node-id=1-3',
  },
  {
    id: '131:549',
    name: 'Welcome',
    kind: 'frame',
    implementationRole: 'visual-reference',
    parentId: '131:548',
    verificationMethod: 'authenticated-browser',
    width: 800,
    height: 1061.05,
    url: 'https://www.figma.com/design/2zlJi8PzLXCbHqEGQI7Hn5/Hansel-App-UI?node-id=131-549',
  },
  {
    id: '2019:2296',
    name: '0.0 Dashboard',
    kind: 'frame',
    implementationRole: 'visual-reference',
    parentId: '40:502',
    verificationMethod: 'authenticated-browser',
    width: 1512,
    height: 982,
    url: 'https://www.figma.com/design/2zlJi8PzLXCbHqEGQI7Hn5/Hansel-App-UI?node-id=2019-2296',
  },
];

if (
  source.nodes?.length !== expectedNodes.length ||
  expectedNodes.some((expected) => {
    const actual = source.nodes?.find((node) => node.id === expected.id);
    return Object.entries(expected).some(
      ([field, value]) =>
        actual?.[field as keyof (typeof source.nodes)[number]] !== value,
    );
  })
) {
  errors.push(
    'REQ-011, REQ-012: registered nodes must match the verified cover nodes and browser-verified onboarding, email, and dashboard references',
  );
}

for (const node of source.nodes ?? []) {
  if (node.implementationRole !== 'application-screen') continue;
  if (!node.featureSpec) {
    errors.push(
      `REQ-003: application-screen node ${node.id ?? '<missing id>'} must name its feature specification`,
    );
    continue;
  }
  try {
    const featureSpec = await readFile(
      path.join(root, node.featureSpec),
      'utf8',
    );
    if (!featureSpec.includes('- Status: `approved`')) {
      errors.push(
        `REQ-003: ${node.featureSpec} must be approved before node ${node.id ?? '<missing id>'} is implemented`,
      );
    }
    if (!featureSpec.includes(`Figma node: \`${node.id ?? '<missing id>'}\``)) {
      errors.push(
        `REQ-003: ${node.featureSpec} must cite Figma node ${node.id ?? '<missing id>'}`,
      );
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(
      `REQ-003: feature specification ${node.featureSpec} is not readable (${reason})`,
    );
  }
}

async function sourceFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(
      `REQ-010: cannot inspect ${path.relative(root, directory)} (${reason})`,
    );
    return [];
  }
  const nested = await Promise.all(
    entries
      .filter(
        (entry) =>
          !['node_modules', 'dist', 'coverage', 'test-results'].includes(
            entry.name,
          ),
      )
      .map((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory()
          ? sourceFiles(entryPath)
          : Promise.resolve([entryPath]);
      }),
  );
  return nested.flat();
}

const browserSourceExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.svg',
  '.ts',
  '.tsx',
]);
for (const file of await sourceFiles(path.join(root, 'apps/web'))) {
  if (!browserSourceExtensions.has(path.extname(file))) continue;
  const content = await readFile(file, 'utf8');
  if (content.includes('figma.com/api/mcp/asset/')) {
    errors.push(
      `REQ-002, REQ-006: ${path.relative(root, file)} contains an expiring Figma connector asset URL`,
    );
  }
  if (/FIGMA_(?:ACCESS_)?TOKEN\s*=|figd_[A-Za-z0-9_-]+/.test(content)) {
    errors.push(
      `REQ-002: ${path.relative(root, file)} contains a Figma credential or access token`,
    );
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`design source error: ${error}`);
  process.exitCode = 1;
} else {
  console.log('Figma design source contract is valid.');
}
