# Security And Privacy

## Local-First Default

Community is designed as a local-first CLI. Repository indexing and file reads happen on the user's machine.

## Bring Your Own Keys

Undes does not sell model tokens. Users configure their own provider access for the Community package.

## Repository

This repository contains public documentation, examples, and issue templates.

## No Telemetry

Undes Community does not send telemetry. It does not send prompts, repository
content, run artifacts, model keys, or usage signals to Undes.

## Update Check

Undes Community may check the public npm registry for newer package versions.
The check is a read-only request to:

```text
https://registry.npmjs.org/@undes.ai/cli/latest
```

It does not include project content. Disable it with any of:

```bash
UNDES_NO_UPDATE_CHECK=1
undes run --no-update-check --prompt="..."
```

or by setting `updateCheck` to `false` in the project config.

## Terminal Output

Community defaults to operator-facing output. Use `--progress` for high-level
run progress. Full internal verbose output is not available in Community.

## Artifacts

Undes artifacts are intended for operator review. Public examples must be sanitized:

- no customer names;
- no proprietary repository paths;
- no secrets;
- no raw provider payloads.
