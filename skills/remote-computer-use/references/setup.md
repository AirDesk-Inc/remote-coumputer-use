# Setup

## 1. Prepare BOTH Computers

| Requirement | Controller | Target |
| --- | --- | --- |
| Compatible AirDesk desktop app installed | Required | Required |
| MCP mode ON in AirDesk | Required | Not required |
| Remote Terminal ON in AirDesk | Not required | Shell work only |
| Applicable in-app feature terms accepted | Current MCP terms | Remote Terminal hosting terms for shell work |
| Signed-in account / approved access | Sign in | Allow the intended user and required permissions |
| Host running and sharing enabled | Only if also hosting | Required |

Get AirDesk from the [official website](https://airdesk.co.kr).
An older app without MCP/Remote Terminal settings is not compatible; update it.
No minimum public app version is asserted here. Tool discovery and the diagnostic
check compatibility with the installed build.

Sign in to AirDesk on the controller, enable **MCP mode**, and personally review
and accept the current AI remote-access terms shown by the app. Acceptance is
account-bound; a new terms version or a different account can require review
again. The installer and agent never accept terms for you.
The target needs **Remote Terminal** enabled only for shell terminal tools, not
desktop/browser automation. If shell work is needed and it is OFF, ask its owner
to enable it and wait for confirmation. Target MCP may stay OFF. After the terms
are accepted, an explicitly authorized installer can enable controller MCP using
AirDesk's native setup command without enabling local terminal hosting.
Labels/placement can vary by app version. If settings are unavailable, update the
app; do not edit settings files to simulate consent. Restart the MCP client/server after
signing in or updating the app. Do not run the MCP server as root/administrator
just to avoid an access error.

## 2. Install the Skill

Ask your AI agent:

> Install https://github.com/AirDesk-Inc/remote-coumputer-use.git.
> Register AirDesk's native MCP server and enable MCP mode on this computer.
> Leave local Remote Terminal hosting unchanged.

The installer requires Node.js 22+. From a checkout, run:

```sh
npm ci --ignore-scripts
node bin/cli.mjs install
```

The equivalent npm command is:

```sh
npx @airdesk/remote-computer-use install
```

The default installation copies the skill into
`~/.agents/skills/remote-computer-use`, preserves other
Codex configuration, and registers the installed AirDesk executable. The config
defaults to `$CODEX_HOME/config.toml` or `~/.codex/config.toml`.

| Option | Effect |
| --- | --- |
| `--binary PATH` | Absolute trusted AirDesk executable or macOS `.app` path; required on Windows. |
| `--skills-dir PATH` | Alternative parent skill directory. |
| `--config PATH` | Alternative Codex TOML configuration file. |
| `--client NAME` | `codex` (default), `claude-code`, `claude-desktop`, or `generic`. JSON clients require an explicit `--config` path. |
| `--upgrade` | Upgrade an unchanged official previous skill and retain its entire old directory as a backup. |
| `--dry-run` | Plan only; no AirDesk execution or writes. |
| `--skip-mcp` | Copy only the skill; do not register MCP or change AirDesk. |

Existing identical installs are kept, ignoring real Python `.pyc` cache files
inside `__pycache__`. A known official 0.1.0/0.1.1 install requires explicit
`--upgrade`; its per-file SHA-256 manifest must match before replacement. The new
tree is staged completely, the old directory is retained as a named backup, and
publication uses a directory rename with rollback on failure. Staging and backups
live in a private hidden directory outside the selected skill discovery root
(also outside the standard Codex/Claude Code roots), so clients do not discover
old duplicate skills. The storage must share the skill's filesystem for atomic
renames; otherwise the upgrade stops without moving the old skill. The result
reports the exact retained backup path. Do not delete a
backup until you have checked the result. Custom/extra files, modified official
files, symlinks and conflicting AirDesk MCP entries are not overwritten.
For a skill-only upgrade use `install --upgrade --skip-mcp`.
Reload your MCP client after installation. Other MCP clients can use
`--skip-mcp` and the manual configuration below.

Automatic enabling requires an updated AirDesk build supporting the read-only
`--mcp-server --mcp-setup` query and one-shot
`--mcp-server --mcp-setup --enable-mcp` operation. The installer checks the native
capability before writing. It never directly edits AirDesk's settings or changes
terminal hosting. The recurring server command remains **only `--mcp-server`**:
MCP OFF is not silently reversed on restart. Older builds without current consent
metadata require an app update. Manual configuration does not establish consent
or make an old app compatible.

If preflight reports `ai_remote_access_terms_required`, it stops before skill or
configuration writes. Sign in and accept the terms in the app, then rerun.
An older native build without current consent metadata returns
`native_app_update_required` before skill/config writes, even if its old MCP
switch is ON. `--skip-mcp` may still copy the portable skill. If consent changes
between preflight and activation, `partialInstall` reports whether skill/config
writes occurred, with retained backup paths when available. Inspect that state
and retry after the stated recovery rather than deleting existing data.

### Select another MCP client

Codex retains append-only TOML registration and preserves unrelated bytes.
Claude Code, Claude Desktop and generic local stdio clients use the common JSON
`mcpServers` shape. Supply the actual configuration file for the selected client:

```sh
npx @airdesk/remote-computer-use install --client claude-code --config /absolute/path/to/your/project/.mcp.json
npx @airdesk/remote-computer-use install --client claude-desktop --config /absolute/path/to/claude_desktop_config.json
```

The example paths are placeholders. Confirm the client reads that file; this
command does not change client permissions, choose a project, or prove the client
has loaded MCP. Existing JSON entries are preserved, formatting is normalized,
and an existing file is retained as a backup before an exclusive complete-file
publish. A conflicting `airdesk` entry fails without replacement. If the client
recreates the configuration during publication, its new
file is preserved, the old file remains at the reported `configBackup` path, and
`partialInstall:true` / `installation.configWritten:true` disclose the earlier
mutation even though registration failed. Inspect both files before retrying;
do not overwrite the client-created file with the backup automatically. Reload the
client and verify its tool catalog afterward. Claude Code may require approval of
the project's `.mcp.json`; keep that approval in place. Its personal skill copy
defaults to `~/.claude/skills`; Codex uses `~/.agents/skills`. Desktop/generic
selection configures MCP and copies a portable skill but does not install/import
that skill into the application's UI. Use the client's documented skill workflow
where supported, or `--skills-dir` for another filesystem discovery location.
`config --client claude-code`, `claude-desktop`, and `generic` print the
same JSON shape without writing.

### Manual Installation

Clone the public repository to a location you control:

```sh
git clone https://github.com/AirDesk-Inc/remote-coumputer-use.git
```

The repository name intentionally matches that URL, including `coumputer`.
The skill name is correctly spelled `remote-computer-use`.

For Codex on macOS/Linux, from the cloned repository:

```sh
mkdir -p ~/.agents/skills
ln -s "$PWD/skills/remote-computer-use" ~/.agents/skills/remote-computer-use
```

If that destination already exists, inspect it first; do not overwrite it. Keep
the clone at that location while using a symlink. On Windows, copy the entire
`skills/remote-computer-use` folder into `%USERPROFILE%\.agents\skills\` (without
replacing an existing skill). Reload the client if it does not discover it.

Other Agent Skills-compatible clients may have different installation paths.
Installing a skill alone does not register or start the native MCP server.

## 3. Register Native Stdio MCP on the Controller

The command is the **installed AirDesk executable**, with exactly one argument:
`--mcp-server`. No URL, port, API token, or new HTTP listener is needed.

### Codex, macOS

Merge the following into `~/.codex/config.toml`, preserving other configuration:

```toml
[mcp_servers.airdesk]
command = "/Applications/AirDesk.app/Contents/MacOS/AirDesk"
args = ["--mcp-server"]
startup_timeout_sec = 20
tool_timeout_sec = 60
```

Alternatively, register the server with the CLI:

```sh
codex mcp add airdesk -- /Applications/AirDesk.app/Contents/MacOS/AirDesk --mcp-server
```

Use one registration method, not both. Keep tool approval controls enabled.

### Windows

Use the actual installed `AirDesk.exe` path. Current installers use
`%LOCALAPPDATA%\AirDesk\app`; a build can use a versioned subdirectory. Do not
assume a fixed version folder.
Find the trusted executable through the installed app's shortcut properties.
Recheck the path after an app update.

With Python 3.10+ installed, print a config using your real path:

```powershell
py -3 skills/remote-computer-use/scripts/airdesk_mcp.py config --client codex --binary "C:\absolute\path\to\AirDesk.exe"
```

The example path is a placeholder, not an installation location. The helper
checks that the file exists. It does not search PATH or select an arbitrary binary.

### Other Local MCP Clients

Clients using the common `mcpServers` JSON format can use:

```json
{
  "mcpServers": {
    "airdesk": {
      "command": "/Applications/AirDesk.app/Contents/MacOS/AirDesk",
      "args": ["--mcp-server"]
    }
  }
}
```

Confirm your client's format/location in its own documentation. This is not a
claim that every MCP client supports this JSON shape or local stdio. A cloud-only
client cannot directly execute an app installed on your desktop. Do not expose
stdio through an unauthenticated network bridge.

## 4. Read-Only Check

Python is only needed for this optional helper, not for the skill or native MCP.
From the repository root on macOS:

```sh
python3 skills/remote-computer-use/scripts/airdesk_mcp.py doctor
```

Pass `--binary` on Windows or when AirDesk is installed elsewhere. A `.app` path
is also accepted on macOS. `config --client codex` or `config --client generic`
prints configuration without writing files or launching AirDesk.

`doctor` starts its own native stdio process, initializes MCP, lists tools, and
calls **only `remote_status`**. It does not list computers, connect, capture
screens, send input, open terminals, or enable settings. It closes its own child
process on completion/timeout, not the running AirDesk GUI or host service.

- Exit `0`: current consent, local flags and required bound-input schemas passed. **Not target approval.**
- Exit `1`: missing tools or local prerequisites OFF/not signed in.
- Exit `2`: setup/protocol/timeout error; a fixed error code is printed.
- Exit `130`: interrupted.

Reports allowlist local booleans, public terms version, blocked reason and tool
names/counts; raw server output/stderr is not
printed. The helper ignores inherited `REPC_STATE_DIR`, `REPC_MCP_AUTH_TOKEN`, and
`REPC_BACKEND_URL` test overrides so it checks the normal app profile. It does not
verify code signatures: run only a trusted installed executable.

**`targetVerified` is always false.** Verify target installation, host sharing and
approved access separately. Do not use the local diagnostic to require target
MCP activation: target MCP is not needed. If `terminalAdvertised` or
`terminalSupported` is false, ask the user to check target Remote Terminal.
These flags can also be false on unsupported/outdated hosts, so do not diagnose
OFF solely from a capability flag. After enabling, reconnect/recheck if needed.

## Troubleshooting

| Result | Next step |
| --- | --- |
| `airdesk_not_installed_at_path` | Install AirDesk or provide its exact trusted path. |
| `required_tools_missing` | Update the app; make sure this is AirDesk's native server. |
| `required_tool_schema_missing` | Update the app: a core pointer tool lacks the required screenshot binding. |
| `ai_remote_access_terms_required` | Sign in and review/accept the current AI terms in AirDesk, then retry. Never edit receipts or autoaccept. |
| `terms_status_unavailable` | Update the native app/helper so consent status can be verified. |
| `policy_unavailable` | Resolve access to normal AirDesk settings; do not repeatedly toggle MCP or edit auth/settings files. |
| MCP flag false with current terms accepted | Enable MCP in AirDesk or explicitly rerun the authorized installer. |
| `remoteTerminalEnabled: false` locally | Expected for a controller-only PC; no change needed. Target terminal permission is needed only for shell work. |
| `skill_upgrade_required` | Use explicit `--upgrade` for an unchanged official older skill; the old directory is backed up. |
| `skill_upgrade_storage_unavailable` / `skill_upgrade_storage_volume_mismatch` | No safe backup/staging location exists outside discovery on the same filesystem. Keep the old skill and choose a suitable `--skills-dir`; do not copy a backup into a discovery root. |
| `existing_skill_conflict` | Inspect user changes/extra files; do not force overwrite or delete them. |
| `native_app_update_required` | Update AirDesk. Skill-only copying/config output can prepare files but does not establish current consent or readiness. |
| `credentialAvailable: false` | Sign in through the controller app, restart MCP, retry. |
| `unsupported_protocol_version` | Update the app/helper; do not bypass negotiation. |
| `response_timeout` / invalid protocol | Restart the MCP process, verify app compatibility. Do not publish raw logs. |
| Target access cannot be verified | Ask its owner to confirm sharing/access; do not connect yet. |
| Target Remote Terminal OFF | Ask the owner to enable it in target AirDesk hosting settings, then confirm/recheck. Target MCP is not required. |
| Connection denied / host unavailable | Verify hosting, sharing approval, network and target settings in AirDesk. |
| Screenshot present, input unavailable | Check `inputReady`, selected display and permissions; do not spam input. |
| Desktop automation unsupported | Use approved screenshot/input tools if available; no permission bypass. |

`controllerCapabilities` separates optional screen gestures, desktop automation,
browser automation and debug tools from required core tools. A missing optional
group does not invalidate basic screen control, and a locally advertised group
does not verify the target's support. `targetVerified` remains false in every
diagnostic result.

Reference: [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp),
[Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Agent Skills specification](https://agentskills.io/specification),
[MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).
