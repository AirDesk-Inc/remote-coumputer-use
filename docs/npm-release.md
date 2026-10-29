# npm Release Guide

Package: `@airdesk/remote-computer-use`, prepared version `0.1.2`, public access.
This source version is not evidence that an npm publication has occurred.
Scope ownership and permission to publish to `@airdesk` must be verified by the
maintainer before a release. Use a new version for each subsequent publication.

## Release Gates

- Ship a compatible AirDesk app supporting `--mcp-server --mcp-setup` and the
  one-shot `--enable-mcp` option first. A source build does not mean users have
  received it. Older apps are rejected before installer writes.
- Confirm controller MCP works with local terminal hosting OFF and current
  account-bound AI terms accepted directly in the app. The target needs approved
  host access and input permission; Remote Terminal is required only for shell
  work. It does not need target MCP ON.
- Review English/Korean docs, the copied skill, and the actual npm file list.
- Keep private app source, credentials, logs and build outputs out of the package.
- Keep AirDesk logo/trademark terms separate from the MIT software license.
- Preserve verified per-file hashes of official previous skill releases in
  `lib/skill-releases.json`; verify public archive integrity before adding a
  release. Fixtures remain under `tests/fixtures/releases` and are not published.
  Test explicit upgrade, backup retention and rejection of customized files.

From a clean checkout with Node.js 22+ and Python 3.10+:

```sh
npm ci --ignore-scripts
npm test
python3 -m unittest discover -s tests -v
npm run check:package
npm pack --dry-run --json --ignore-scripts
npm publish --dry-run --access public
```

`prepublishOnly` runs the package check, including installer tests. The package
has no install/postinstall/prepare hooks. Installing dependencies does not enable
AirDesk: only an explicit `install` command performs native setup.

Test a packed archive in temporary directories with `--skip-mcp` to verify the
installed executable and self-contained skill without touching the user's MCP
configuration. Real MCP setup should also be tested with a trusted, compatible
AirDesk build and explicit user consent. Do not use live remote computers in CI.

## Publication

Actual npm publication requires separate owner authorization. After all gates
pass, the authorized maintainer can run `npm publish --access public` from this
checkout using their own npm authentication. Do not store tokens in this repo or
paste them into chat. No automated publication workflow is configured.

After publication, verify the registry version, tarball contents and command:

```sh
npx @airdesk/remote-computer-use install --dry-run
```

Keep both READMEs and the bundled setup guide current with the published package.
Keep user MCP OFF effective: never add `--enable-mcp` to the recurring native
server command.
