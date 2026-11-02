// Locates esbuild/typescript. Normally they live in ./node_modules (after `npm install`).
// Set M32_TOOLCHAIN to another folder with node_modules to keep them out of a synced
// drive (e.g. Google Drive), which is slow with thousands of small files.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export function toolchain() {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidates = [process.env.M32_TOOLCHAIN, ROOT].filter(Boolean);
  for (const dir of candidates) {
    const nm = path.join(dir, 'node_modules');
    if (fs.existsSync(path.join(nm, 'esbuild'))) {
      const req = createRequire(path.join(dir, 'package.json'));
      return { ROOT, TOOL: dir, req, esbuild: req('esbuild'), nodePaths: [nm] };
    }
  }
  throw new Error(
    'esbuild not found. Run `npm install` in the project folder, ' +
      'or set M32_TOOLCHAIN to a folder whose node_modules has the dependencies.'
  );
}
