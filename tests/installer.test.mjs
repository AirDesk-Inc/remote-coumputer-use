import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'smol-toml';
import { configAddition, jsonConfiguration, defaultSkillsDir, findBinary, install, nativeSetup, packageRoot, skillFiles } from '../lib/installer.mjs';

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
      remoteTerminalEnabled: false, remoteTerminalChanged: false,
      termsAccepted: true, termsRequired: false, termsVersion: '2026-10-28', mcpConfigured: enabled,
      blockedReason: enabled ? '' : 'mcp_disabled' };
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
    return fakeNative([])(_binary, false);
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
  for (const args of [['install', '--binary'], ['install', '--no-such-option'], ['install', '--dry-run', '--dry-run'], ['install', 'constructor', 'ignored']]) {
    const result = spawnSync(process.execPath, [path.join(packageRoot, 'bin/cli.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stderr, /at file:|node:internal/u);
  }
});

test('missing AI terms stops before any installation writes', async t => {
  const options = await fixture(t);
  await assert.rejects(install(options, { nativeSetup: () => ({ ...fakeNative([])(options.binary, false), termsAccepted: false, termsRequired: true }) }), /ai_remote_access_terms_required/u);
  await assert.rejects(fs.stat(options.skillsDir), { code: 'ENOENT' });
  await assert.rejects(fs.stat(options.config), { code: 'ENOENT' });
});

test('native setup preserves only allowlisted recovery errors on nonzero exit', async t => {
  if (process.platform === 'win32') return t.skip('Unix executable fixture; injected preflight is covered on every platform');
  const options = await fixture(t);
  for (const [error, expected] of [['ai_remote_access_terms_required', 'ai_remote_access_terms_required'],
    ['mcp_settings_write_failed', 'mcp_settings_write_failed'], ['PRIVATE_SENTINEL', 'native_setup_failed']]) {
    await fs.writeFile(options.binary, `#!/usr/bin/env node\nconsole.log(JSON.stringify({error:${JSON.stringify(error)}})); process.exitCode=1;\n`, { mode: 0o700 });
    assert.throws(() => nativeSetup(options.binary), new RegExp(`^InstallError: ${expected}$`, 'u'));
  }
  await fs.writeFile(options.binary, '#!/usr/bin/env node\nconsole.log(JSON.stringify({mcpSetupVersion:1,clientMcpOnly:true,mcpServerEnabled:true,remoteTerminalEnabled:false,remoteTerminalChanged:false}));\n', { mode: 0o700 });
  assert.throws(() => nativeSetup(options.binary), /^InstallError: native_app_update_required$/u);
});

test('activation failure exposes bounded partial-install state', async t => {
  const options = await fixture(t);
  await assert.rejects(install(options, { nativeSetup: (_binary, enable) => {
    if (enable) throw new Error('PRIVATE_SENTINEL');
    return fakeNative([])(_binary, false);
  } }), error => error.partialInstall === true && error.installation.skillWritten === true && error.installation.configWritten === true);
});

test('old native MCP ON without terms metadata cannot be auto-enabled or installed', async t => {
  const options = await fixture(t);
  await assert.rejects(install(options, { nativeSetup: () => ({ mcpSetupVersion: 1, clientMcpOnly: true,
    mcpServerEnabled: true, remoteTerminalEnabled: false, remoteTerminalChanged: false }) }), /native_app_update_required/u);
  await assert.rejects(fs.stat(options.skillsDir), { code: 'ENOENT' });
  await assert.rejects(fs.stat(options.config), { code: 'ENOENT' });
  assert.equal((await install({ ...options, skipMcp: true })).skill, 'installed');
});

test('safe Python bytecode cache does not break an unchanged install', async t => {
  const options = await fixture(t);
  const result = await install({ ...options, skipMcp: true });
  const cache = path.join(result.destination, 'scripts', '__pycache__');
  await fs.mkdir(cache);
  await fs.writeFile(path.join(cache, 'airdesk_mcp.cpython-313.pyc'), 'bytecode');
  assert.equal((await install({ ...options, skipMcp: true })).skill, 'unchanged');
  assert.equal(await fs.readFile(path.join(cache, 'airdesk_mcp.cpython-313.pyc'), 'utf8'), 'bytecode');
  await fs.writeFile(path.join(cache, 'notes.txt'), 'user work');
  await assert.rejects(install({ ...options, skipMcp: true, upgrade: true }), /existing_skill_conflict/u);
});

for (const version of ['0.1.0', '0.1.0-git', '0.1.1']) {
  test(`explicit upgrade recognizes official ${version} and retains the complete old directory`, async t => {
    const options = await fixture(t);
    options.skillsDir = path.join(options.root, ...({ '0.1.0': ['.agents', 'skills'],
      '0.1.0-git': ['.claude', 'skills'], '0.1.1': ['custom-discovery'] }[version]));
    const previous = JSON.parse(await fs.readFile(new URL(`./fixtures/releases/${version}.json`, import.meta.url), 'utf8'));
    const destination = path.join(options.skillsDir, 'remote-computer-use');
    for (const [name, data] of Object.entries(previous)) {
      const filename = path.join(destination, name);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, data);
    }
    await assert.rejects(install({ ...options, skipMcp: true }), /skill_upgrade_required/u);
    const plan = await install({ ...options, skipMcp: true, upgrade: true, dryRun: true });
    assert.equal(plan.skill, 'upgrade');
    assert.equal(await fs.readFile(path.join(destination, 'SKILL.md'), 'utf8'), previous['SKILL.md']);
    let staged = false;
    const result = await install({ ...options, skipMcp: true, upgrade: true }, {
      onSkillStaged: async ({ stage, backup }) => {
        staged = true;
        assert.equal(await fs.readFile(path.join(stage, 'SKILL.md'), 'utf8'),
          await fs.readFile(path.join(packageRoot, 'skills/remote-computer-use/SKILL.md'), 'utf8'));
        const discovered = (await fs.readdir(options.skillsDir, { recursive: true }))
          .filter(name => path.basename(name) === 'SKILL.md');
        assert.deepEqual(discovered, [path.join('remote-computer-use', 'SKILL.md')]);
        assert.equal((await fs.stat(stage)).dev, (await fs.stat(destination)).dev);
        assert.equal(path.dirname(stage), path.dirname(backup));
      },
    });
    assert.equal(staged, true);
    assert.equal(result.skill, 'upgraded');
    assert.equal(result.targetVerified, false);
    assert.equal(await fs.readFile(path.join(result.backup, 'SKILL.md'), 'utf8'), previous['SKILL.md']);
    assert.deepEqual((await fs.readdir(options.skillsDir, { recursive: true }))
      .filter(name => path.basename(name) === 'SKILL.md'), [path.join('remote-computer-use', 'SKILL.md')]);
    assert.deepEqual(await fs.readdir(path.dirname(result.backup)), [path.basename(result.backup)]);
    for (const name of skillFiles) assert.deepEqual(await fs.readFile(path.join(destination, name)),
      await fs.readFile(path.join(packageRoot, 'skills/remote-computer-use', name)));
    assert.equal((await install({ ...options, skipMcp: true, upgrade: true })).skill, 'unchanged');
  });
}

