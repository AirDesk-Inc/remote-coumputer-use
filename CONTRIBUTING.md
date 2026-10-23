# Contributing

Keep changes scoped to the open skill, setup helper, tests, and documentation.
Do not copy proprietary AirDesk code, internal documents, binaries, credentials,
or private logs into this repository. Contributions to original code/content
are provided under MIT; brand assets retain their separate terms.

Before submitting:

1. Run `python3 -m unittest discover -s tests -v` with Python 3.10+.
2. Keep the skill self-contained when only `skills/remote-computer-use` is copied.
3. Preserve both-computer installation/MCP/terminal requirements and the explicit
   distinction between local checks and target verification.
4. Do not add remote actions, credential input, settings edits, automatic
   installation, public listeners, or shell execution to the diagnostic.
5. Add regression tests for protocol handling and keep waits/buffers bounded.
6. Update English and Korean READMEs when user-facing requirements change.
7. Review the diff for private paths, account/host IDs, secrets and binary assets.

The helper intentionally uses only Python's standard library. Its fixtures do
not require an AirDesk account or a target. End-to-end tests against a real
computer must be opt-in, explicitly authorized, and documented separately from
unit-test results. Do not put device/account credentials in CI.

Report ordinary bugs with the skill commit, Python/app versions, platform, a
sanitized diagnostic error code, and reproduction steps. Report security issues
privately as described in SECURITY.md.
