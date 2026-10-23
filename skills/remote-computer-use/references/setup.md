# Setup

## 1. Prepare BOTH Computers

| Requirement | Controller | Target |
| --- | --- | --- |
| Compatible AirDesk desktop app installed | Required | Required |
| MCP mode ON in AirDesk | Required | Required |
| Remote Terminal ON in AirDesk | Required | Required |
| Signed-in account / approved access | Sign in | Allow the intended user and required permissions |
| Host running and sharing enabled | Only if also hosting | Required |

Get AirDesk from the [official website](https://airdesk.co.kr). This repository
does not contain the app, a remote agent installer, or a replacement MCP server.
An older app without MCP/Remote Terminal settings is not compatible; update it.
No minimum public app version is asserted here. Tool discovery and the diagnostic
check compatibility with the installed build.

In the AirDesk app, enable **Remote Terminal**, then **MCP mode** on each computer.
Labels/placement can vary by app version. If settings are unavailable, stop; do
not edit settings files to simulate consent. Restart the MCP client/server after
signing in or updating the app. Do not run the MCP server as root/administrator
just to avoid an access error.

## 2. Install the Skill

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

Use the actual installed `AirDesk.exe` path. The installer may use a versioned
directory under `%LOCALAPPDATA%\ForPro\airdesk-app`; that legacy directory name
does not change the AirDesk product name. Do not assume a fixed version folder.
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

- Exit `0`: local flags and required base tools passed. **Not target approval.**
- Exit `1`: missing tools or local prerequisites OFF/not signed in.
- Exit `2`: setup/protocol/timeout error; a fixed error code is printed.
- Exit `130`: interrupted.

Reports allowlist local booleans and counts; raw server output/stderr is not
printed. The helper ignores inherited `REPC_STATE_DIR`, `REPC_MCP_AUTH_TOKEN`, and
`REPC_BACKEND_URL` test overrides so it checks the normal app profile. It does not
verify code signatures: run only a trusted installed executable.

**`targetVerified` is always false.** Run a local check on each computer or have
the target owner confirm installation, MCP ON, Remote Terminal ON, and access.
The controller's `remote_status` cannot attest the target's MCP setting. This
skill requires that separate confirmation before `remote_connect`.

## Troubleshooting

| Result | Next step |
| --- | --- |
| `airdesk_not_installed_at_path` | Install AirDesk or provide its exact trusted path. |
| `required_tools_missing` | Update the app; make sure this is AirDesk's native server. |
| MCP / Remote Terminal flag false | Enable both in the AirDesk app on each computer. |
| `credentialAvailable: false` | Sign in through the controller app, restart MCP, retry. |
| `unsupported_protocol_version` | Update the app/helper; do not bypass negotiation. |
| `response_timeout` / invalid protocol | Restart the MCP process, verify app compatibility. Do not publish raw logs. |
| Target cannot be verified | Ask its owner to check setup locally; do not connect yet. |
| Connection denied / host unavailable | Verify hosting, sharing approval, network and target settings in AirDesk. |
| Screenshot present, input unavailable | Check `inputReady`, selected display and permissions; do not spam input. |
| Windows automation unsupported | Use approved screenshot/input tools if available; no permission bypass. |

Reference: [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp),
[Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Agent Skills specification](https://agentskills.io/specification),
[MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).
