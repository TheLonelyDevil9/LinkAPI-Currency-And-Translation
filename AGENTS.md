## LinkAPI Userscript Notes

- Always bump the userscript metadata `@version` when changing `LinkAPI USD And English.user.js`; Violentmonkey will report "No update found" if the raw script version does not increase.
- After pushing a userscript fix, verify the raw GitHub URL serves the new `@version` before telling the user to update.
- Usage logs can render on reverted/old layouts without the exact `/console/log` path. Detect that page by route and by stable page text/table headings.
- Do not inject inline `00:00` buttons into the usage logs compact filter grid. They overlap Group/Request ID fields. Use the separate old-layout start-time fallback instead.
- Keep the old-layout `00:00 start` fallback tolerant of unlabeled time inputs; some layouts expose date/time values without stable start labels.
- When removing helper features, also clean stale DOM classes, storage keys, and helper stylesheet rules. The removed model filter once left `.tld-linkapi-cny-usd-hidden-by-model-filter` and `tld-linkapi-cny-usd:model-filter` behind, which could keep models such as GPT-5.5 hidden after updates.
- Keep the redemption-code input/button compaction when supporting old and new layouts. The new layout needs the redemption input capped around `560px` and the redeem button forced back to compact/auto width; rollback compatibility work once removed this helper and made the control stretch again.
- Hide or avoid the floating `USD + EN` pill on Model Marketplace/pricing/model listing surfaces because it can interfere with that UI.
- Keep CC Switch, Cherry Studio, and FluentRead one-click import compatibility intact when changing token-page behavior.
- Table sorting must be scoped to the clicked table/header. Provider multiplier sorting belongs only on the API Key Group/provider column; other headers should use normal first-click ascending, second-click descending sorting without relying on LinkAPI's Asc/Desc menu.
- Persist page settings conservatively in localStorage: remember route-scoped filters, sort state, page controls, and toggles, but do not store API keys, tokens, prompts, messages, redemption codes, credentials, or textarea content.
- Before planning or editing, read `lessons.md` and apply its history-derived guardrails; do not repeat known project mistakes.
