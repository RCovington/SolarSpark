Prompts vs Banners

Definitions
- Prompt: the bottom-typed HUD message shown via `G.showPrompt`. It appears as a typed string near the bottom of the screen and is intended for ongoing mission or pickup messages.
- Banner: a centered large message shown via `G.showMessage`. Use for major events or one-off alerts.

Current behaviors
- Cargo pickups use `G.showPrompt` so pickups appear as prompts (typed) rather than center banners.
- Timed missions assert a stable prompt function to avoid being overwritten by incidental banners or other prompts.

Editing guidance
- Use `G.showPrompt(text)` for player-facing HUD messages that may be repeated or updated (inventory pickups, mission instructions).
- Use `G.showMessage(text)` for distinct center-screen banners (mission complete, critical warnings).

File pointers
- `src/js/items/cargo-item.js` — pickup now calls `G.showPrompt` with collected unit counts and randomized credit bonus.
- `src/js/missions/timed-mission-step.js` — ensures mission prompt remains present while active.
