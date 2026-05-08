# LinkAPI History Lessons

Maintained for TLD.

## Scope

- Repository: `TheLonelyDevil9/LinkAPI-Currency-And-Translation`
- Ref reviewed: `main`
- Latest reviewed commit: `a444b8edee1573f494681206353e2f859140f36c`
- Review date: 2026-05-08
- Commits reviewed: 14

## History Shape

This project moved quickly from a basic LinkAPI currency/translation userscript into a compatibility layer for multiple LinkAPI layouts. Nearly every meaningful commit touched `LinkAPI USD And English.user.js`, with later `AGENTS.md` notes added after regressions exposed hidden assumptions.

The durable pattern is that LinkAPI UI details are unstable. Future work should treat routes, labels, dynamic DOM shape, stored browser state, and third-party import menus as compatibility surfaces, not incidental implementation details.

## Lessons

1. Userscript update delivery depends on the metadata version.
   Evidence: `4d1219d`, `ed2365e`, `e22532d`, `a444b8e`.

   Every userscript behavior change must bump `@version`. After pushing or merging, verify the raw GitHub userscript serves the new version before telling the user to update. Violentmonkey will otherwise report that no update is available even when the repository changed.

2. Translate stable site chrome, not user-authored or operational content.
   Evidence: `43b5d46`, `c2c8601`, follow-up project notes.

   Translation fixes repeatedly centered on LinkAPI announcements and mixed slash-separated labels. Preserve the distinction between hardcoded site UI and custom/human-authored content. Avoid broad text mutation that can alter announcements, prompts, logs, model names, keys, or customer-controlled content.

3. Old and new LinkAPI layouts must remain supported together.
   Evidence: `4d1219d`, `8cc37a3`, `e22532d`, `a444b8e`.

   Layout rollback support fixed one era of the site but later risked breaking the returned new layout. Route checks should use both path signals and stable page text/table headings. DOM enhancements should tolerate missing wrappers, alternate labels, hidden inputs, and shifted control rows.

4. The usage-log filter grid is fragile.
   Evidence: `4d1219d`, `8cc37a3`, `a444b8e`.

   Do not inject inline `00:00` buttons into the compact usage-log grid because they overlap Group and Request ID fields. Keep the separate `00:00 start` fallback, and keep it tolerant of unlabeled time-like inputs because some old layouts expose start times without stable start labels.

5. Floating controls must avoid marketplace and pricing surfaces.
   Evidence: `b24fee1`, `8cc37a3`.

   The `USD + EN` pill can collide with dense LinkAPI UI. Hide or avoid it on Model Marketplace, pricing, and model-listing pages, and retest positioning whenever adding floating controls or route-level behavior.

6. Redemption layout compactness is a preserved behavior.
   Evidence: `83ca9a8`, `e22532d`.

   The redemption-code input should stay capped around `560px`, and the Redeem button should remain compact/auto-width. When adding compatibility for a rollback or new layout, verify the redemption row on both eras so a broad flex/layout cleanup does not make the button stretch again.

7. Removed helpers need cleanup code.
   Evidence: `a39a6af`, `47d5778`, `a444b8e`.

   The old model filter left storage, classes, controls, and stylesheet rules behind. Those stale artifacts could keep models such as GPT-5.5 hidden after the feature was removed. When retiring helper features, remove persistent storage keys, DOM classes, injected controls, and update existing helper stylesheets instead of returning early.

8. Third-party import compatibility is part of token-page behavior.
   Evidence: `4d1219d`, README updates.

   CC Switch, Cherry Studio, and FluentRead one-click imports are expected to survive token-page changes. Preserve storage normalization and import-menu behavior when touching API key, chat config, or token-management code.

9. Dynamic LinkAPI pages need idempotent enhancement.
   Evidence: `6f95eee`, `47d5778`, `4d1219d`, `a444b8e`.

   The script runs against dynamic pages, modals, iframes, route changes, and repeated mutation passes. Enhancers should be idempotent, data-attribute guarded, and safe to rerun. Style installation must update existing style nodes when CSS rules change.

10. Documentation should record regressions as guardrails.
    Evidence: `ed2365e`, `e22532d`, `a444b8e`.

    The project started recording durable rules only after update/version, redemption layout, and stale model-filter problems surfaced. Continue turning fixed regressions into concrete agent instructions so future changes can test against them.

11. Table sorting must stay tied to the header the user clicked.
    Evidence: 2026-05-08 sorting regression fix.

    The old Asc/Desc menu hook could apply API-key provider multiplier sorting after unrelated table-header sorts. Keep provider multiplier ranking scoped to the API Key Group/provider column only. Other table headers should use normal first-click ascending, second-click descending behavior, and equal numeric values such as `Unlimited` must compare as ties instead of preserving a previous provider sort order.

12. Persist preferences without persisting sensitive content.
    Evidence: 2026-05-08 page settings persistence fix.

    LocalStorage persistence is useful for route-scoped filters, sort state, page sizes, toggles, and similar UI preferences. It must skip API keys, tokens, secrets, prompts, messages, redemption codes, credentials, and textarea content.

## Agent-First Checks

- Read `AGENTS.md` and this file before planning or editing.
- Check the current userscript version before changing behavior.
- Search the userscript for affected helpers before editing: `installHelperStyles`, `enhanceRedemptionInput`, `enhanceTimeInputs`, `ensureHiddenTimeShortcut`, `removeStaleModelFilterArtifacts`, route detection, and import compatibility code.
- Prefer targeted DOM smoke tests for authenticated LinkAPI pages when browser access is limited.
- For layout changes, test old-layout and new-layout assumptions together.
- For removed features, test both fresh-page behavior and stale localStorage/class/style cleanup.
- For sorting changes, verify provider multiplier sorting, generic header sorting, equal-value ties such as `Unlimited`, and persisted sort restore separately.
- For settings persistence, verify a preference restores and a sensitive field does not get stored.
- Run `node --check "LinkAPI USD And English.user.js"` for script edits.
- Run `git diff --check` before handing off.

## Operating Principles

- Compatibility work is not complete until it preserves the behaviors learned from previous regressions.
- Browser-persistent state is part of the migration surface.
- Narrow selectors and explicit page detection are safer than broad text or layout mutations.
- Documentation changes should be concise, but every repeated mistake deserves a durable guardrail.
