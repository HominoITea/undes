# Community CLI

Community is the command-line package for Undes.

## Install

```bash
npm install -g @undes/cli
undes --help
```

## Expected Use

Run Undes on a small repository or focused task first:

```bash
undes run --project-path=/path/to/project --prompt="Implement a small validated change and explain the remaining risks"
```

For first runs, prefer a prompt that can be checked in one sitting:

```text
Find why this validation path accepts invalid input. Propose a minimal fix and tests, and clearly mark any open assumptions.
```

## Community Scope

Community provides the core product workflow:

- local-first execution;
- bring your own model keys;
- generated-and-verified engineering artifacts;
- basic trust diagnostics.

## Related Docs

- [Getting Started](getting-started.md)
- [Artifacts](artifacts.md)
- [Use Cases](use-cases.md)
- [FAQ](faq.md)
