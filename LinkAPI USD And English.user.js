// ==UserScript==
// @name         LinkAPI USD And English
// @namespace    https://violentmonkey.github.io/
// @version      4.1
// @description  Convert LinkAPI CNY values to USD with a lightweight comparison toggle
// @author       TheLonelyDevil
// @updateURL    https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js
// @downloadURL  https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js
// @match        https://api.linkapi.ai/*
// @match        https://linkapi.ai/*
// @match        https://hk.linkapi.ai/*
// @match        https://jp.linkapi.ai/*
// @match        https://home.linkapi.ai/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_ID = 'tld-linkapi-cny-usd';
    const STORAGE_KEY = `${SCRIPT_ID}:enabled`;
    const PAGE_SETTINGS_STORAGE_KEY = `${SCRIPT_ID}:page-settings:v1`;
    const HELPER_STYLE_ID = `${SCRIPT_ID}-helper-style`;
    const TOGGLE_STYLE_ID = `${SCRIPT_ID}-style`;
    const CNY_TO_USD_RATE = 0.146201;

    const PREFIX_CNY_PATTERN = /(?<![\w$])(?:CNY|RMB|CN¥|CN￥|¥|￥|人民币)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?!\s*(?:CNY|RMB|元)?\s*\))/gi;
    const SUFFIX_CNY_PATTERN = /(?<![\w$])([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:CNY|RMB|人民币|元)(?!\s*\))/gi;
    const CNY_UNIT_LABEL_PATTERN = /\((?:CNY|RMB)\)/gi;
    const COPYRIGHT_YEAR_PATTERN = /©\s*2025(?=\s*LinkAPI)/g;
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE']);

    let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    let observer = null;
    let processQueued = false;
    let enhancementQueued = false;
    let toggleButton = null;
    let togglePlacementQueued = false;
    let pageSettingRestoreInProgress = false;

    function toNumber(rawAmount) {
        return Number(rawAmount.replace(/,/g, ''));
    }

    function formatUsd(cnyValue) {
        const usdValue = cnyValue * CNY_TO_USD_RATE;
        const absUsdValue = Math.abs(usdValue);
        const maximumFractionDigits = absUsdValue > 0 && absUsdValue < 0.01
            ? Math.min(Math.max(Math.ceil(-Math.log10(absUsdValue)) + 2, 6), 8)
            : 2;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits
        }).format(usdValue);
    }

    function normalizeWhitespace(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeInputValue(value) {
        return String(value || '').toLowerCase().trim();
    }

    function convertText(text) {
        const replaceAmount = (match, rawAmount) => {
            const cnyValue = toNumber(rawAmount);
            return Number.isFinite(cnyValue) ? formatUsd(cnyValue) : match;
        };

        return String(text || '')
            .replace(PREFIX_CNY_PATTERN, replaceAmount)
            .replace(SUFFIX_CNY_PATTERN, replaceAmount)
            .replace(CNY_UNIT_LABEL_PATTERN, '(USD)')
            .replace(COPYRIGHT_YEAR_PATTERN, '© 2026');
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        return !parent
            || SKIP_TAGS.has(parent.tagName)
            || Boolean(parent.closest(`#${SCRIPT_ID}-toggle, .${SCRIPT_ID}-control`));
    }

    function processTextNode(node) {
        if (shouldSkipNode(node)) {
            return;
        }

        const originalText = node.__tldLinkApiOriginalText ?? node.textContent;
        const convertedText = convertText(originalText);
        if (convertedText === originalText) {
            return;
        }

        node.__tldLinkApiOriginalText = originalText;
        if (node.textContent !== convertedText) {
            node.textContent = convertedText;
        }
    }

    function restoreTextNode(node) {
        if (node.__tldLinkApiOriginalText !== undefined && node.textContent !== node.__tldLinkApiOriginalText) {
            node.textContent = node.__tldLinkApiOriginalText;
        }
    }

    function walkTextNodes(root, visitor) {
        if (!root) {
            return;
        }

        if (root.nodeType === Node.TEXT_NODE) {
            visitor(root);
            return;
        }

        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
            return;
        }

        if (root.nodeType === Node.ELEMENT_NODE && (SKIP_TAGS.has(root.tagName) || root.id === `${SCRIPT_ID}-toggle`)) {
            return;
        }

        const ownerDocument = root.ownerDocument || document;
        const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }
        textNodes.forEach(visitor);
    }

    function processRoot(root = document.body) {
        if (!root) {
            return;
        }

        walkTextNodes(root, enabled ? processTextNode : restoreTextNode);
    }

    function processAccessibleFrames() {
        Array.from(document.querySelectorAll('iframe')).forEach((frame) => {
            try {
                if (frame.contentDocument?.body) {
                    processRoot(frame.contentDocument.body);
                }
            } catch (_) {
                // Cross-origin frames are intentionally ignored.
            }
        });
    }

    function queueProcess() {
        if (processQueued) {
            return;
        }

        processQueued = true;
        requestAnimationFrame(() => {
            processQueued = false;
            processRoot();
            processAccessibleFrames();
            queueEnhancements();
        });
    }

    function setInputValue(input, value) {
        const prototype = input instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : input instanceof HTMLTextAreaElement
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (nativeSetter) {
            nativeSetter.call(input, value);
        } else {
            input.value = value;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function safeReadJsonStorage(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key) || '') || fallback;
        } catch (_) {
            return fallback;
        }
    }

    function safeWriteJsonStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_) {
            // Storage can be unavailable or full; page behavior should continue.
        }
    }

    function getRouteSettingsKey() {
        return `${window.location.origin}${window.location.pathname}`;
    }

    function getPageSettingsStore() {
        const store = safeReadJsonStorage(PAGE_SETTINGS_STORAGE_KEY, {});
        return store && typeof store === 'object' && !Array.isArray(store) ? store : {};
    }

    function writePageSettingsStore(store) {
        safeWriteJsonStorage(PAGE_SETTINGS_STORAGE_KEY, store);
    }

    function getCurrentRouteSettings() {
        const store = getPageSettingsStore();
        const routeSettings = store[getRouteSettingsKey()];
        return routeSettings && typeof routeSettings === 'object' && !Array.isArray(routeSettings) ? routeSettings : {};
    }

    function updateCurrentRouteSettings(updater) {
        const store = getPageSettingsStore();
        const routeKey = getRouteSettingsKey();
        const routeSettings = store[routeKey] && typeof store[routeKey] === 'object' && !Array.isArray(store[routeKey])
            ? store[routeKey]
            : {};
        const nextRouteSettings = updater(routeSettings) || routeSettings;
        delete nextRouteSettings.tableSorts;
        store[routeKey] = nextRouteSettings;
        writePageSettingsStore(store);
    }

    function escapeCssIdentifier(value) {
        if (window.CSS?.escape) {
            return CSS.escape(value);
        }

        return String(value).replace(/["\\]/g, '\\$&');
    }

    function getElementLabelText(element) {
        const explicitLabels = element.id ? Array.from(document.querySelectorAll(`label[for="${escapeCssIdentifier(element.id)}"]`)) : [];
        const wrappingLabel = element.closest('label');
        const ariaLabelledBy = (element.getAttribute('aria-labelledby') || '')
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent || '')
            .join(' ');
        const nearbyText = [
            element.getAttribute('aria-label'),
            element.name,
            element.id,
            element.placeholder,
            explicitLabels.map((label) => label.textContent || '').join(' '),
            wrappingLabel?.textContent,
            ariaLabelledBy
        ].filter(Boolean).join(' ');

        return normalizeWhitespace(nearbyText).toLowerCase();
    }

    function isSensitivePageControl(element) {
        const text = getElementLabelText(element);
        const value = element instanceof HTMLSelectElement ? '' : String(element.value || '').toLowerCase();
        return /api\s*key|\bkey\b|secret|token|password|sk-|prompt|message|content|redemption code|redeem|access\s*key|private|credential|authorization|bearer/.test(text)
            || /(?:^|\s)(?:sk-|pk-)[a-z0-9_-]{8,}|bearer\s+[a-z0-9._-]{12,}|[a-z0-9_-]{32,}/i.test(value);
    }

    function isLikelyPersistentSettingLabel(text) {
        return /filter|search|query|page|size|limit|mode|type|status|enable|disable|toggle|option|view|show|hide|from|to|start|end|min|max|date|time|interval|range|group|model|provider|quota|rate|multiplier|refresh|auto|days|week|month/.test(normalizeWhitespace(text).toLowerCase());
    }

    function getPageControlKey(element) {
        const label = getElementLabelText(element);
        if (!label) {
            return '';
        }

        const type = element instanceof HTMLInputElement ? normalizeInputValue(element.type || 'text') : element.tagName.toLowerCase();
        const form = element.closest('form');
        const formLabel = form
            ? normalizeWhitespace(form.getAttribute('aria-label') || form.id || form.className || '').toLowerCase()
            : '';
        const siblingIndex = Array.from(document.querySelectorAll(element.tagName.toLowerCase())).indexOf(element);
        return `${type}:${formLabel}:${label}:${siblingIndex}`;
    }

    function shouldPersistPageControl(element) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) {
            return false;
        }

        if (element.disabled || element.readOnly || element.closest(`#${SCRIPT_ID}-toggle, .${SCRIPT_ID}-control`)) {
            return false;
        }

        if (isSensitivePageControl(element)) {
            return false;
        }

        if (element instanceof HTMLTextAreaElement) {
            return false;
        }

        if (element instanceof HTMLInputElement) {
            const type = normalizeInputValue(element.type || 'text');
            if (/^(?:button|submit|reset|file|password|hidden)$/i.test(type)) {
                return false;
            }

            if (/^(?:checkbox|radio|number|range|date|time|datetime-local|month|week|color)$/i.test(type)) {
                return true;
            }

            return isLikelyPersistentSettingLabel(getElementLabelText(element));
        }

        return Boolean(getPageControlKey(element));
    }

    function readPageControlValue(element) {
        if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
            return element.checked;
        }

        return element.value;
    }

    function applyPageControlValue(element, value) {
        if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
            if (element.checked !== Boolean(value)) {
                element.checked = Boolean(value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
        }

        if (typeof value !== 'string' || element.value === value) {
            return;
        }

        setInputValue(element, value);
    }

    function rememberPageControlValue(element) {
        if (pageSettingRestoreInProgress || !shouldPersistPageControl(element)) {
            return;
        }

        const key = getPageControlKey(element);
        const value = readPageControlValue(element);
        updateCurrentRouteSettings((routeSettings) => {
            routeSettings.controls = routeSettings.controls && typeof routeSettings.controls === 'object'
                ? routeSettings.controls
                : {};
            routeSettings.controls[key] = value;
            return routeSettings;
        });
    }

    function restorePageControlValues() {
        const controls = getCurrentRouteSettings().controls || {};
        if (!controls || typeof controls !== 'object') {
            return;
        }

        pageSettingRestoreInProgress = true;
        try {
            for (const element of document.querySelectorAll('input, select, textarea')) {
                if (!shouldPersistPageControl(element)) {
                    continue;
                }

                const key = getPageControlKey(element);
                const restoreMark = `${getRouteSettingsKey()}::${key}`;
                if (element.getAttribute(`data-${SCRIPT_ID}-setting-restored`) === restoreMark) {
                    continue;
                }

                if (Object.prototype.hasOwnProperty.call(controls, key)) {
                    applyPageControlValue(element, controls[key]);
                    element.setAttribute(`data-${SCRIPT_ID}-setting-restored`, restoreMark);
                }
            }
        } finally {
            pageSettingRestoreInProgress = false;
        }
    }

    function handlePageControlChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        if (event.type === 'input' && target instanceof HTMLInputElement) {
            const type = normalizeInputValue(target.type || 'text');
            if (!/^(?:checkbox|radio|range|color|number)$/i.test(type)) {
                return;
            }
        }

        rememberPageControlValue(target);
    }

    function findInputs({ visibleOnly = true } = {}) {
        return Array.from(document.querySelectorAll('input')).filter((input) => {
            if (input.type === 'hidden' || input.disabled) {
                return false;
            }

            return !visibleOnly || isElementVisible(input);
        });
    }

    function isElementVisible(element) {
        if (!element || !document.body.contains(element)) {
            return false;
        }

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function findRedemptionControlRow(input, wrapper) {
        let node = wrapper || input.parentElement;
        for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
            const inputCount = node.querySelectorAll('input').length;
            const buttonCount = node.querySelectorAll('button').length;
            if (inputCount <= 2 && buttonCount > 0 && buttonCount <= 3) {
                return node;
            }
        }

        return wrapper;
    }

    function enhanceRedemptionInput() {
        for (const input of findInputs({ visibleOnly: false })) {
            const placeholder = normalizeInputValue(input.placeholder);
            if (!placeholder.includes('redemption code') && input.getAttribute(`data-${SCRIPT_ID}-redeem`) !== 'true') {
                continue;
            }

            input.placeholder = 'Enter your redemption code here';
            input.setAttribute(`data-${SCRIPT_ID}-redeem`, 'true');
            const wrapper = input.closest('div');
            if (!wrapper) {
                continue;
            }

            const controlRow = findRedemptionControlRow(input, wrapper);
            if (controlRow) {
                controlRow.setAttribute(`data-${SCRIPT_ID}-redeem-wrap`, 'true');
            }

            if (wrapper !== controlRow) {
                wrapper.setAttribute(`data-${SCRIPT_ID}-redeem-input-wrap`, 'true');
            }
        }
    }

    function installHelperStyles() {
        const existingStyle = document.getElementById(HELPER_STYLE_ID);
        const style = existingStyle || document.createElement('style');
        style.id = HELPER_STYLE_ID;
        style.textContent = `
            [data-${SCRIPT_ID}-redeem="true"] {
                width: 100% !important;
                max-width: 560px !important;
            }

            [data-${SCRIPT_ID}-redeem-input-wrap="true"] {
                flex: 0 1 560px !important;
                max-width: 100% !important;
            }

            [data-${SCRIPT_ID}-redeem-wrap="true"] {
                box-sizing: border-box !important;
                display: flex !important;
                align-items: center !important;
                justify-content: flex-start !important;
                flex-wrap: wrap !important;
                gap: 12px !important;
            }

            [data-${SCRIPT_ID}-redeem-wrap="true"] button {
                flex: 0 0 auto !important;
                margin-left: 0 !important;
                width: auto !important;
                white-space: nowrap !important;
            }
        `;

        if (!existingStyle) {
            document.documentElement.appendChild(style);
        }
    }

    function removeStaleArtifacts() {
        try {
            localStorage.removeItem(`${SCRIPT_ID}:log-auto-refresh`);
            localStorage.removeItem(`${SCRIPT_ID}:model-filter`);
        } catch (_) {
            // Storage can be unavailable in hardened browser contexts.
        }

        [
            `${SCRIPT_ID}-time-shortcut`,
            `${SCRIPT_ID}-log-helper`,
            `${SCRIPT_ID}-log-refresh`,
            `${SCRIPT_ID}-dashboard-token-total`
        ].forEach((id) => document.getElementById(id)?.remove());

        document.querySelectorAll([
            `.${SCRIPT_ID}-midnight-button`,
            `.${SCRIPT_ID}-model-filter`,
            `.${SCRIPT_ID}-dialog-model-filter-wrap`,
            `.${SCRIPT_ID}-api-info-label`
        ].join(',')).forEach((element) => element.remove());

        document.querySelectorAll(`.${SCRIPT_ID}-hidden-by-model-filter`).forEach((element) => {
            element.classList.remove(`${SCRIPT_ID}-hidden-by-model-filter`);
        });

        document.querySelectorAll([
            `[data-${SCRIPT_ID}-midnight-bound]`,
            `[data-${SCRIPT_ID}-dashboard-filter-dialog]`,
            `[data-${SCRIPT_ID}-quick-range-row]`,
            `[data-${SCRIPT_ID}-sort-bound]`,
            `[data-${SCRIPT_ID}-sort-key]`,
            `[data-${SCRIPT_ID}-sort-dir]`,
            `[data-${SCRIPT_ID}-sort-applied]`,
            `button[data-${SCRIPT_ID}-api-info-button="true"]`
        ].join(',')).forEach((element) => {
            element.removeAttribute(`data-${SCRIPT_ID}-midnight-bound`);
            element.removeAttribute(`data-${SCRIPT_ID}-dashboard-filter-dialog`);
            element.removeAttribute(`data-${SCRIPT_ID}-quick-range-row`);
            element.removeAttribute(`data-${SCRIPT_ID}-sort-bound`);
            element.removeAttribute(`data-${SCRIPT_ID}-sort-key`);
            element.removeAttribute(`data-${SCRIPT_ID}-sort-dir`);
            element.removeAttribute(`data-${SCRIPT_ID}-sort-applied`);
            element.removeAttribute(`data-${SCRIPT_ID}-api-info-button`);

            if (element.getAttribute('title') === 'Click to sort by provider multiplier'
                || element.getAttribute('title') === 'Click to sort ascending, click again for descending') {
                element.removeAttribute('title');
            }

            if (element.getAttribute('aria-sort')) {
                element.removeAttribute('aria-sort');
            }
        });

        const settingsStore = getPageSettingsStore();
        let changed = false;
        Object.values(settingsStore).forEach((routeSettings) => {
            if (routeSettings && typeof routeSettings === 'object' && !Array.isArray(routeSettings) && routeSettings.tableSorts) {
                delete routeSettings.tableSorts;
                changed = true;
            }
        });

        if (changed) {
            writePageSettingsStore(settingsStore);
        }
    }

    function enhancePage() {
        installHelperStyles();
        enhanceRedemptionInput();
        restorePageControlValues();
        removeStaleArtifacts();
        updateToggle();
    }

    function queueEnhancements() {
        if (enhancementQueued) {
            return;
        }

        enhancementQueued = true;
        requestAnimationFrame(() => {
            enhancementQueued = false;
            enhancePage();
            queueTogglePlacement();
        });
    }

    function getElementOwnText(element) {
        return normalizeWhitespace(Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent)
            .join(' '));
    }

    function getElementAccessibleText(element) {
        return normalizeWhitespace([
            getElementOwnText(element),
            element.getAttribute?.('aria-label') || '',
            element.getAttribute?.('title') || ''
        ].filter(Boolean).join(' '));
    }

    function isHomeNavItem(element) {
        if (!element || !isElementVisible(element)) {
            return false;
        }

        const text = getElementAccessibleText(element).toLowerCase();
        if (text !== 'home' && text !== '首页') {
            return false;
        }

        const href = element.getAttribute?.('href') || '';
        return !href || href === '/' || /(?:^|\/)(?:home|console)?(?:[?#].*)?$/.test(href);
    }

    function findHomeNavItem() {
        return Array.from(document.querySelectorAll('header a, header button, nav a, nav button, [role="navigation"] a, [role="navigation"] button'))
            .find(isHomeNavItem) || null;
    }

    function placeToggle() {
        if (!toggleButton) {
            return;
        }

        const homeItem = findHomeNavItem();
        if (homeItem) {
            toggleButton.classList.remove(`${SCRIPT_ID}-fallback`);
            toggleButton.classList.add(`${SCRIPT_ID}-nav`);
            toggleButton.style.removeProperty('--tld-linkapi-toggle-left');
            homeItem.insertAdjacentElement('afterend', toggleButton);
            return;
        }

        toggleButton.classList.remove(`${SCRIPT_ID}-nav`);
        toggleButton.classList.add(`${SCRIPT_ID}-fallback`);
        const firstNavItem = Array.from(document.querySelectorAll('header a, nav a, [role="navigation"] a'))
            .filter((element) => element !== toggleButton)
            .filter(isElementVisible)
            .sort((left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left)[0];
        const leftOffset = firstNavItem ? Math.max(12, Math.round(firstNavItem.getBoundingClientRect().right + 12)) : 16;
        toggleButton.style.setProperty('--tld-linkapi-toggle-left', `${leftOffset}px`);
        if (toggleButton.parentElement !== document.documentElement) {
            document.documentElement.appendChild(toggleButton);
        }
    }

    function queueTogglePlacement() {
        if (togglePlacementQueued) {
            return;
        }

        togglePlacementQueued = true;
        requestAnimationFrame(() => {
            togglePlacementQueued = false;
            placeToggle();
        });
    }

    function updateToggle() {
        if (!toggleButton) {
            return;
        }

        toggleButton.setAttribute('aria-pressed', String(enabled));
        toggleButton.textContent = enabled ? 'USD' : 'CNY';
        toggleButton.title = enabled ? 'Showing converted USD values' : 'Showing original CNY values';
        queueTogglePlacement();
    }

    function setEnabled(nextEnabled) {
        enabled = nextEnabled;
        localStorage.setItem(STORAGE_KEY, String(enabled));
        updateToggle();
        queueProcess();
    }

    function installToggle() {
        if (document.getElementById(`${SCRIPT_ID}-toggle`)) {
            toggleButton = document.getElementById(`${SCRIPT_ID}-toggle`);
            updateToggle();
            return;
        }

        const style = document.createElement('style');
        style.id = TOGGLE_STYLE_ID;
        style.textContent = `
            #${SCRIPT_ID}-toggle {
                width: 62px;
                min-width: 62px;
                height: 30px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
                border: 1px solid rgba(125, 137, 154, 0.38);
                border-radius: 999px;
                background: rgba(18, 24, 34, 0.74);
                color: rgb(244, 247, 251);
                box-shadow: none;
                cursor: pointer;
                font: 750 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                letter-spacing: 0;
                margin: 0 0 0 4px;
                padding: 0;
                vertical-align: middle;
                transition: background-color 140ms ease-out, border-color 140ms ease-out, color 140ms ease-out, box-shadow 140ms ease-out;
            }

            #${SCRIPT_ID}-toggle.${SCRIPT_ID}-fallback {
                position: fixed;
                left: var(--tld-linkapi-toggle-left, 16px);
                top: 13px;
                z-index: 2147483647;
                margin: 0;
            }

            #${SCRIPT_ID}-toggle[aria-pressed="true"] {
                border-color: rgba(20, 184, 166, 0.66);
                background: rgba(13, 117, 107, 0.86);
            }

            #${SCRIPT_ID}-toggle:hover,
            #${SCRIPT_ID}-toggle:focus-visible {
                border-color: rgba(56, 189, 248, 0.72);
                background: rgba(31, 41, 55, 0.92);
                outline: none;
            }

            #${SCRIPT_ID}-toggle:focus-visible {
                box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.28);
            }
        `;

        toggleButton = document.createElement('button');
        toggleButton.id = `${SCRIPT_ID}-toggle`;
        toggleButton.type = 'button';
        toggleButton.className = `${SCRIPT_ID}-control`;
        toggleButton.addEventListener('click', () => setEnabled(!enabled));

        document.documentElement.appendChild(style);
        document.documentElement.appendChild(toggleButton);
        window.addEventListener('resize', queueTogglePlacement, { passive: true });
        updateToggle();
    }

    function installObserver() {
        if (observer || !document.body) {
            return;
        }

        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'characterData') {
                    const node = mutation.target;
                    if (node.__tldLinkApiOriginalText !== undefined) {
                        const convertedText = convertText(node.__tldLinkApiOriginalText);
                        if ((enabled && node.textContent === convertedText)
                            || (!enabled && node.textContent === node.__tldLinkApiOriginalText)) {
                            continue;
                        }

                        delete node.__tldLinkApiOriginalText;
                    }

                    if (enabled) {
                        processTextNode(node);
                    }
                    continue;
                }

                for (const node of mutation.addedNodes) {
                    if (node.id === `${SCRIPT_ID}-toggle` || node.id === TOGGLE_STYLE_ID || node.id === HELPER_STYLE_ID) {
                        continue;
                    }

                    if (enabled) {
                        processRoot(node);
                    }
                    queueEnhancements();
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function boot() {
        removeStaleArtifacts();
        installToggle();
        installObserver();
        document.addEventListener('change', handlePageControlChange, true);
        document.addEventListener('input', handlePageControlChange, true);
        processRoot();
        processAccessibleFrames();
        enhancePage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.addEventListener('load', () => {
        queueProcess();
        queueTogglePlacement();
    }, { once: true });
    window.addEventListener('pageshow', () => {
        queueProcess();
        queueTogglePlacement();
    });
})();
