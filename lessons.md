# LinkAPI History Lessons

Maintained for TLD.

## Scope

- Repository: `TheLonelyDevil9/LinkAPI-Currency-And-Translation`
- Ref reviewed: `main`
- Latest reviewed commit: `6f7cace` (Add models.dev price comparison and live CNY/USD rate)
- Review date: 2026-07-03
- Commits reviewed: 27

## History Shape

This project moved quickly from a basic LinkAPI currency/translation userscript into a compatibility layer for multiple LinkAPI layouts. Nearly every meaningful commit touched `LinkAPI USD And English.user.js`, with later `AGENTS.md` notes added after regressions exposed hidden assumptions.

The arc since then: the 3.x series accumulated helpers (translations, sorting, log/dashboard tooling), the 4.1-4.4 series deliberately stripped the script back to currency conversion with an account-menu toggle plus artifact cleanup, 5.0 added live FX rate and models.dev price comparison with hardening, and 6.0 broadened conversion to any target currency, added automatic VAT for detected EU/UK locations, and introduced a floating currency widget.

The durable pattern is that LinkAPI UI details are unstable. Future work should treat routes, labels, dynamic DOM shape, stored browser state, and third-party import menus as compatibility surfaces, not incidental implementation details.

## Lessons

1. Userscript update delivery depends on the metadata version.
   Evidence: `4d1219d`, `ed2365e`, `e22532d`, `a444b8e`.

   Every userscript behavior change must bump `@version`. After pushing or merging, verify the raw GitHub userscript serves the new version before telling the user to update. Violentmonkey will otherwise report that no update is available even when the repository changed.

2. Translate stable site chrome, not user-authored or operational content.
   Evidence: `43b5d46`, `c2c8601`, follow-up project notes.

    Translation fixes repeatedly centered on LinkAPI announcements and mixed slash-separated labels. Preserve the distinction between hardcoded site UI and custom/human-authored content. Avoid broad text mutation that can alter announcements, prompts, logs, model names, keys, or customer-controlled content. (Translation itself was removed in the 4.x slim-down; see lesson 15.)

3. Old and new LinkAPI layouts must remain supported together.
   Evidence: `4d1219d`, `8cc37a3`, `e22532d`, `a444b8e`.

   Layout rollback support fixed one era of the site but later risked breaking the returned new layout. Route checks should use both path signals and stable page text/table headings. DOM enhancements should tolerate missing wrappers, alternate labels, hidden inputs, and shifted control rows.

4. The usage-log filter grid is fragile.
   Evidence: `4d1219d`, `8cc37a3`, `a444b8e`.

    Do not inject inline `00:00` buttons into the compact usage-log grid because they overlap Group and Request ID fields. Keep the separate log helper `00:00 start` control, and keep it tolerant of unlabeled time-like inputs because some old layouts expose start times without stable start labels. (All time helpers were removed in the 4.x slim-down; see lesson 15. This lesson applies only if they return.)

5. Floating controls must avoid marketplace and pricing surfaces.
   Evidence: `b24fee1`, `8cc37a3`.

    The `USD + EN` pill can collide with dense LinkAPI UI. Hide or avoid it on Model Marketplace, pricing, and model-listing pages, and retest positioning whenever adding floating controls or route-level behavior. (The pill was replaced by the account-menu toggle in 4.2; the lesson stands for any future floating control.)

6. Redemption layout compactness is a preserved behavior.
   Evidence: `83ca9a8`, `e22532d`.

   The redemption-code input should stay capped around `560px`, and the Redeem button should remain compact/auto-width. When adding compatibility for a rollback or new layout, verify the redemption row on both eras so a broad flex/layout cleanup does not make the button stretch again.

7. Removed helpers need cleanup code.
   Evidence: `a39a6af`, `47d5778`, `a444b8e`.

   The old model filter left storage, classes, controls, and stylesheet rules behind. Those stale artifacts could keep models such as GPT-5.5 hidden after the feature was removed. When retiring helper features, remove persistent storage keys, DOM classes, injected controls, and update existing helper stylesheets instead of returning early.

8. Third-party import compatibility is part of token-page behavior.
   Evidence: `4d1219d`, README updates.

    CC Switch, Cherry Studio, and FluentRead one-click imports are expected to survive token-page changes. Preserve storage normalization and import-menu behavior when touching API key, chat config, or token-management code. (The normalization hook was removed in 4.1; the current invariant is that the script must not touch the `chats` storage key at all.)

9. Dynamic LinkAPI pages need idempotent enhancement.
   Evidence: `6f95eee`, `47d5778`, `4d1219d`, `a444b8e`.

   The script runs against dynamic pages, modals, iframes, route changes, and repeated mutation passes. Enhancers should be idempotent, data-attribute guarded, and safe to rerun. Style installation must update existing style nodes when CSS rules change.

10. Documentation should record regressions as guardrails.
    Evidence: `ed2365e`, `e22532d`, `a444b8e`.

    The project started recording durable rules only after update/version, redemption layout, and stale model-filter problems surfaced. Continue turning fixed regressions into concrete agent instructions so future changes can test against them.

