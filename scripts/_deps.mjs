// Resolve native deps (@napi-rs/canvas, viem) without copying scripts into api/.
// Looks in this checkout first, then walks up ancestor directories (so a checkout
// nested under the main one finds the main checkout's node_modules).
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function requireDep(name, subdirs) {
  let dir = ROOT;
  for (;;) {
    for (const sub of subdirs) {
      const base = join(dir, sub);
      if (existsSync(join(base, 'node_modules', name))) return createRequire(join(base, '/'))(name);
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error(`Cannot find ${name}; run npm install in api/ (canvas) or preview/remaster/ (viem)`);
}

export const canvasLib = () => requireDep('@napi-rs/canvas', ['api', '.']);
export const viemLib = () => requireDep('viem', ['preview/remaster', 'contracts', '.']);
