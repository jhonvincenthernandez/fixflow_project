# Agent Instructions: simple-project

## Skill Autoload Rule (highest priority)
- Before acting on any task, scan `.agents/skills/` for a skill matching the task.
- Load the matching skill through your native skill loading mechanism before writing code or prose.
- Follow the loaded skill workflow step by step and satisfy its validation gate.
- Treat a user mention in the form `@skill-id` as an explicit load order.
- Never proceed from memory when a matching skill exists.

## Universal Guardrails
- English language exclusively.
- Zero emojis across all code files, comments, and commit messages.
- Prohibit Latin abbreviations: use 'for example', 'that is', 'and so forth'.
- Prohibit em dashes: use colons, parentheses, or separate sentences.
- Zero hardcoded secrets, connection strings, or unredacted logging output.

## Appearance Vocabulary
- User facing label: Appearance. Do not call it Theme.
- Code, documentation, and UI copy: color scheme, appearance mode, light and dark mode, appearance preference.
- Storage and logic: use `APPEARANCE_KEY`, `data-appearance`, and `data-appearance-opt`. Never introduce `THEME_KEY`, `data-theme`, or theme tokens.
- CSS: color scheme tokens live in `src/theme/global.css`. Components consume semantic `--color-*` tokens only.