11. Table sorting must stay tied to the header the user clicked.
    Evidence: 2026-05-08 sorting regression fix.

    The old Asc/Desc menu hook could apply API-key provider multiplier sorting after unrelated table-header sorts. Keep provider multiplier ranking scoped to the API Key Group/provider column only. Other table headers should use normal first-click ascending, second-click descending behavior, and equal numeric values such as `Unlimited` must compare as ties instead of preserving a previous provider sort order. (Table sorting was removed in the 4.x slim-down; see lesson 15. This lesson applies only if it returns.)

12. Persist preferences without persisting sensitive content.
    Evidence: 2026-05-08 page settings persistence fix.

    LocalStorage persistence is useful for route-scoped filters, sort state, page sizes, toggles, and similar UI preferences. It must skip API keys, tokens, secrets, prompts, messages, redemption codes, credentials, and textarea content.

13. Dashboard token totals must use the New API data field.
    Evidence: 2026-05-09 Model Call Analytics token-total helper.

    New API exposes request counts and token usage separately through same-origin `/api/data` and `/api/data/self` responses. Use `token_used` for total-token displays and guard against mismatched dashboard payloads instead of inferring tokens from counts or chart labels. (The token-total helper and its fetch/XHR hooks were removed in the 4.x slim-down; see lesson 15. This lesson applies only if they return.)

14. Dashboard routes must not inherit Usage Logs behavior from sidebar text.
    Evidence: 2026-05-09 dashboard midnight shortcut regression.

    The new UI sidebar keeps Usage Logs labels visible while the user is on `/dashboard/models`. Log-page detection must be route-aware and scoped to main content, or dashboard filter dialogs lose their inline `00:00` shortcuts. (Log-page detection and the shortcuts were removed in the 4.x slim-down; see lesson 15. This lesson applies only if route-scoped helpers return.)

15. Feature removals are deliberate scope decisions, not gaps.
    Evidence: `197b0ff`, `27224b9`, `784bd17` (4.1-4.4 slim-down).

    Translations, table sorting, log auto-refresh, time shortcuts, dashboard analytics hooks, the model filter, and the floating pill were removed on purpose in favor of a currency-only scope with an account-menu toggle. `removeStaleArtifacts` cleans their leftovers. Reintroducing any of them needs explicit user direction plus the cleanup guardrails from lesson 7.

16. External endpoints need shape-pinned parsing and deterministic test seeding.
    Evidence: `6f7cace` (v5.0 live FX port).

    frankfurter.dev v1 `latest` returns `{rates:{...}}` while v2 `/rates` returns an array of `{quote, rate}` objects. An early draft of this feature pointed v1-shaped parsing at the v2 endpoint, and its silent catch meant it always fell back to a stale pinned rate without anyone noticing. Pin the endpoint and response shape together, validate the parsed rate, and keep a pinned fallback so conversion never silently depends on a stale or missing rate.

17. DOM annotations inside `document.body` must be idempotent under the MutationObserver.
    Evidence: `6f7cace` (v5.0 models.dev port).

    Injected notes re-trigger the body observer, so unconditional clear-and-reappend rendering loops enhancement passes every animation frame. `syncPriceNotes` only rewrites notes when their content actually changed. Injected style elements avoid the problem differently: they live under `document.documentElement`, outside the observed body subtree.

18. Fuzzy model matching must stay auditable.
    Evidence: `6f7cace` (v5.0 models.dev port).

    models.dev matching scores exact, suffix, substring, and token-overlap candidates against a threshold, and substring matches can pick a sibling model when the exact id is missing from the catalog. Every note tooltip names the matched models.dev `fullId` so a wrong match is visible on hover instead of silently mispricing a model.

## Agent-First Checks

- Read `AGENTS.md` and this file before planning or editing.
- Check the current userscript version before changing behavior.
- Search the userscript for affected helpers before editing: `convertText`, `processSplitCurrencyElements`, `installHelperStyles`, `enhanceRedemptionInput`, `removeStaleArtifacts`, `placeMenuToggle`, `loadCachedFxRate`/`refreshCnyToUsdRate`, `enhanceModelsDevPricing`, `syncPriceNotes`, and the settings-persistence code.
- Prefer targeted DOM smoke tests for authenticated LinkAPI pages when browser access is limited.
- For layout changes, test old-layout and new-layout assumptions together.
- For removed features, test both fresh-page behavior and stale localStorage/class/style cleanup.
- For FX or models.dev changes, verify the cached path, the fetch path with a stubbed `fetch`, re-conversion after a rate change, and annotation idempotency across mutation passes.
- For settings persistence, verify a preference restores and a sensitive field does not get stored.
- Run `node --check "LinkAPI USD And English.user.js"` for script edits.
- Verify behavior against a live LinkAPI page (or a saved DOM fixture) before telling the user to update.
- Run `git diff --check` before handing off.

## Operating Principles

- Compatibility work is not complete until it preserves the behaviors learned from previous regressions.
- Browser-persistent state is part of the migration surface.
- Narrow selectors and explicit page detection are safer than broad text or layout mutations.
- Documentation changes should be concise, but every repeated mistake deserves a durable guardrail.
