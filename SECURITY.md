# Security

## Scope

This project contains an Agent Skill, documentation, and a local setup helper.
It does not implement AirDesk's network transport, authentication, host service,
or native MCP server. Use supported AirDesk builds from the official publisher.

Both computers must have AirDesk installed, MCP mode ON, and Remote Terminal ON.
Host approval and user authorization are separate requirements. Local status
cannot attest the target's MCP setting; the skill therefore requires separate
target-owner confirmation or a check performed locally on the target. Skill
instructions are not a security boundary against an arbitrary MCP client.

## Safe Use

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
