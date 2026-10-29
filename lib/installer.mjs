import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'smol-toml';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const skillName = 'remote-computer-use';
export function defaultSkillsDir(client = 'codex', home = os.homedir()) {
  return path.join(home, client === 'claude-code' ? '.claude' : '.agents', 'skills');
}
export const skillFiles = [
  'SKILL.md', 'LICENSE.txt', 'agents/openai.yaml', 'assets/NOTICE.md',
  'assets/airdesk-symbol.svg', 'assets/airdesk-lockup.svg',
  'references/setup.md', 'references/screen-control.md', 'references/terminal.md',
  'references/windows-automation.md', 'references/browser-control.md', 'scripts/airdesk_mcp.py',
];

export class InstallError extends Error {
  constructor(code) { super(code); this.name = 'InstallError'; }
}

const clients = new Set(['codex', 'claude-code', 'claude-desktop', 'generic']);
const nativeErrors = new Set(['ai_remote_access_terms_required', 'mcp_settings_write_failed', 'policy_unavailable']);
const releaseManifest = JSON.parse(await fs.readFile(new URL('./skill-releases.json', import.meta.url), 'utf8'));
const packageVersion = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const sha256 = data => createHash('sha256').update(data).digest('hex');
function requireConsentStatus(status) {
  if (!status || typeof status.termsAccepted !== 'boolean' || typeof status.termsRequired !== 'boolean' ||
      typeof status.termsVersion !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(status.termsVersion))
    throw new InstallError('native_app_update_required');
  if (status.blockedReason === 'policy_unavailable') throw new InstallError('policy_unavailable');
  if (status.termsRequired || !status.termsAccepted || status.blockedReason === 'ai_remote_access_terms_required')
    throw new InstallError('ai_remote_access_terms_required');
}
function matchesRelease(files, release) {
  return files.size === Object.keys(release.files).length &&
    [...files].every(([name, data]) => release.files[name] === sha256(data));
}

