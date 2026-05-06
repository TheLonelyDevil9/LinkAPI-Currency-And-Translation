# LinkAPI Currency And Translation

Violentmonkey userscript for LinkAPI that converts CNY values to USD and cleans mixed Chinese UI text into English.

## Install

https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js

## Features

- Converts visible CNY/RMB/yuan values to USD with comma grouping, using extra decimals for nonzero sub-cent amounts.
- Adds a floating `USD + EN` / `Original` toggle.
- Watches dynamic page updates, including logs, modals, dashboard cards, and announcements.
- Cleans mixed Chinese/English LinkAPI UI text with a local glossary.
- Translates known Timeline/FAQ announcement text without calling any external translation API.
- Updates `© 2025 LinkAPI` to `© 2026 LinkAPI`.
- Adds `00:00` shortcut buttons beside detected time filter fields.
- Adds a local model string filter to the dashboard filter modal.
- Fixes API Key Group sorting through the site's built-in Asc/Desc menu by sorting ratios numerically with Auto first/last.
- Improves the wallet redemption placeholder and reduces the input width.

## Privacy

The script does not send page text, model names, logs, keys, prompts, or any other data to external services. Translation is glossary-based and runs locally in the browser. The model filter only string-matches text already loaded in the page DOM and hides non-matching rendered rows.

## Updates

Violentmonkey can update this script through the `@updateURL` and `@downloadURL` metadata. If the script is disabled for safety, it will not run on LinkAPI pages, but you can still open the Violentmonkey dashboard and manually check for updates.
