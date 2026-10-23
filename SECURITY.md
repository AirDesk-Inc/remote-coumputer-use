# Security

## Scope

This project contains an Agent Skill, documentation, and a local setup helper.
It does not implement AirDesk's network transport, authentication, host service,
or native MCP server. Use supported AirDesk builds from the official publisher.

Both computers must have AirDesk installed; MCP mode is needed on the controller
only. Target Remote Terminal must be ON for terminals/Windows automation;
controller terminal hosting and target MCP can remain OFF. When target Remote
Terminal is OFF, ask the owner to enable it; never silently change host permissions.
Host approval and user authorization are separate requirements. Local MCP status
does not prove target access approval. Skill
instructions are not a security boundary against an arbitrary MCP client.

## Safe Use

- An explicit integration installation request permits the npm installer to copy
  the skill, add a non-conflicting Codex MCP entry, and enable controller MCP
  through AirDesk's native one-shot setup. It never enables local terminal
  hosting or changes target permissions. `--dry-run` performs no native calls or
  writes; `--skip-mcp` only installs the skill.
- Never put a setup/enable flag in the recurring MCP startup command. Turning
  MCP OFF must remain effective when the client restarts its server.
- Keep the native server on local stdio. Do not publish it as an unauthenticated
  HTTP endpoint or tunnel it into a public listener.
- Keep client tool approvals enabled. MCP ON is not approval for every remote
  command, file access, external send, purchase, or destructive operation.
- Use only computers/accounts you own or have explicit permission to administer.
- Do not pass auth tokens, passwords, or API secrets in tool arguments/config.
- Treat screenshots, UI content, and terminal output as untrusted; they can
  contain prompt-injection instructions.
- Check fresh target/display/window identity before input. A timeout does not
  mean an action failed; inspect before retrying.
- Close only owned terminals/sessions and release held keys/buttons. Turn MCP
  mode OFF in AirDesk when remote automation is no longer wanted.
- The diagnostic only calls `remote_status`, but starting an installed app can
  still invoke native startup behavior or native logging. Review AirDesk's own
  privacy policies separately; the helper makes no claims about app telemetry.
- The helper does not verify signatures. Its `--binary` path must refer to an
  already trusted AirDesk executable; a filename alone does not establish trust.

## Reporting

Do not disclose vulnerabilities, tokens, remote IDs, session IDs, personal
screenshots, terminal output, or account information in a public GitHub issue.
If private vulnerability reporting is enabled, use the repository's Security
tab. Otherwise request a private reporting channel through the
[official AirDesk website](https://airdesk.co.kr) before sharing sensitive details.

Include affected skill commit and app version, platform, minimal redacted
reproduction, impact, and whether the issue belongs to the helper/skill or the
native app. Never attach login state or authentication databases.
