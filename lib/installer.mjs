import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'smol-toml';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url));
export const skillName = 'remote-computer-use';
export const skillFiles = [
  'SKILL.md', 'LICENSE.txt', 'agents/openai.yaml', 'assets/NOTICE.md',
  'assets/airdesk-symbol.svg', 'assets/airdesk-lockup.svg',
  'references/setup.md', 'references/screen-control.md', 'references/terminal.md',
  'references/windows-automation.md', 'scripts/airdesk_mcp.py',
];

export class InstallError extends Error {
  constructor(code) { super(code); this.name = 'InstallError'; }
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
  for (const key of ['REPC_STATE_DIR', 'REPC_MCP_AUTH_TOKEN', 'REPC_BACKEND_URL']) delete env[key];
  const result = spawnSync(binary, args, {
    input: '', encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
    stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, shell: false, env,
  });
  if (result.error || result.status !== 0) throw new InstallError('native_setup_failed');
  let status;
  try { status = JSON.parse(result.stdout); }
  catch { throw new InstallError('native_app_update_required'); }
  if (status?.mcpSetupVersion !== 1 || status.clientMcpOnly !== true ||
      typeof status.mcpServerEnabled !== 'boolean' || typeof status.remoteTerminalEnabled !== 'boolean' ||
      status.remoteTerminalChanged !== false) throw new InstallError('native_app_update_required');
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

async function readConfig(filename) {
  const info = await statOrNull(filename);
  if (!info) return '';
  if (!info.isFile() || info.isSymbolicLink()) throw new InstallError('config_not_regular_file');
  if (info.size > 1024 * 1024) throw new InstallError('config_too_large');
  return fs.readFile(filename, 'utf8');
}

async function registerConfig(filename, binary) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const lock = `${filename}.airdesk-install.lock`;
  await fs.mkdir(lock).catch(() => { throw new InstallError('config_busy'); });
  try {
    const original = await readConfig(filename);
    const addition = configAddition(original, binary);
    if (!addition) return 'unchanged';
    // Append, never reserialize the user's configuration or remove comments/settings.
    await fs.appendFile(filename, addition, { mode: 0o600 });
    try { parse(await readConfig(filename)); }
    catch { throw new InstallError('config_changed_concurrently_review_required'); }
    return 'registered';
  } finally { await fs.rmdir(lock); }
}

async function readTree(directory, prefix = '') {
  const result = new Map();
  for (const entry of await fs.readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new InstallError('skill_contains_symlink');
    if (entry.isDirectory()) {
      for (const [name, data] of await readTree(directory, relative)) result.set(name, data);
    } else if (entry.isFile()) result.set(relative, await fs.readFile(path.join(directory, relative)));
    else throw new InstallError('skill_contains_special_file');
  }
  return result;
}

async function planSkill(skillsDir, source) {
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
  if (actual.size !== files.size || [...files].some(([name, data]) => !actual.get(name)?.equals(data)))
    throw new InstallError('existing_skill_conflict');
  return { destination, files, status: 'unchanged' };
}

async function copySkill(plan) {
  if (plan.status === 'unchanged') return;
  await fs.mkdir(path.dirname(plan.destination), { recursive: true });
  await fs.mkdir(plan.destination); // Exclusive reservation: never overwrite an existing skill.
  const copied = [];
  const directories = new Set([plan.destination]);
  try {
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
  }
}

export async function install(options = {}, dependencies = {}) {
  const skillsDir = path.resolve(options.skillsDir || path.join(os.homedir(), '.agents', 'skills'));
  const configPath = path.resolve(options.config || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml'));
  const source = path.join(packageRoot, 'skills', skillName);
  const plan = await planSkill(skillsDir, source);
  const setup = dependencies.nativeSetup || nativeSetup;
  const binary = options.skipMcp ? null : await findBinary(options.binary);
  if (binary) configAddition(await readConfig(configPath), binary);
  if (options.dryRun) return { skill: plan.status, destination: plan.destination, mcp: binary ? 'planned' : 'skipped', dryRun: true };
  if (binary) setup(binary, false); // Compatibility preflight before any installation writes.
  await copySkill(plan);
  let mcp = 'skipped';
  if (binary) {
    await registerConfig(configPath, binary);
    setup(binary, true); // Explicit install operation only; never put this flag in the MCP startup command.
    mcp = 'enabled-and-registered';
  }
  return { skill: plan.status === 'install' ? 'installed' : 'unchanged', destination: plan.destination, mcp, dryRun: false };
}