test('upgrade refuses even a one-byte customization and preserves it', async t => {
  const options = await fixture(t);
  const previous = JSON.parse(await fs.readFile(new URL('./fixtures/releases/0.1.1.json', import.meta.url), 'utf8'));
  const destination = path.join(options.skillsDir, 'remote-computer-use');
  for (const [name, data] of Object.entries(previous)) {
    const filename = path.join(destination, name); await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, data);
  }
  await fs.appendFile(path.join(destination, 'SKILL.md'), '\nUser note\n');
  await assert.rejects(install({ ...options, skipMcp: true, upgrade: true }), /existing_skill_conflict/u);
  assert((await fs.readFile(path.join(destination, 'SKILL.md'), 'utf8')).endsWith('User note\n'));
});

test('upgrade rechecks the official files after preflight before moving the old directory', async t => {
  const options = await fixture(t);
  const previous = JSON.parse(await fs.readFile(new URL('./fixtures/releases/0.1.1.json', import.meta.url), 'utf8'));
  const destination = path.join(options.skillsDir, 'remote-computer-use');
  for (const [name, data] of Object.entries(previous)) {
    const filename = path.join(destination, name); await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, data);
  }
  await assert.rejects(install({ ...options, upgrade: true }, { nativeSetup: () => {
    appendFileSync(path.join(destination, 'SKILL.md'), '\nConcurrent user note\n');
    return fakeNative([])(options.binary, false);
  } }), /skill_changed_concurrently/u);
  assert((await fs.readFile(path.join(destination, 'SKILL.md'), 'utf8')).endsWith('Concurrent user note\n'));
  assert.deepEqual(await fs.readdir(options.skillsDir), ['remote-computer-use']);
  assert.deepEqual((await fs.readdir(options.root)).filter(name => name.startsWith('.airdesk-skill-upgrade-')), []);
  await assert.rejects(fs.stat(options.config), { code: 'ENOENT' });
});

