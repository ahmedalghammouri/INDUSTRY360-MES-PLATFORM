// After `pkg` builds edgegateway.exe, copy the runtime assets that must live
// NEXT TO the exe (not embedded): the Prisma Windows query-engine library, the
// schema, a sample .env, the dashboard, and the service scripts. This produces
// a self-contained `build/` folder ready to drop on a plant PC.
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const build = join(root, 'build');
mkdirSync(build, { recursive: true });

// Prisma query engine (windows) — pkg cannot snapshot the native .node reliably,
// so ship it beside the exe and point PRISMA_QUERY_ENGINE_LIBRARY at it.
const prismaDir = join(root, 'node_modules', '.prisma', 'client');
if (existsSync(prismaDir)) {
  for (const f of readdirSync(prismaDir)) {
    if (f.endsWith('.node') || f.endsWith('.dll')) copyFileSync(join(prismaDir, f), join(build, f));
  }
}

// Schema + dashboard + env template.
const copies = [
  ['prisma/schema.prisma', 'schema.prisma'],
  ['.env.example', '.env'],
];
for (const [src, dst] of copies) {
  const s = join(root, src);
  if (existsSync(s)) copyFileSync(s, join(build, dst));
}
if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), join(build, 'public'), { recursive: true });

// Service scripts.
for (const f of ['install-service.bat', 'uninstall-service.bat', 'README.md']) {
  const s = join(here, '..', 'deploy', f);
  if (existsSync(s)) copyFileSync(s, join(build, f));
}

console.log(`[copy-runtime-assets] runtime files staged in ${build}`);
