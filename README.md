# LinkAPI Currency And Translation

Violentmonkey userscript for LinkAPI that converts CNY values to USD and cleans mixed Chinese UI text into English.

## Install

https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js

## Features

- Converts visible CNY/RMB/yuan values to USD with comma grouping, using extra decimals for nonzero sub-cent amounts.
- Adds a floating `USD + EN` / `Original` toggle.
- Watches dynamic page updates, including logs, modals, dashboard cards, and old/new console layouts. Helper controls continue attaching even when conversion is toggled to `Original`.
- Cleans stable LinkAPI UI controls, labels, headings, and navigation text with a local glossary.
- Updates `© 2025 LinkAPI` to `© 2026 LinkAPI`.
- Adds `00:00` shortcut buttons beside safe visible time fields, including dashboard custom time controls when a supported midnight option is available.
- Shows `Tokens: ...` beside the Model Call Analytics `Total:` value when the loaded dashboard API data includes `token_used`.
- Keeps Usage Logs compact filter grids free of inline shortcuts and instead adds a visible `00:00 start` control beside the log helper controls, with an old-layout start-time fallback for unlabeled time fields.
- Adds a grouped 30-second auto-refresh toggle on the Usage Logs page.
- Keeps table sorting on direct header clicks while suppressing the new UI's Asc/Desc/Hide popup path.
- Keeps redemption-code input/button layout compact on old and new wallet layouts.
- Keeps LinkAPI's CC Switch, Cherry Studio, and FluentRead one-click import templates compatible with the current token page.

## Validation

Tracked smoke fixtures live under `tests/fixtures/`. With the documented shared Chrome CDP instance running at `http://127.0.0.1:9222`, run:

```bash
node tests/smoke-new-ui.mjs
```

## Privacy

The script does not send page text, model names, logs, keys, prompts, or any other data to external services. Translation is glossary-based, limited to stable website UI elements, and runs locally in the browser. Dashboard token totals are aggregated in memory from the current `/api/data` or `/api/data/self` response; raw dashboard rows are not stored.

## Updates

Violentmonkey can update this script through the `@updateURL` and `@downloadURL` metadata. If the script is disabled for safety, it will not run on LinkAPI pages, but you can still open the Violentmonkey dashboard and manually check for updates.