async function statOrNull(filename) {
  try { return await fs.lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function findBinary(value, platform = process.platform) {
  if (!value && platform !== 'darwin') throw new InstallError('binary_path_required');
  let filename = value || '/Applications/AirDesk.app/Contents/MacOS/AirDesk';
  if (!path.isAbsolute(filename) || /[\x00-\x1f\x7f]/u.test(filename)) throw new InstallError('invalid_binary_path');
  if (path.basename(filename) === 'AirDesk.app') filename = path.join(filename, 'Contents', 'MacOS', 'AirDesk');
  if (!['AirDesk', 'AirDesk.exe'].includes(path.basename(filename))) throw new InstallError('expected_airdesk_executable');
  const info = await fs.stat(filename).catch(() => null);
  if (!info?.isFile()) throw new InstallError('airdesk_not_found');
  if (platform !== 'win32') await fs.access(filename, constants.X_OK).catch(() => { throw new InstallError('airdesk_not_executable'); });
  return filename;
}

export function nativeSetup(binary, enable = false) {
  // --mcp-server keeps older apps in stdio mode, never launching a GUI for an unknown setup flag.
  const args = ['--mcp-server', '--mcp-setup', ...(enable ? ['--enable-mcp'] : [])];
  const env = { ...process.env };
  for (const key of ['REPC_STATE_DIR', 'REPC_MCP_AUTH_TOKEN', 'REPC_BACKEND_URL',
    'AIRDESK_STATE_DIR', 'AIRDESK_MCP_AUTH_TOKEN', 'AIRDESK_BACKEND_URL']) delete env[key];
  const result = spawnSync(binary, args, {
    input: '', encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
    stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, shell: false, env,
  });
  let status;
  try { status = JSON.parse(result.stdout); }
  catch { throw new InstallError(result.error || result.status !== 0 ? 'native_setup_failed' : 'native_app_update_required'); }
  // Preserve only known recovery codes, never arbitrary native stdout/stderr.
  if (nativeErrors.has(status?.error)) throw new InstallError(status.error);
  if (result.error || result.status !== 0) throw new InstallError('native_setup_failed');
  if (status?.mcpSetupVersion !== 1 || status.clientMcpOnly !== true ||
      typeof status.mcpServerEnabled !== 'boolean' || typeof status.remoteTerminalEnabled !== 'boolean' ||
      status.remoteTerminalChanged !== false) throw new InstallError('native_app_update_required');
  for (const name of ['termsAccepted', 'termsRequired', 'mcpConfigured']) {
    if (name in status && typeof status[name] !== 'boolean') throw new InstallError('native_app_update_required');
  }
  requireConsentStatus(status);
  if (enable && !status.mcpServerEnabled) throw new InstallError('native_mcp_not_enabled');
  return status;
}

export function configAddition(original, binary) {
  if (Buffer.byteLength(original) > 1024 * 1024) throw new InstallError('config_too_large');
  let config;
  try { config = parse(original); }
  catch { throw new InstallError('invalid_existing_toml'); }
  const existing = config.mcp_servers?.airdesk;
  if (existing !== undefined) {
    if (existing?.command === binary && JSON.stringify(existing.args) === '["--mcp-server"]' &&
        existing.enabled !== false && !existing.env && !existing.env_vars?.length && !existing.url) return '';
    throw new InstallError('existing_airdesk_config_conflict');
  }
  const addition = '\n\n[mcp_servers.airdesk]\n' +
    `command = ${JSON.stringify(binary)}\nargs = ["--mcp-server"]\n` +
    'startup_timeout_sec = 20\ntool_timeout_sec = 60\n';
  try { parse(original + addition); }
  catch { throw new InstallError('config_requires_manual_merge'); }
  return addition;
}

export function jsonConfiguration(original, binary) {
  if (Buffer.byteLength(original) > 1024 * 1024) throw new InstallError('config_too_large');
  let config;
  try { config = original.trim() ? JSON.parse(original) : {}; }
  catch { throw new InstallError('invalid_existing_json'); }
  if (!config || typeof config !== 'object' || Array.isArray(config) ||
      (config.mcpServers !== undefined && (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers))))
    throw new InstallError('invalid_existing_json');
  const existing = config.mcpServers?.airdesk;
  if (existing !== undefined) {
    if (existing?.command === binary && JSON.stringify(existing.args) === '["--mcp-server"]' &&
        (!existing.type || existing.type === 'stdio') && existing.disabled !== true && existing.enabled !== false &&
        !existing.env && !existing.url) return original;
    throw new InstallError('existing_airdesk_config_conflict');
  }
  config.mcpServers = { ...config.mcpServers, airdesk: { command: binary, args: ['--mcp-server'] } };
  return JSON.stringify(config, null, 2) + '\n';
}

async function readConfig(filename) {
  const info = await statOrNull(filename);
  if (!info) return '';
  if (!info.isFile() || info.isSymbolicLink()) throw new InstallError('config_not_regular_file');
  if (info.size > 1024 * 1024) throw new InstallError('config_too_large');
  return fs.readFile(filename, 'utf8');
}

async function registerConfig(filename, binary, client, hooks = {}) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const lock = `${filename}.airdesk-install.lock`;
  await fs.mkdir(lock).catch(() => { throw new InstallError('config_busy'); });
  try {
    const original = await readConfig(filename);
    if (client !== 'codex') {
      const replacement = jsonConfiguration(original, binary);
      if (replacement === original) return { status: 'unchanged' };
      const temporary = `${filename}.airdesk-install-${randomUUID()}`;
      const backup = await statOrNull(filename) ? `${filename}.airdesk-backup-${randomUUID()}` : null;
      await fs.writeFile(temporary, replacement, { flag: 'wx', mode: 0o600 });
      let moved = false;
      try {
        if ((await readConfig(filename)) !== original) throw new InstallError('config_changed_concurrently_review_required');
        if (backup) {
          await fs.rename(filename, backup); moved = true;
          if ((await fs.readFile(backup, 'utf8')) !== original) throw new InstallError('config_changed_concurrently_review_required');
        }
        await hooks.beforeConfigPublish?.({ filename, backup });
        // A hard link publishes a complete file exclusively; never replaces a
        // configuration another process created after our read.
        await fs.link(temporary, filename);
      } catch (error) {
        if (moved) await fs.link(backup, filename).catch(() => {});
        // The client may have recreated filename, preventing restoration. Keep
        // its new file and disclose the retained original even when publishing
        // failed before registerConfig could return its normal result.
        if (moved) { error.configBackup = backup; error.configMutated = true; }
        throw error;
      } finally { await fs.unlink(temporary).catch(() => {}); }
      return { status: 'registered', backup };
    }
    const addition = configAddition(original, binary);
    if (!addition) return { status: 'unchanged' };
    // Append, never reserialize the user's configuration or remove comments/settings.
    await fs.appendFile(filename, addition, { mode: 0o600 });
    try { parse(await readConfig(filename)); }
    catch {
      const error = new InstallError('config_changed_concurrently_review_required');
      error.configMutated = true;
      throw error;
    }
    return { status: 'registered' };
  } finally { await fs.rmdir(lock); }
}

