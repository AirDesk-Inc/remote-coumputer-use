#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { install, InstallError } from '../lib/installer.mjs';

const help = `AirDesk Remote Computer Use

Usage: npx @airdesk/remote-computer-use install [options]

Installs the skill, registers native AirDesk MCP in Codex, and enables only
the controller's MCP mode through AirDesk. Does not enable terminal hosting.

  --binary PATH      Trusted installed AirDesk executable (.app accepted on macOS)
  --skills-dir PATH  Skill parent directory (default: ~/.agents/skills)
  --config PATH      Codex TOML path (default: $CODEX_HOME/config.toml or ~/.codex/config.toml)
  --skip-mcp         Copy only the skill; do not launch AirDesk or configure MCP
  --dry-run          Inspect the installation plan without writes or launching AirDesk
  --help            Show this help
  --version         Print package version

AirDesk must be installed on both computers. Only the controller needs MCP ON.
Target terminals/window tools need Remote Terminal ON and approved access.
If target Remote Terminal is OFF, ask its owner to enable it. No remote task runs here.
Existing different skills/MCP entries are preserved and reported as conflicts.
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
    const names = { '--binary': 'binary', '--skills-dir': 'skillsDir', '--config': 'config' };
    while (args.length) {
      const arg = args.shift();
      const key = names[arg] || ({ '--skip-mcp': 'skipMcp', '--dry-run': 'dryRun' })[arg];
      if (!key || key in options) throw new InstallError('unknown_or_duplicate_option');
      if (names[arg]) {
        const value = args.shift();
        if (!value || value.startsWith('--')) throw new InstallError('missing_option_value');
        options[key] = value;
      } else options[key] = true;
    }
    console.log(JSON.stringify(await install(options), null, 2));
    console.log('Target setup: AirDesk installed and access approved. If Remote Terminal is OFF, ask the owner to enable it. Target MCP mode is not required.');
  }
} catch (error) {
  // Parser/native errors may contain credentials or private configuration. Never print raw errors.
  console.error(JSON.stringify({ error: error instanceof InstallError ? error.message : 'installation_io_failed' }));
  console.error('Existing data is not overwritten. After a setup failure, skill/config installation may already be complete; fix the cause and rerun. See the setup guide.');
  process.exitCode = 1;
}
