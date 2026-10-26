import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
const out = 'node_modules/.cache/unit';
rmSync(out, { recursive: true, force: true });
const compiled = spawnSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '-p', 'checks/unit/tsconfig.json'],
  { stdio: 'inherit' },
);
if (compiled.status !== 0) process.exit(compiled.status ?? 1);
const tests = readdirSync(`${out}/checks/unit`)
  .filter((f) => f.endsWith('.check.js'))
  .map((f) => resolve(`${out}/checks/unit/${f}`));
const result = spawnSync(process.execPath, ['--test', ...tests], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
