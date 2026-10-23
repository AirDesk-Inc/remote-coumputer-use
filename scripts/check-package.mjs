import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { packageRoot, skillFiles } from '../lib/installer.mjs';

assert(process.env.npm_execpath, 'Run with npm run check:package');
const tests = spawnSync(process.execPath, ['--test', 'tests/installer.test.mjs'], { cwd: packageRoot, stdio: 'inherit' });
assert.equal(tests.status, 0, 'Installer tests failed');
const packed = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--dry-run', '--json', '--ignore-scripts'],
  { cwd: packageRoot, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
assert.equal(packed.status, 0, 'npm pack failed');
const [manifest] = JSON.parse(packed.stdout);
const files = new Set(manifest.files.map(file => file.path));
for (const name of ['package.json', 'LICENSE', 'bin/cli.mjs', 'lib/installer.mjs', 'README.md',
  'TRADEMARKS.md', ...skillFiles.map(name => `skills/remote-computer-use/${name}`)]) assert(files.has(name), `Missing ${name}`);
for (const name of files) {
  assert(!/(^|\/)(node_modules|tests|\.git|__pycache__|\.env|\.npmrc|private)(\/|$)/u.test(name), `Unexpected ${name}`);
  assert(!/\.(pyc|log|pem|key|tgz)$/u.test(name), `Unexpected ${name}`);
}
assert(manifest.unpackedSize < 512 * 1024, 'Unexpected package size');
console.log(`Package check passed: ${files.size} files, ${manifest.unpackedSize} bytes unpacked. No publication performed.`);
