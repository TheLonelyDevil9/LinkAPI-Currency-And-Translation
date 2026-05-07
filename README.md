# LinkAPI Currency And Translation

Violentmonkey userscript for LinkAPI that converts CNY values to USD and cleans mixed Chinese UI text into English.

## Install

https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js

## Features

- Converts visible CNY/RMB/yuan values to USD with comma grouping, using extra decimals for nonzero sub-cent amounts.
- Adds a floating `USD + EN` / `Original` toggle.
- Watches dynamic page updates, including logs, modals, dashboard cards, and old/new console layouts.
- Cleans stable LinkAPI UI controls, labels, headings, and navigation text with a local glossary.
- Updates `© 2025 LinkAPI` to `© 2026 LinkAPI`.
- Adds `00:00` shortcut buttons beside visible time filter fields, with an old-layout start-time fallback.
- Adds a 30-second auto-refresh toggle on the usage logs page.
- Keeps API Key Group table sorting compatible with the site's built-in Asc/Desc menu when the table layout is present.
- Keeps LinkAPI's CC Switch, Cherry Studio, and FluentRead one-click import templates compatible with the current token page.

## Privacy

The script does not send page text, model names, logs, keys, prompts, or any other data to external services. Translation is glossary-based, limited to stable website UI elements, and runs locally in the browser.

## Updates

Violentmonkey can update this script through the `@updateURL` and `@downloadURL` metadata. If the script is disabled for safety, it will not run on LinkAPI pages, but you can still open the Violentmonkey dashboard and manually check for updates.
