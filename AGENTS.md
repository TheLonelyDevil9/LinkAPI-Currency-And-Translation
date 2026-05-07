## LinkAPI Userscript Notes

- Always bump the userscript metadata `@version` when changing `LinkAPI USD And English.user.js`; Violentmonkey will report "No update found" if the raw script version does not increase.
- After pushing a userscript fix, verify the raw GitHub URL serves the new `@version` before telling the user to update.
- Usage logs can render on reverted/old layouts without the exact `/console/log` path. Detect that page by route and by stable page text/table headings.
- Do not inject inline `00:00` buttons into the usage logs compact filter grid. They overlap Group/Request ID fields. Use the separate old-layout start-time fallback instead.
- Hide or avoid the floating `USD + EN` pill on Model Marketplace/pricing/model listing surfaces because it can interfere with that UI.
- Keep CC Switch, Cherry Studio, and FluentRead one-click import compatibility intact when changing token-page behavior.