test('JSON client merge preserves other entries and refuses a conflicting AirDesk entry', () => {
  const original = { theme: 'unchanged', mcpServers: { other: { command: 'other' } } };
  const merged = JSON.parse(jsonConfiguration(JSON.stringify(original), '/trusted/AirDesk'));
  assert.equal(merged.theme, original.theme);
  assert.deepEqual(merged.mcpServers.other, original.mcpServers.other);
  assert.deepEqual(merged.mcpServers.airdesk, { command: '/trusted/AirDesk', args: ['--mcp-server'] });
  assert.throws(() => jsonConfiguration('{"mcpServers":{"airdesk":{"command":"other"}}}', '/AirDesk'), /existing_airdesk_config_conflict/u);
  assert.throws(() => jsonConfiguration('PRIVATE_SENTINEL invalid', '/AirDesk'), /^InstallError: invalid_existing_json$/u);
});

for (const client of ['claude-code', 'claude-desktop', 'generic']) {
  test(`${client} uses only the explicit JSON config and retains its prior contents as a backup`, async t => {
    const options = await fixture(t);
    const config = path.join(options.root, 'selected-client.json');
    const original = '{"mcpServers":{"other":{"command":"preserve"}},"custom":true}\n';
    await fs.writeFile(config, original);
    const result = await install({ ...options, client, config }, { nativeSetup: fakeNative([]) });
    assert.equal(await fs.readFile(result.configBackup, 'utf8'), original);
    const parsed = JSON.parse(await fs.readFile(config, 'utf8'));
    assert.equal(parsed.custom, true); assert.equal(parsed.mcpServers.other.command, 'preserve');
    assert.equal(parsed.mcpServers.airdesk.command, options.binary);
    const before = await fs.readFile(config);
    assert.equal((await install({ ...options, client, config }, { nativeSetup: fakeNative([]) })).skill, 'unchanged');
    assert.deepEqual(await fs.readFile(config), before);
    await assert.rejects(install({ ...options, client, config: undefined }), /config_path_required/u);
  });
}

test('JSON client recreation after the original was moved reports its backup and partial mutation', async t => {
  const options = await fixture(t);
  await install({ ...options, skipMcp: true }); // Keep the skill unchanged to isolate config mutation.
  const config = path.join(options.root, 'selected-client.json');
  const original = '{"mcpServers":{"original":{"command":"preserve"}},"custom":true}\n';
  const recreated = '{"mcpServers":{"concurrent":{"command":"client-recreated"}}}\n';
  await fs.writeFile(config, original);
  const calls = [];
  let retainedBackup;
  await assert.rejects(install({ ...options, client: 'claude-code', config }, {
    nativeSetup: fakeNative(calls),
    beforeConfigPublish: async ({ filename, backup }) => {
      retainedBackup = backup;
      assert.equal(await fs.readFile(backup, 'utf8'), original);
      await fs.writeFile(filename, recreated, { flag: 'wx' });
    },
  }), error => {
    assert.equal(error.code, 'EEXIST');
    assert.equal(error.configMutated, true);
    assert.equal(error.configBackup, retainedBackup);
    assert.equal(error.partialInstall, true);
    assert.equal(error.installation.skillWritten, false);
    assert.equal(error.installation.configWritten, true);
    assert.equal(error.installation.configBackup, retainedBackup);
    return true;
  });
  assert.equal(await fs.readFile(config, 'utf8'), recreated);
  assert.equal(await fs.readFile(retainedBackup, 'utf8'), original);
  assert.deepEqual(calls.map(call => call.enabled), [false]);
  assert.deepEqual((await fs.readdir(options.root)).filter(name => name.includes('airdesk-install')), []);
});

test('CLI dry run never claims target installation or access was checked', async t => {
  const options = await fixture(t);
  const result = spawnSync(process.execPath, [path.join(packageRoot, 'bin/cli.mjs'), 'install', '--skip-mcp', '--dry-run', '--skills-dir', options.skillsDir], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /targetVerified": false/u);
  assert.match(result.stdout, /Target installation, hosting and access approval have not been verified/u);
  assert.doesNotMatch(result.stdout, /Target setup: AirDesk installed and access approved/u);
});

test('Claude Code uses its documented personal skill directory', () => {
  assert.equal(defaultSkillsDir('claude-code', '/fixture'), path.join('/fixture', '.claude', 'skills'));
  assert.equal(defaultSkillsDir('codex', '/fixture'), path.join('/fixture', '.agents', 'skills'));
});
