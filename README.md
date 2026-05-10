# LinkAPI Currency Helper

Violentmonkey userscript for LinkAPI that converts visible CNY/RMB/yuan values to USD while keeping the page otherwise close to native LinkAPI behavior.

## Install

https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js

## Features

- Converts visible CNY/RMB/yuan values to USD with comma grouping, using extra decimals for nonzero sub-cent amounts.
- Replaces `(CNY)` and `(RMB)` labels with `(USD)`.
- Updates `© 2025 LinkAPI` to `© 2026 LinkAPI`.
- Adds a compact `USD` / `CNY` toggle for quick comparison with original LinkAPI values.
- Watches dynamic page updates so newly rendered prices are converted while the toggle is in USD mode.
- Persists safe route-scoped page controls such as filters, selects, and view options.
- Avoids storing API keys, tokens, prompts, messages, redemption codes, credentials, passwords, textarea content, or other secret-like values.
- Keeps the redemption-code input/button row compact on old and new wallet layouts.
- Cleans stale DOM and localStorage artifacts from older helper features that were removed.

## Removed Scope

The script intentionally no longer translates Chinese UI text, patches `fetch`/`XMLHttpRequest`, adds dashboard token totals, adds `00:00` time shortcuts, auto-refreshes usage logs, sorts tables, suppresses LinkAPI sort menus, or repairs third-party chat import templates.

If the userscript is disabled in the userscript manager, reload the LinkAPI page to return to the original site output.

## Validation

Tracked smoke fixtures live under `tests/fixtures/`. With the documented shared Chrome CDP instance running at `http://127.0.0.1:9222`, run:

```bash
node tests/smoke-new-ui.mjs
```

## Privacy

The script does not send page text, model names, logs, keys, prompts, or any other data to external services. Currency conversion runs locally in the browser. Page settings persistence is localStorage-only and skips sensitive fields.

## Updates

Violentmonkey can update this script through the `@updateURL` and `@downloadURL` metadata. Every userscript behavior change must bump the metadata `@version`.
