# Code Patterns & Standards

Use this file to define the "Gold Standard" for your code. The AI will read this before every task.

## 1. General Style
- Indentation: 2 spaces
- Semicolons: Always
- Quotes: Single quotes preferred

## 2. Naming Conventions
- Classes: PascalCase
- Variables: camelCase
- Constants: UPPER_SNAKE_CASE

## 3. Architecture (Example for React)
- Components must be functional.
- Use hooks for logic.
- CSS Modules for styling.

## 4. Architecture (Example for .NET)
- Use Dependency Injection.
- Controllers should be thin.
- Business logic goes into Services.

## 5. Discussion Workflow Pattern
- Use `ai/design/DISCUSSION_PATTERN.md` as the standard process for multi-model discussions.
- Required outputs per cycle: `tasks.txt` -> `final.txt` -> `draft_code.txt` -> `version0.md`.
- Always add history redirect markers in old discussion files after consolidation.
