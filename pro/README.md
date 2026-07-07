# Undes Pro

Undes Pro is the paid local CLI for evidence-checked AI engineering work: run
AI-generated code, patches, refactors, and architecture decisions through
evidence, critique, risk, and trust-verdict checks before merge.

It also adds the Pro terminal UI, local run history, Engineering Memory,
expanded provider routing, and license-gated execution.

Pro access and license purchase details are handled at
[undes.app/pricing](https://undes.app/pricing).

Install:

```bash
npm install -g @undes.ai/cli-pro
undes-pro --help
```

Check the currently published Pro version:

```bash
npm view @undes.ai/cli-pro version
```

Pro requires a valid Undes Pro license and the platform native verification
package installed by npm for your operating system. If the native verifier is
missing, mismatched, or the license is invalid, license-gated commands fail
closed.

## Docs

- [Pro CLI](cli.md)
- [Pro Changelog](CHANGELOG.md)
- [Run Pro through Claude Code and Codex CLI](external-cli-setup.md)
- [Community vs Pro](../docs/community-vs-pro.md)
- [Pricing and license access](https://undes.app/pricing)

Team and Enterprise usage is handled through direct discussion for now. These
docs do not commit to a public Team package, Enterprise install path, hosted
workflow, SSO/RBAC, CI gate, or self-hosted deployment surface.
