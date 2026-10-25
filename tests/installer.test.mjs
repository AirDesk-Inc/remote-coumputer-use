import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'smol-toml';
import { configAddition, findBinary, install, packageRoot, skillFiles } from '../lib/installer.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'airdesk-installer-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const binary = path.join(root, 'AirDesk');
  await fs.writeFile(binary, '', { mode: 0o700 });
  return { root, binary, skillsDir: path.join(root, 'skills'), config: path.join(root, 'codex', 'config.toml') };
}

function fakeNative(calls) {
  return (binary, enabled) => {
    calls.push({ binary, enabled });
    return { mcpSetupVersion: 1, clientMcpOnly: true, mcpServerEnabled: enabled,
      remoteTerminalEnabled: false, remoteTerminalChanged: false };
  };
}

test('install copies a complete skill and registers only normal native startup', async t => {
  const options = await fixture(t);
  const calls = [];
  const result = await install(options, { nativeSetup: fakeNative(calls) });
  assert.equal(result.mcp, 'enabled-and-registered');
  assert.equal(result.skill, 'installed');
  for (const name of skillFiles) {
    assert.deepEqual(await fs.readFile(path.join(result.destination, name)),
      await fs.readFile(path.join(packageRoot, 'skills', 'remote-computer-use', name)));
  }
  for (const name of skillFiles.filter(name => name.endsWith('.md'))) {
    const document = path.join(result.destination, name);
    for (const [, target] of (await fs.readFile(document, 'utf8')).matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const reference = new URL(target, pathToFileURL(document));
      if (reference.protocol !== 'file:') continue;
      const filename = fileURLToPath(reference);
      const relative = path.relative(result.destination, filename);
      assert(!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Link escapes the installed skill: ${name}`);
      assert((await fs.stat(filename)).isFile(), `Missing installed reference: ${target}`);
    }
  }
  const config = parse(await fs.readFile(options.config, 'utf8'));
  assert.deepEqual(config.mcp_servers.airdesk.args, ['--mcp-server']);
  assert.equal(config.mcp_servers.airdesk.command, options.binary);
  assert.deepEqual(calls.map(c => c.enabled), [false, true]);
});

test('repeated install is idempotent and does not append duplicate config', async t => {
  const options = await fixture(t);
  const dependencies = { nativeSetup: fakeNative([]) };
  await install(options, dependencies);
  const before = await fs.readFile(options.config);
  assert.equal((await install(options, dependencies)).skill, 'unchanged');
  assert.deepEqual(await fs.readFile(options.config), before);
});

test('preserves comments, unrelated servers and approval settings byte for byte', async t => {
  const options = await fixture(t);
  const original = '# keep me\nmodel = "example"\n[mcp_servers.other]\ncommand = "other"\n';
  await fs.mkdir(path.dirname(options.config));
  await fs.writeFile(options.config, original);
  await install(options, { nativeSetup: fakeNative([]) });
  assert((await fs.readFile(options.config, 'utf8')).startsWith(original));
});

test('conflicting existing skill is never overwritten or remotely activated', async t => {
  const options = await fixture(t);
  const destination = path.join(options.skillsDir, 'remote-computer-use');
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, 'SKILL.md'), 'user changes');
  const calls = [];
  await assert.rejects(install(options, { nativeSetup: fakeNative(calls) }), /existing_skill_conflict/u);
  assert.equal(await fs.readFile(path.join(destination, 'SKILL.md'), 'utf8'), 'user changes');
  assert.equal(calls.length, 0);
});

test('conflicting MCP entry stops before writing or activating', async t => {
  const options = await fixture(t);
  const original = '[mcp_servers.airdesk]\ncommand = "do-not-change"\n';
  await fs.mkdir(path.dirname(options.config));
  await fs.writeFile(options.config, original);
  const calls = [];
  await assert.rejects(install(options, { nativeSetup: fakeNative(calls) }), /existing_airdesk_config_conflict/u);
  assert.equal(await fs.readFile(options.config, 'utf8'), original);
  assert.equal(calls.length, 0);
  await assert.rejects(fs.stat(options.skillsDir), { code: 'ENOENT' });
});

test('dry run neither launches AirDesk nor creates directories', async t => {
  const options = await fixture(t);
  const calls = [];
  assert.equal((await install({ ...options, dryRun: true }, { nativeSetup: fakeNative(calls) })).dryRun, true);
  assert.equal(calls.length, 0);
  await assert.rejects(fs.stat(options.skillsDir), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.dirname(options.config)), { code: 'ENOENT' });
});

test('skill-only mode needs no AirDesk or client configuration', async t => {
  const options = await fixture(t);
  const calls = [];
  const result = await install({ ...options, binary: undefined, skipMcp: true }, { nativeSetup: fakeNative(calls) });
  assert.equal(result.mcp, 'skipped');
  assert.equal(calls.length, 0);
  await assert.rejects(fs.stat(options.config), { code: 'ENOENT' });
});

test('old native app failure does not partially install the skill', async t => {
  const options = await fixture(t);
  await assert.rejects(install(options, { nativeSetup: () => { throw new Error('native_app_update_required'); } }), /native_app_update_required/u);
  await assert.rejects(fs.stat(options.skillsDir), { code: 'ENOENT' });
});

test('native activation failure is not reported as success and can be retried', async t => {
  const options = await fixture(t);
  await assert.rejects(install(options, { nativeSetup: (_binary, enable) => {
    if (enable) throw new Error('activation_failed');
  } }), /activation_failed/u);
  assert.equal((await install(options, { nativeSetup: fakeNative([]) })).mcp, 'enabled-and-registered');
});

test('TOML paths with spaces, Unicode and backslashes round trip', () => {
  for (const binary of ['C:\\Program Files\\AirDesk\\AirDesk.exe', '/Applications/한국어 "name"/AirDesk']) {
    assert.equal(parse(configAddition('', binary)).mcp_servers.airdesk.command, binary);
  }
});

test('invalid, sealed or disabled configurations fail without leaking source text', () => {
  assert.throws(() => configAddition('SECRET_VALUE = [invalid', '/AirDesk'), /^InstallError: invalid_existing_toml$/u);
  assert.throws(() => configAddition('mcp_servers = {}', '/AirDesk'), /config_requires_manual_merge/u);
  assert.throws(() => configAddition('[mcp_servers.airdesk]\ncommand="/AirDesk"\nargs=["--mcp-server"]\nenabled=false', '/AirDesk'), /existing_airdesk_config_conflict/u);
});

test('binary lookup rejects relative paths and wrong filenames', async () => {
  await assert.rejects(findBinary('./AirDesk'), /invalid_binary_path/u);
  await assert.rejects(findBinary('/bin/sh'), /expected_airdesk_executable/u);
  await assert.rejects(findBinary(undefined, 'win32'), /binary_path_required/u);
});

test('CLI help/version work without native startup', async () => {
  const cli = path.join(packageRoot, 'bin', 'cli.mjs');
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--skip-mcp/u);
  const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
  const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(version.stdout.trim(), manifest.version);
});

test('CLI rejects malformed options before installation', () => {
  for (const args of [['install', '--binary'], ['install', '--no-such-option'], ['install', '--dry-run', '--dry-run']]) {
    const result = spawnSync(process.execPath, [path.join(packageRoot, 'bin/cli.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /at file:|node:internal/u);
  }
});
