#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { install, InstallError } from '../lib/installer.mjs';

const help = `AirDesk Remote Computer Use

Usage: npx @airdesk/remote-computer-use install [options]

Installs the skill, registers native AirDesk MCP in the selected client, and enables only
the controller's MCP mode through AirDesk. Does not enable terminal hosting.

  --binary PATH      Trusted installed AirDesk executable (.app accepted on macOS)
  --skills-dir PATH  Skill parent directory (Codex: ~/.agents/skills; Claude Code: ~/.claude/skills)
  --config PATH      Codex TOML path (default: $CODEX_HOME/config.toml or ~/.codex/config.toml)
  --client NAME      codex (default), claude-code, claude-desktop, or generic
                     JSON clients require an explicit --config path
  --upgrade          Upgrade an unchanged official 0.1.0/0.1.1 skill, retaining a backup
  --skip-mcp         Copy only the skill; do not launch AirDesk or configure MCP
  --dry-run          Inspect the installation plan without writes or launching AirDesk
  --help            Show this help
  --version         Print package version

AirDesk must be installed on both computers. Only the controller needs MCP ON.
Only target shell terminals require Remote Terminal ON. Window/browser automation
uses approved host access and input permission. No remote task runs here.
First sign in to AirDesk and review/accept its AI remote-access terms in the app.
Custom skill files and conflicting MCP entries are preserved, never replaced.
`;

try {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help')) {
    process.stdout.write(help);
  } else if (args.length === 1 && args[0] === '--version') {
    console.log(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version);
  } else {
    if (args.shift() !== 'install') throw new InstallError('expected_install_command');
    const options = {};
    const names = { '--binary': 'binary', '--skills-dir': 'skillsDir', '--config': 'config', '--client': 'client' };
    const flags = { '--skip-mcp': 'skipMcp', '--dry-run': 'dryRun', '--upgrade': 'upgrade' };
    while (args.length) {
      const arg = args.shift();
      const takesValue = Object.hasOwn(names, arg);
      const key = takesValue ? names[arg] : Object.hasOwn(flags, arg) ? flags[arg] : undefined;
      if (!key || key in options) throw new InstallError('unknown_or_duplicate_option');
      if (takesValue) {
        const value = args.shift();
        if (!value || value.startsWith('--')) throw new InstallError('missing_option_value');
        options[key] = value;
      } else options[key] = true;
    }
    const result = await install(options);
    console.log(JSON.stringify(result, null, 2));
    console.log(result.dryRun ? 'Controller installation plan generated; no settings were changed.'
      : result.mcp === 'skipped' ? 'Skill installation completed; native MCP setup was skipped.'
      : 'Controller MCP setup completed. Reload the selected MCP client.');
    console.log('Target installation, hosting and access approval have not been verified. Confirm them before connecting. Target Remote Terminal is needed only for shell work; target MCP mode is not required.');
    if (result.skillDiscovery === 'manual-import' || result.skillDiscovery === 'client-specific')
      console.log('The portable skill was copied, but automatic skill discovery by this client is not verified. Load it through the client-supported skill workflow.');
  }
} catch (error) {
  // Parser/native errors may contain credentials or private configuration. Never print raw errors.
  const code = error instanceof InstallError ? error.message : 'installation_io_failed';
  console.error(JSON.stringify({ error: code, partialInstall: error.partialInstall === true,
    ...(error.installation ? { installation: error.installation } : {}) }));
  if (code === 'ai_remote_access_terms_required')
    console.error('Open AirDesk, sign in, and review/accept the AI remote-access terms when enabling MCP. Then rerun this installer. Terms are never accepted automatically.');
  if (code === 'skill_upgrade_required')
    console.error('An unchanged official previous skill was found. Rerun with --upgrade to retain a backup and install the new version.');
  console.error('Custom skill files and conflicting MCP entries are preserved. If partialInstall is true, inspect the reported controller state and backups before retrying. See the setup guide.');
  process.exitCode = 1;
}
