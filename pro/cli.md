# Pro CLI

Undes Pro is the paid local CLI for users who need the Pro terminal UI, local
run history, Engineering Memory, expanded provider routing, and license-gated execution.

Buy or manage Pro access from [undes.app/pricing](https://undes.app/pricing).

Pro is distributed as a separate npm package from Community:

```bash
npm install -g @undes.ai/cli-pro
undes-pro --help
```

Current recommended release:

```bash
npm install -g @undes.ai/cli-pro@latest
undes-pro --version
```

Check the currently published version:

```bash
npm view @undes.ai/cli-pro version
```

Pro requires a valid Undes Pro license and the platform native verification
package installed by npm for your operating system. If the native verifier is
missing, mismatched, or the license is invalid, license-gated commands fail
closed.

## Setup Commands

These commands are available for setup and recovery:

```bash
undes-pro --help
undes-pro --version
undes-pro doctor
```

License commands:

```bash
undes-pro license activate <purchase-key>
undes-pro license status
undes-pro license refresh
undes-pro license deactivate
```

`license activate` exchanges a purchase key for a signed local license token.
`license status` reads the local license state. `license refresh` performs an
explicit heartbeat with the license service. `license deactivate` releases the
local activation.

Purchase keys are issued through [undes.app/pricing](https://undes.app/pricing)
and the account license page.

## Run

Run accepts the same prompt input styles as Community:

```bash
undes-pro run --prompt="Review this change and identify merge-blocking risks."
undes-pro run --prompt-file=./task.txt
undes-pro run --project-path=/path/to/project
```

On a TTY, Pro uses the terminal UI by default. In CI, redirected output, or
when explicitly requested, it runs headless:

```bash
undes-pro run --no-tui --prompt="Review this change."
undes-pro run --headless --prompt-file=./task.txt
undes-pro run --tui --prompt="Review this change."
```

The generated answer remains outcome-level: final result, evidence, risks, open
checks, and trust verdict. Pro does not expose raw prompts, raw model responses,
or internal pipeline artifacts as public command output.

## History

Pro can show local run history:

```bash
undes-pro history
undes-pro history --limit=10
undes-pro history --no-tui --limit=10
```

On a TTY, history uses the terminal UI. In headless mode it prints a plain text
summary.

## Delegated Community Commands

These commands keep the Community behavior and are safe setup/recovery paths:

```bash
undes-pro init
undes-pro inspect latest
undes-pro doctor
```

## Diagnostic Demo

Early-access builds include a small terminal UI demo command:

```bash
undes-pro tui-demo
```

It streams synthetic events through the Pro terminal UI. It is for smoke
testing the UI path, not for normal project work.

## Edition Boundary

Community and Pro are separate npm packages:

- Community: `@undes.ai/cli`, binary `undes`
- Pro: `@undes.ai/cli-pro`, binary `undes-pro`

For the current edition comparison, see [Community vs Pro](../docs/community-vs-pro.md).

For release notes, see [Pro Changelog](CHANGELOG.md) or
[GitHub Releases](https://github.com/HominoITea/undes/releases).
