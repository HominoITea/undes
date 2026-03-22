# Language Spec Guide

This guide shows how to add a new programming language spec to the project.

## Files Involved

- `ai/specs/languages.json` - language registry
- `ai/scripts/language-specs.js` - list/validate/scaffold/add CLI

## Quick Workflow

1. Validate current registry:
```bash
npm run undes:lang:validate
```

2. Generate a scaffold (preview only):
```bash
npm run undes:lang:scaffold -- --id=rust --label=Rust --ext=.rs
```

3. Add a new language entry with TODO patterns:
```bash
npm run undes:lang:add -- --id=rust --label=Rust --ext=.rs
```

4. Open `ai/specs/languages.json` and replace `TODO` regex entries in `symbolPatterns`.

5. Validate again:
```bash
npm run undes:lang:validate
```

6. Verify list:
```bash
npm run undes:lang:list
```

## Schema

Each language in `languages.json`:

```json
{
  "id": "rust",
  "label": "Rust",
  "extensions": [".rs"],
  "symbolPatterns": [
    { "type": "function", "regex": "your-regex", "flags": "g" },
    { "type": "struct", "regex": "your-regex", "flags": "g" }
  ],
  "ignorePatterns": ["**/target/**", "**/*.generated.rs"]
}
```

Rules:
- `id` must match `^[a-z0-9-]+$`
- each extension must start with `.`
- extensions must be unique across languages
- each regex must compile with its flags

## Tips

- Start with minimal patterns:
  - function
  - class/struct/interface
- Keep regex practical in P0. Improve precision later.
- If test files cause noise, add ignore patterns (for example `**/*.spec.*`).