async function readTree(directory, prefix = '') {
  const result = new Map();
  for (const entry of await fs.readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new InstallError('skill_contains_symlink');
    if (entry.isDirectory()) {
      for (const [name, data] of await readTree(directory, relative)) result.set(name, data);
    } else if (entry.isFile()) {
      // Python's bytecode is not distributed skill content. Ignore only real
      // .pyc files below __pycache__; other extra files remain conflicts.
      if (relative.split('/').includes('__pycache__') && entry.name.endsWith('.pyc')) continue;
      const filename = path.join(directory, relative);
      if ((await fs.stat(filename)).size > 512 * 1024) throw new InstallError('existing_skill_conflict');
      result.set(relative, await fs.readFile(filename));
    }
    else throw new InstallError('skill_contains_special_file');
  }
  return result;
}

async function planSkill(skillsDir, source, upgrade) {
  const destination = path.join(skillsDir, skillName);
  const files = new Map();
  for (const name of skillFiles) {
    const filename = path.join(source, name);
    const info = await fs.lstat(filename);
    if (!info.isFile() || info.isSymbolicLink()) throw new InstallError('invalid_bundled_skill');
    files.set(name, await fs.readFile(filename));
  }
  const existing = await statOrNull(destination);
  if (!existing) return { destination, files, status: 'install' };
  if (!existing.isDirectory() || existing.isSymbolicLink()) throw new InstallError('existing_skill_conflict');
  const actual = await readTree(destination);
  if (actual.size !== files.size || [...files].some(([name, data]) => !actual.get(name)?.equals(data))) {
    const release = releaseManifest.releases.find(candidate => matchesRelease(actual, candidate));
    if (!release) throw new InstallError('existing_skill_conflict');
    if (!upgrade) throw new InstallError('skill_upgrade_required');
    return { destination, files, status: 'upgrade', release };
  }
  return { destination, files, status: 'unchanged' };
}

function isWithin(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function createUpgradeWorkspace(destination) {
  const skillsDir = await fs.realpath(path.dirname(destination));
  // Keep every SKILL.md in staging/backups outside discovery roots, including
  // custom roots and a custom root nested inside a standard client root.
  const roots = await Promise.all([skillsDir, defaultSkillsDir('codex'), defaultSkillsDir('claude-code')]
    .map(directory => fs.realpath(directory).catch(() => path.resolve(directory))));
  let parent = path.dirname(skillsDir);
  while (roots.some(root => isWithin(root, parent))) {
    const next = path.dirname(parent);
    if (next === parent) throw new InstallError('skill_upgrade_storage_unavailable');
    parent = next;
  }
  const workspace = await fs.mkdtemp(path.join(parent, '.airdesk-skill-upgrade-'));
  try {
    if ((await fs.stat(workspace)).dev !== (await fs.stat(destination)).dev)
      throw new InstallError('skill_upgrade_storage_volume_mismatch');
    return workspace;
  } catch (error) {
    await fs.rmdir(workspace).catch(() => {});
    throw error;
  }
}

async function upgradeSkill(plan, hooks) {
  const lock = `${plan.destination}.airdesk-upgrade.lock`;
  await fs.mkdir(lock).catch(() => { throw new InstallError('skill_busy'); });
  let workspace, stage, backup;
  let moved = false;
  try {
    workspace = await createUpgradeWorkspace(plan.destination);
    backup = path.join(workspace, `${skillName}.backup-${plan.release.version}`);
    stage = path.join(workspace, 'staging');
    await fs.mkdir(stage, { mode: 0o700 });
    // Fill a private staging directory before any visible skill is moved.
    for (const [name, data] of plan.files) {
      const filename = path.join(stage, name);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, data, { flag: 'wx' });
    }
    await hooks.onSkillStaged?.({ destination: plan.destination, stage, backup });
    if (!matchesRelease(await readTree(plan.destination), plan.release)) throw new InstallError('skill_changed_concurrently');
    await fs.rename(plan.destination, backup); moved = true;
    if (!matchesRelease(await readTree(backup), plan.release)) throw new InstallError('skill_changed_concurrently');
    if (await statOrNull(plan.destination)) throw new InstallError('skill_changed_concurrently');
    await fs.rename(stage, plan.destination); // Publish the complete new tree.
    return backup;
  } catch (error) {
    if (moved && !(await statOrNull(plan.destination))) await fs.rename(backup, plan.destination).catch(() => {});
    if (moved && await statOrNull(backup)) error.recoveryBackup = backup;
    throw error;
  } finally {
    if (stage) await fs.rm(stage, { recursive: true, force: true });
    if (workspace) await fs.rmdir(workspace).catch(() => {}); // A retained backup keeps its private workspace.
    await fs.rmdir(lock);
  }
}

