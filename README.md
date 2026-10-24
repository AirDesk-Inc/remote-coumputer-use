<p align="center">
  <img src="docs/assets/remote-computer-use.png" alt="AirDesk on both computers. MCP ON on the controller only; Remote Terminal ON on the target." width="1200">
</p>

# AirDesk Remote Computer Use

[한국어](README.ko.md) · [Setup](skills/remote-computer-use/references/setup.md) · [Security](SECURITY.md) · [Validation](docs/validation.md)

An open-source **Agent Skill** for operating authorized remote computers through
AirDesk's native MCP server: screenshots, mouse and keyboard input, remote
terminals, and supported Windows desktop automation.

> **Install AirDesk on both computers. MCP mode is required only on the controller.**
> The controller needs MCP mode only, not local terminal hosting. Enable Remote
> Terminal on the target for terminals and Windows automation; target MCP can stay OFF.
> If target Remote Terminal is OFF, the AI asks you to enable it before proceeding.
> The target must be running, shared,
> and approved for the intended user. Without these prerequisites, do not use
> the skill. This repository is not a standalone remote access application.

## What's Included

- A portable [Agent Skill](skills/remote-computer-use/SKILL.md), with explicit
  consent, coordinate mapping, verification, and cleanup instructions.
- A dependency-free Python setup helper that prints MCP configuration or checks
  **local** prerequisites without connecting to a target.
- An npm installer that installs the skill, registers the native MCP server,
  and enables only the controller's MCP mode through AirDesk itself.
- English/Korean documentation, security guidance, regression tests, and CI.
- Existing AirDesk identity assets and a Figma-authored repository cover.

## Quick Start

Install [AirDesk](https://airdesk.co.kr) on both computers, then ask your AI agent
to install this GitHub repository:

> Install https://github.com/AirDesk-Inc/remote-coumputer-use.git.
> Enable this computer's AirDesk MCP mode and register its native MCP server.
> Leave this computer's Remote Terminal hosting setting unchanged.

The installer copies the skill to `~/.agents/skills/` and adds an `airdesk` server
to Codex configuration, preserving unrelated settings. It enables MCP once during
installation, not on every server startup. Sign in through AirDesk and reload
your MCP client. The target owner enables host access and Remote Terminal for
terminal/window tools; no target MCP activation is needed.

### npm / npx

Node.js 22+ is required for the installer:

```sh
npx @airdesk/remote-computer-use install
```

Alternatively, from a checkout of the repository:

```sh
npm ci --ignore-scripts
node bin/cli.mjs install
```

Use `--binary` with the trusted AirDesk executable's absolute path on Windows or
nonstandard installs. `--dry-run` previews without executing AirDesk or writing
files; `--skip-mcp` installs only the skill. Conflicting skills/configuration are
not overwritten. Automatic setup requires an AirDesk build supporting
`--mcp-server --mcp-setup`; older builds must be updated or configured manually.
See [full setup](skills/remote-computer-use/references/setup.md) and
[npm release guide](docs/npm-release.md). Never add account tokens to MCP
configuration or expose the server publicly.

Ask your agent, for example:

> Use $remote-computer-use to inspect the display on my authorized office PC.
> Both computers have AirDesk; controller MCP is ON and the target has Remote Terminal
> enabled and I have approved access. Ask me to select ambiguous targets.

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

**A successful local check does not verify target access.** `remote_status`
reports the controller's MCP settings, not target permission approval. Verify
host sharing/access separately. If Remote Terminal is OFF on the target, the
agent asks you to turn it ON; it never asks for target MCP mode.

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

The AI calls AirDesk's native `terminal_open`, `terminal_write`, and
`terminal_read` tools for a target-side terminal. On Windows, native
`remote_list_windows` / `remote_get_window` return validated window IDs, titles,
process IDs, bounds, and state. Use those IDs, not guessed numeric window handles.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run check:package
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
