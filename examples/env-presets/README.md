# Runtime Env Presets

Ready-to-use runtime tuning presets for the multi-agent pipeline.

## Files

- `economy.env` - lowest cost / lowest token usage
- `balanced.env` - recommended default
- `max-quality.env` - higher quality, slower and more expensive

## Apply (Linux/macOS/Git Bash)

```bash
cp .ai.env.example .ai.env
cat examples/env-presets/balanced.env >> .ai.env
```

Then set real API keys in `.ai.env`.

## Apply (PowerShell)

```powershell
Copy-Item .ai.env.example .ai.env
Get-Content examples/env-presets/balanced.env | Add-Content .ai.env
```

## Notes

- Presets are additive fragments (no keys inside).
- They use scoped runtime settings:
  - `AI_CFG__AGENT__...`
  - `AI_CFG__MODEL__...`
  - `AI_CFG__PROVIDER__...`
  - `AI_CFG__DEFAULT__...`
