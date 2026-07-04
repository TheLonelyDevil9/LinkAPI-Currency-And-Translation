# LinkAPI Currency Helper

Violentmonkey userscript for LinkAPI that converts visible CNY/RMB/yuan values to a target currency (defaulting to your local currency) while keeping the page otherwise close to native LinkAPI behavior.

## Install

https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js

## Features

- Converts visible CNY/RMB/yuan values to a target currency with locale-aware formatting, using extra decimals for nonzero sub-cent amounts.
- Defaults to your detected local currency and lets you pick any supported target currency from a floating widget. Applies automatic VAT for detected EU/UK locations on payable amounts.
- Uses live CNY reference rates from frankfurter.dev, cached briefly in localStorage, with a pinned fallback rate when the rate service is unreachable. The account-menu control tooltip shows the active rate, its date, and detected location/VAT.
- Compares LinkAPI model pricing with official models.dev pricing on pricing and model detail surfaces: official per-1M prices under table headers, percentage cheaper/pricier notes on price cells, and break-even token estimates for fixed per-request pricing. Tooltips name the matched models.dev model id so mismatches are easy to spot.
- Replaces `(CNY)` and `(RMB)` labels with the active target currency.
- Adds a stable `Show USD values` entry in the account menu for quick comparison with original LinkAPI values.
- Watches dynamic page updates so newly rendered prices are converted while the toggle is on.
- Persists safe route-scoped page controls such as filters, selects, and view options.
- Avoids storing API keys, tokens, prompts, messages, redemption codes, credentials, passwords, textarea content, or other secret-like values.
- Keeps the redemption-code input/button row compact on old and new wallet layouts.
- Cleans stale DOM and localStorage artifacts from older helper features that were removed.

## Privacy

The script sends no page text, model names, logs, keys, prompts, or other page data to external services. It makes three outbound GET requests with no request payload: CNY reference rates from `api.frankfurter.dev`, the public model pricing catalog from `models.dev` (cached 12 hours, only on pricing/model surfaces), and a one-time location lookup from `ipapi.co` (cached 24 hours, used only for the default currency and VAT rate, with a timezone-based fallback when unreachable). Model-name matching against that catalog runs locally in the browser. Page settings persistence is localStorage-only and skips sensitive fields.

## Updates

Violentmonkey can update this script through the `@updateURL` and `@downloadURL` metadata. Every userscript behavior change must bump the metadata `@version`.