async function copySkill(plan, hooks) {
  if (plan.status === 'unchanged') return;
  if (plan.status === 'upgrade') return upgradeSkill(plan, hooks);
  await fs.mkdir(path.dirname(plan.destination), { recursive: true });
  const lock = `${plan.destination}.airdesk-upgrade.lock`;
  await fs.mkdir(lock).catch(() => { throw new InstallError('skill_busy'); });
  const copied = [];
  const directories = new Set();
  try {
    await fs.mkdir(plan.destination); // Exclusive reservation: never overwrite an existing skill.
    directories.add(plan.destination);
    // Publish the entrypoint last so a client does not discover a half-copied skill.
    for (const [name, data] of [...plan.files].sort(([a], [b]) => Number(a === 'SKILL.md') - Number(b === 'SKILL.md'))) {
      const filename = path.join(plan.destination, name);
      const directory = path.dirname(filename);
      await fs.mkdir(directory, { recursive: true });
      directories.add(directory);
      await fs.writeFile(filename, data, { flag: 'wx' });
      copied.push(filename);
    }
  } catch (error) {
    for (const filename of copied.reverse()) await fs.unlink(filename).catch(() => {});
    // Remove only empty directories we created, never recursively delete user data.
    for (const directory of [...directories].sort((a, b) => b.length - a.length)) await fs.rmdir(directory).catch(() => {});
    throw error;
  } finally { await fs.rmdir(lock); }
}

export async function install(options = {}, dependencies = {}) {
  const client = options.client || 'codex';
  if (!clients.has(client)) throw new InstallError('unsupported_client');
  if (!options.skipMcp && client !== 'codex' && !options.config) throw new InstallError('config_path_required');
  const skillsDir = path.resolve(options.skillsDir || defaultSkillsDir(client));
  const configPath = path.resolve(options.config || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml'));
  const source = path.join(packageRoot, 'skills', skillName);
  const plan = await planSkill(skillsDir, source, options.upgrade === true);
  const setup = dependencies.nativeSetup || nativeSetup;
  const binary = options.skipMcp ? null : await findBinary(options.binary);
  if (binary) (client === 'codex' ? configAddition : jsonConfiguration)(await readConfig(configPath), binary);
  const common = { destination: plan.destination, client, targetVerified: false, bundledVersion: packageVersion,
    skillDiscovery: client === 'claude-desktop' ? 'manual-import' : client === 'generic' ? 'client-specific' : 'filesystem' };
  if (options.dryRun) return { ...common, skill: plan.status, installedVersion: plan.release?.version,
    mcp: binary ? 'planned' : 'skipped', dryRun: true };
  if (binary) {
    const preflight = setup(binary, false); // Before any installation writes.
    requireConsentStatus(preflight);
  }
  let skillWritten = false, configWritten = false, skillBackup, configBackup;
  try {
    skillBackup = await copySkill(plan, dependencies);
    skillWritten = plan.status !== 'unchanged';
    let mcp = 'skipped';
    if (binary) {
      const config = await registerConfig(configPath, binary, client, dependencies);
      configWritten = config.status === 'registered'; configBackup = config.backup;
      setup(binary, true); // Explicit install only; never a recurring startup flag.
      mcp = 'enabled-and-registered';
    }
    return { ...common, skill: plan.status === 'upgrade' ? 'upgraded' : plan.status === 'install' ? 'installed' : 'unchanged',
      installedVersion: packageVersion, previousVersion: plan.release?.version, backup: skillBackup, configBackup, mcp, dryRun: false };
  } catch (error) {
    configWritten ||= error.configMutated === true;
    configBackup ||= error.configBackup;
    error.partialInstall = skillWritten || configWritten;
    error.installation = { skillWritten, configWritten, skillBackup: skillBackup || error.recoveryBackup, configBackup };
    throw error;
  }
}
