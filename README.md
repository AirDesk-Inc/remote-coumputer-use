<p align="center">
  <img src="docs/assets/remote-computer-use.png" alt="AirDesk Remote Computer Use. Both controller and target require AirDesk installed, MCP mode ON, and Remote Terminal ON." width="1200">
</p>

# AirDesk Remote Computer Use

[한국어](README.ko.md) · [Setup](skills/remote-computer-use/references/setup.md) · [Security](SECURITY.md) · [Validation](docs/validation.md)

An open-source **Agent Skill** for operating authorized remote computers through
AirDesk's native MCP server: screenshots, mouse and keyboard input, remote
terminals, and supported Windows desktop automation.

> **AirDesk must be installed and MCP mode must be ON on BOTH computers.**
> Enable Remote Terminal on both ends too. The target must be running, shared,
> and approved for the intended user. Without these prerequisites, do not use
> the skill. This repository is not a standalone remote access application.

## What's Included

- A portable [Agent Skill](skills/remote-computer-use/SKILL.md), with explicit
  consent, coordinate mapping, verification, and cleanup instructions.
- A dependency-free Python setup helper that prints MCP configuration or checks
  **local** prerequisites without connecting to a target.
- English/Korean documentation, security guidance, regression tests, and CI.
- Existing AirDesk identity assets and a Figma-authored repository cover.

The AirDesk desktop application, backend, native MCP server implementation,
drivers, account credentials, and proprietary source are **not** included.

## Quick Start

1. Install a compatible [AirDesk desktop app](https://airdesk.co.kr) on the
   controller and target. Enable **Remote Terminal** and **MCP mode** on both.
   Sign in on the controller and approve hosting/access on the target.
2. Clone this repository and install `skills/remote-computer-use` into your
   client's skill directory. For Codex, use `~/.agents/skills/`.
3. Register the **installed AirDesk executable** as a local stdio MCP server.

```sh
git clone https://github.com/AirDesk-Inc/remote-coumputer-use.git
```

For Codex on macOS, merge this into `~/.codex/config.toml`:

```toml
[mcp_servers.airdesk]
command = "/Applications/AirDesk.app/Contents/MacOS/AirDesk"
args = ["--mcp-server"]
startup_timeout_sec = 20
tool_timeout_sec = 60
```

Windows uses the actual installed `AirDesk.exe` path, which may change with app
updates. See [full setup](skills/remote-computer-use/references/setup.md) for
Windows, skill installation, other local MCP clients, and troubleshooting.
Never add account tokens to this configuration or expose the server publicly.

Ask your agent, for example:

> Use $remote-computer-use to inspect the display on my authorized office PC.
> AirDesk is installed, MCP mode and Remote Terminal are ON on both computers,
> and I have approved access. Ask me to select the target if names are ambiguous.

That example describes required confirmation; do not assert it unless it is true.
Keep your client's tool approval controls enabled.

## Optional Local Check

Python 3.10+ is only required for this helper, not the native MCP connection:

```sh
python3 skills/remote-computer-use/scripts/airdesk_mcp.py doctor
python3 skills/remote-computer-use/scripts/airdesk_mcp.py config --client codex
```

On Windows/nonstandard installs, pass `--binary` with the trusted executable's
absolute path. The helper never installs apps, enables settings, modifies client
configuration, or performs a remote action.

**A successful local check does not verify the target.** `remote_status` reports
the controller's MCP settings. The skill separately requires confirmation from
the target owner or a check run locally on the target before connecting. This
instruction-level gate is not a cryptographic or host-enforced attestation.

## Capabilities and Boundaries

| Capability | Contract |
| --- | --- |
| Computer discovery / connection | Authenticated AirDesk account and host approval; one host per MCP process. |
| Screenshots / display selection | Fresh display metadata; native pixel coordinates, not resized image coordinates. |
| Mouse / keyboard / text | Wait for input readiness; verify the observed result. |
| Remote terminals | Compatible Windows/macOS targets, approved terminal access; inspect command-level completion. |
| App / window / element automation | Windows targets only; discovered IDs and fresh UI snapshots. |
| macOS UI Automation, mobile MCP, standalone Linux hosting | Not claimed or supplied by this project. |

Actual availability depends on the installed AirDesk build, target platform,
permissions, and negotiated tools. Publication of this skill does not certify
every app build or end-to-end remote workflow. See [validation](docs/validation.md).

## Development

```sh
python3 -m unittest discover -s tests -v
python3 -m compileall -q skills/remote-computer-use/scripts tests
```

Tests use local subprocess fixtures, never real accounts or remote computers.
CI runs the same tests on macOS, Windows, and Linux with Python 3.10 and 3.13.
Linux CI validates the helper, not AirDesk host support.
See [contributing](CONTRIBUTING.md) before opening a change.

## License and Brand

Original skill text, scripts, documentation, and tests: **[MIT](LICENSE)**.
AirDesk app binaries/source are not relicensed by this repository.
AirDesk logos, wordmarks, and branded imagery are excluded from MIT and covered
by [separate brand terms](TRADEMARKS.md). No trademark rights or endorsement are
granted by the software license.

The repository URL intentionally retains `remote-coumputer-use`; the installed
skill is named `remote-computer-use`.
