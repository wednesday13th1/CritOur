import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';

const build = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
  stdio: 'inherit',
  env: { ...process.env, CRITOUR_DEPLOY_NOW: '1' },
});
if (build.status !== 0) process.exit(build.status ?? 1);

cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
