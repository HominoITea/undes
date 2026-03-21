# Project Knowledge Base (Lessons Learned)

> **INSTRUCTION:** This file is for "Tribal Knowledge" — things that are not obvious from the code but are critical to know.
> Add known bugs, weird API behaviors, and architectural constraints here.

## ⚠️ Critical Gotchas
(Add your project's gotchas here. Example:)
### 1. Database Connection
- **Issue:** Connection timeout on the first cold start.
- **Solution:** Implement a retry policy with exponential backoff.

## 🐛 Known Bugs & Fixes History
| Date | Component | Issue | Fix Pattern |
|------|-----------|-------|-------------|
| YYYY-MM-DD | Core | Example Bug | Example Fix |

## 🏗️ Architectural Constraints
- **Styling:** (e.g., Do not use inline styles)
- **Deps:** (e.g., Do not add new libraries without approval)
