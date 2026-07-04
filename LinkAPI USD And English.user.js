// ==UserScript==
// @name         LinkAPI USD And English
// @namespace    https://violentmonkey.github.io/
// @version      6.1
// @description  Convert LinkAPI CNY values to target currency (defaults to local) with a live rate, an account-menu comparison control, models.dev comparison, automatic VAT, and a floating currency widget
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
    const MENU_STYLE_ID = `${SCRIPT_ID}-menu-style`;
    const MENU_TOGGLE_ID = `${SCRIPT_ID}-menu-toggle`;
    const MENU_TOGGLE_CLASS = `${SCRIPT_ID}-menu-control`;
    const SPLIT_CURRENCY_ATTR = `data-${SCRIPT_ID}-split-currency`;
    const FALLBACK_CNY_TO_USD_RATE = 0.146201;
    const FX_RATE_API_URL = 'https://api.frankfurter.dev/v1/latest?base=CNY';
    const FX_RATE_STORAGE_KEY = `${SCRIPT_ID}:fx:all-rates:v2`;
    const FX_RATE_TTL_MS = 60 * 1000;
    const MODELS_DEV_API_URL = 'https://models.dev/api.json';
    const MODELS_DEV_STORAGE_KEY = `${SCRIPT_ID}:models-dev:compact:v1`;
    const MODELS_DEV_TTL_MS = 12 * 60 * 60 * 1000;
    const MODEL_PRICE_STYLE_ID = `${SCRIPT_ID}-models-dev-style`;
    const MODEL_PRICE_NOTE_CLASS = `${SCRIPT_ID}-models-price-note`;
    const ACCOUNT_MENU_WALLET_LABELS = ['wallet', '钱包', '錢包'];
    const ACCOUNT_MENU_SIGN_OUT_LABELS = ['sign out', 'sign-out', 'log out', 'logout', '退出登录', '退出登錄', '登出'];
    const MENU_TOGGLE_LABEL = 'Show USD values';

    const PREFIX_CNY_PATTERN = /(?<![\w$])(?:CNY|RMB|CN¥|CN￥|¥|￥|人民币)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?!\s*(?:CNY|RMB|元)?\s*\))/gi;
    const SUFFIX_CNY_PATTERN = /(?<![\w$])([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:CNY|RMB|人民币|元)(?!\s*\))/gi;
    const SPLIT_PREFIX_CNY_PATTERN = /^(?:CNY|RMB|CN¥|CN￥|¥|￥|人民币)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)$/i;
    const SPLIT_SUFFIX_CNY_PATTERN = /^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:CNY|RMB|人民币|元)$/i;
    const CNY_UNIT_LABEL_PATTERN = /\((?:CNY|RMB)\)/gi;
    const COPYRIGHT_YEAR_PATTERN = /©\s*2025(?=\s*LinkAPI)/g;
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE']);
    const VAT_RATES = {
        PL: 0.23, AT: 0.20, BE: 0.21, BG: 0.20, HR: 0.25, CY: 0.19, CZ: 0.21, DK: 0.25,
        EE: 0.22, FI: 0.255, FR: 0.20, DE: 0.19, GR: 0.24, HU: 0.27, IE: 0.23, IT: 0.22,
        LV: 0.21, LT: 0.21, LU: 0.17, MT: 0.18, NL: 0.21, PT: 0.23, RO: 0.19, SK: 0.20,
        SI: 0.22, ES: 0.21, SE: 0.25, GB: 0.20
    };
    const CURRENCY_LOCALES = {
        PLN: 'pl-PL', EUR: 'de-DE', GBP: 'en-GB', USD: 'en-US', CAD: 'en-CA',
        AUD: 'en-AU', JPY: 'ja-JP', CNY: 'zh-CN', HKD: 'zh-HK', SGD: 'en-SG',
        CHF: 'de-CH', SEK: 'sv-SE', DKK: 'da-DK', NOK: 'no-NO', NZD: 'en-NZ',
        KRW: 'ko-KR', INR: 'en-IN', BRL: 'pt-BR', MXN: 'es-MX', ZAR: 'en-ZA',
        MYR: 'ms-MY', THB: 'th-TH', IDR: 'id-ID', TRY: 'tr-TR', ILS: 'he-IL',
        SAR: 'ar-SA', AED: 'ar-AE', BGN: 'bg-BG', CZK: 'cs-CZ', HUF: 'hu-HU',
        RON: 'ro-RO'
    };
    const COUNTRY_LIST = [
        { code: 'PL', name: 'Poland', currency: 'PLN' },
        { code: 'US', name: 'United States', currency: 'USD' },
        { code: 'DE', name: 'Germany', currency: 'EUR' },
        { code: 'FR', name: 'France', currency: 'EUR' },
        { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
        { code: 'CA', name: 'Canada', currency: 'CAD' },
        { code: 'AU', name: 'Australia', currency: 'AUD' },
        { code: 'JP', name: 'Japan', currency: 'JPY' },
        { code: 'CN', name: 'China', currency: 'CNY' },
        { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
        { code: 'SG', name: 'Singapore', currency: 'SGD' },
        { code: 'CH', name: 'Switzerland', currency: 'CHF' },
        { code: 'SE', name: 'Sweden', currency: 'SEK' },
        { code: 'DK', name: 'Denmark', currency: 'DKK' },
        { code: 'NO', name: 'Norway', currency: 'NOK' },
        { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
        { code: 'AT', name: 'Austria', currency: 'EUR' },
        { code: 'BE', name: 'Belgium', currency: 'EUR' },
        { code: 'BG', name: 'Bulgaria', currency: 'BGN' },
        { code: 'HR', name: 'Croatia', currency: 'EUR' },
        { code: 'CY', name: 'Cyprus', currency: 'EUR' },
        { code: 'CZ', name: 'Czech Republic', currency: 'CZK' },
        { code: 'EE', name: 'Estonia', currency: 'EUR' },
        { code: 'FI', name: 'Finland', currency: 'EUR' },
        { code: 'GR', name: 'Greece', currency: 'EUR' },
        { code: 'HU', name: 'Hungary', currency: 'HUF' },
        { code: 'IE', name: 'Ireland', currency: 'EUR' },
        { code: 'IT', name: 'Italy', currency: 'EUR' },
        { code: 'LV', name: 'Latvia', currency: 'EUR' },
        { code: 'LT', name: 'Lithuania', currency: 'EUR' },
        { code: 'LU', name: 'Luxembourg', currency: 'EUR' },
        { code: 'MT', name: 'Malta', currency: 'EUR' },
        { code: 'NL', name: 'Netherlands', currency: 'EUR' },
        { code: 'PT', name: 'Portugal', currency: 'EUR' },
        { code: 'RO', name: 'Romania', currency: 'RON' },
        { code: 'SK', name: 'Slovakia', currency: 'EUR' },
        { code: 'SI', name: 'Slovenia', currency: 'EUR' },
        { code: 'ES', name: 'Spain', currency: 'EUR' },
        { code: 'KR', name: 'South Korea', currency: 'KRW' },
        { code: 'IN', name: 'India', currency: 'INR' },
        { code: 'BR', name: 'Brazil', currency: 'BRL' },
        { code: 'MX', name: 'Mexico', currency: 'MXN' },
        { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
        { code: 'MY', name: 'Malaysia', currency: 'MYR' },
        { code: 'TH', name: 'Thailand', currency: 'THB' },
        { code: 'ID', name: 'Indonesia', currency: 'IDR' },
        { code: 'TR', name: 'Turkey', currency: 'TRY' },
        { code: 'IL', name: 'Israel', currency: 'ILS' },
        { code: 'SA', name: 'Saudi Arabia', currency: 'SAR' },
        { code: 'AE', name: 'United Arab Emirates', currency: 'AED' }
    ];
    const USD_PATTERN = /(?<![\w$])\$\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?![0-9])/gi;

    let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    let observer = null;
    let processQueued = false;
    let enhancementQueued = false;
    let menuToggleButton = null;
    let menuPlacementQueued = false;
    let pageSettingRestoreInProgress = false;
    let cnyToUsdRate = FALLBACK_CNY_TO_USD_RATE;
    let cnyToUsdRates = { USD: FALLBACK_CNY_TO_USD_RATE };
    let cnyToUsdRateDate = '';
    let fxRateLoadPromise = null;
    let modelsDevEntries = [];
    let modelsDevLoadPromise = null;
    let userCountryCode = '';
    let userCountryName = '';
    let vatRate = 0;
    let liveFluctuation = 1.0;

    function toNumber(rawAmount) {
        return Number(rawAmount.replace(/,/g, ''));
    }

    function getOriginalElementText(element) {
        if (!element) {
            return '';
        }

        if (element.childNodes && element.childNodes.length > 0) {
            return Array.from(element.childNodes)
                .map((node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        return node.__tldLinkApiOriginalText !== undefined ? node.__tldLinkApiOriginalText : node.textContent;
                    }
                    return getOriginalElementText(node);
                })
                .join('');
        }

        return element.textContent || '';
    }

    function formatCurrency(value, currency, maximumFractionDigits) {
        const locale = CURRENCY_LOCALES[currency] || 'en-US';
        const options = {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        };
        if (maximumFractionDigits !== undefined) {
            options.maximumFractionDigits = maximumFractionDigits;
        }
        return new Intl.NumberFormat(locale, options).format(value);
    }

    function subCentFractionDigits(value) {
        const absValue = Math.abs(value);
        return absValue > 0 && absValue < 0.01
            ? Math.min(Math.max(Math.ceil(-Math.log10(absValue)) + 2, 6), 8)
            : 2;
    }

    function formatTargetCurrency(cnyValue, applyVat = false) {
        const hasVat = applyVat && vatRate > 0;
        if (hasVat) {
            // Payable amount: keep the payment-rate conversion plus VAT.
            const res = convertCnyToTarget(cnyValue, true, false); // Stable!
            return `${res.formatted} (incl. ${Math.round(vatRate * 100)}% VAT)`;
        }

        // Informational amount (balance, usage, cost): clean mid-market rate,
        // consistent with the profile/dashboard cards.
        const clean = convertCnyToTargetClean(cnyValue);
        return formatCurrency(clean.value, clean.currency, subCentFractionDigits(clean.value));
    }

    function normalizeWhitespace(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeInputValue(value) {
        return String(value || '').toLowerCase().trim();
    }

    function convertText(text, node) {
        const applyVat = shouldApplyVat(node);
        const replaceAmount = (match, rawAmount) => {
            const cnyValue = toNumber(rawAmount);
            return Number.isFinite(cnyValue) ? formatTargetCurrency(cnyValue, applyVat) : match;
        };

        const replaceUsdAmount = (match, rawAmount) => {
            const usdValue = toNumber(rawAmount);
            if (!Number.isFinite(usdValue)) {
                return match;
            }
            const targetCurrency = getTargetCurrency();
            if (targetCurrency === 'USD' && !applyVat) {
                return match;
            }

            if (applyVat && vatRate > 0) {
                // Payable amount: payment-rate conversion plus VAT.
                const target = convertUsdToTarget(usdValue, true);
                return `${target.formatted} (incl. ${Math.round(vatRate * 100)}% VAT)`;
            }

            // Informational amount: clean mid-market rate.
            const clean = convertUsdToTargetClean(usdValue);
            return formatCurrency(clean.value, clean.currency, subCentFractionDigits(clean.value));
        };

        return String(text || '')
            .replace(PREFIX_CNY_PATTERN, replaceAmount)
            .replace(SUFFIX_CNY_PATTERN, replaceAmount)
            .replace(USD_PATTERN, replaceUsdAmount)
            .replace(CNY_UNIT_LABEL_PATTERN, `(${getTargetCurrency()})`)
            .replace(COPYRIGHT_YEAR_PATTERN, '© 2026');
    }

    function isSpecialSkippedDialog(el) {
        if (!el) return false;
        const dialog = el.closest('[role="dialog"], [data-slot="dialog-content"]');
        if (!dialog) return false;
        const titleEl = dialog.querySelector('[data-slot="dialog-title"]');
        const titleText = titleEl ? titleEl.textContent.trim().toLowerCase() : '';
        return titleText.includes('confirm creem purchase') || titleText.includes('billing history');
    }

    function isSkippedElement(el) {
        if (!el) return true;
        if (el.classList && (el.classList.contains(`${SCRIPT_ID}-price-annotated`) || el.classList.contains(MODEL_PRICE_NOTE_CLASS))) return true;
        const tag = el.tagName;
        if (SKIP_TAGS.has(tag)) return true;
        if (tag === 'BUTTON') return true;

        const id = el.id;
        if (id === `${SCRIPT_ID}-toggle` || id === MENU_TOGGLE_ID) return true;

        if (el.classList) {
            if (el.classList.contains(MENU_TOGGLE_CLASS) || el.classList.contains(`${SCRIPT_ID}-control`)) {
                return true;
            }
        }

        const slot = el.getAttribute('data-slot');
        if (slot === 'card' || slot === 'alert-dialog-content') return true;

        const role = el.getAttribute('role');
        if (role === 'alertdialog') return true;

        if (slot === 'dialog-content' || role === 'dialog') {
            return isSpecialSkippedDialog(el);
        }

        return false;
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        if (!parent) return true;
        if (isSkippedElement(parent)) return true;

        if (parent.closest(`#${SCRIPT_ID}-toggle, .${SCRIPT_ID}-control, #${MENU_TOGGLE_ID}, .${MENU_TOGGLE_CLASS}, [role="alertdialog"], [data-slot="alert-dialog-content"], button, [data-slot="card"], .${SCRIPT_ID}-price-annotated, .${MODEL_PRICE_NOTE_CLASS}, .${SCRIPT_ID}-dashboard-converted`)) {
            return true;
        }

        return isSpecialSkippedDialog(parent);
    }

    function shouldApplyVat(node) {
        if (!node) return false;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (!element) return false;

        const btn = element.closest('button');
        if (btn) {
            const payText = btn.querySelector('.text-muted-foreground')?.textContent || '';
            if (payText.toLowerCase().includes('pay')) {
                return true;
            }
        }

        if (element.closest('#topup-amount') || element.closest('label[for="topup-amount"]')?.parentElement) {
            return true;
        }

        const card = element.closest('[data-slot="card"]');
        if (card) {
            const titleDiv = card.querySelector('.mb-2.text-lg.font-medium, [class*="text-lg"][class*="font-medium"]');
            if (titleDiv) {
                const text = titleDiv.__tldOriginalText || titleDiv.textContent || '';
                if (/LinkAPI\s*-\s*\d+\s*Credits/i.test(text)) {
                    return true;
                }
            }
        }

        return false;
    }

    function processTextNode(node) {
        if (shouldSkipNode(node)) {
            return;
        }

        const originalText = node.__tldLinkApiOriginalText ?? node.textContent;
        const convertedText = convertText(originalText, node);
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

    function getSplitCurrencyAmount(text) {
        const normalizedText = normalizeWhitespace(text);
        const prefixMatch = normalizedText.match(SPLIT_PREFIX_CNY_PATTERN);
        if (prefixMatch) {
            return prefixMatch[1];
        }

        const suffixMatch = normalizedText.match(SPLIT_SUFFIX_CNY_PATTERN);
        return suffixMatch ? suffixMatch[1] : '';
    }

    function collectElements(root) {
        if (!root || root.nodeType === Node.TEXT_NODE) {
            return [];
        }

        const elements = [];
        if (root.nodeType === Node.ELEMENT_NODE) {
            elements.push(root);
        }

        if (typeof root.querySelectorAll === 'function') {
            elements.push(...root.querySelectorAll('*'));
        }

        return elements;
    }

    function collectMeaningfulTextNodes(element) {
        const ownerDocument = element.ownerDocument || document;
        const walker = ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            if (normalizeWhitespace(node.textContent)) {
                textNodes.push(node);
            }
        }

        return textNodes;
    }

    function shouldSkipSplitCurrencyElement(element) {
        if (isSkippedElement(element)) return true;

        if (element.closest(`#${SCRIPT_ID}-toggle, .${SCRIPT_ID}-control, #${MENU_TOGGLE_ID}, .${MENU_TOGGLE_CLASS}, [role="alertdialog"], [data-slot="alert-dialog-content"], button, [data-slot="card"]`)) {
            return true;
        }

        return isSpecialSkippedDialog(element);
    }

    function isSplitCurrencyCandidate(element) {
        if (element.getAttribute(SPLIT_CURRENCY_ATTR) === 'true' || shouldSkipSplitCurrencyElement(element)) {
            return false;
        }

        const textNodes = collectMeaningfulTextNodes(element);
        if (textNodes.length < 2) {
            return false;
        }

        return Boolean(getSplitCurrencyAmount(getOriginalElementText(element)));
    }

    function convertSplitCurrencyElement(element) {
        const rawAmount = getSplitCurrencyAmount(getOriginalElementText(element));
        const cnyValue = rawAmount ? toNumber(rawAmount) : NaN;
        if (!Number.isFinite(cnyValue)) {
            return;
        }

        const textNodes = collectMeaningfulTextNodes(element);
        if (textNodes.length < 2) {
            return;
        }

        element.__tldLinkApiOriginalSplitCurrencyNodes = textNodes.map((node) => ({
            node,
            text: node.textContent
        }));
        element.setAttribute(SPLIT_CURRENCY_ATTR, 'true');
        textNodes.forEach((node, index) => {
            node.textContent = index === 0 ? formatTargetCurrency(cnyValue, shouldApplyVat(element)) : '';
        });
    }

    function restoreSplitCurrencyElement(element) {
        const originalNodes = element.__tldLinkApiOriginalSplitCurrencyNodes;
        if (Array.isArray(originalNodes)) {
            originalNodes.forEach(({ node, text }) => {
                if (node?.parentNode) {
                    node.textContent = text;
                }
            });
        }

        delete element.__tldLinkApiOriginalSplitCurrencyNodes;
        element.removeAttribute(SPLIT_CURRENCY_ATTR);
    }

    function processSplitCurrencyElements(root) {
        const elements = collectElements(root);
        if (!enabled) {
            elements
                .filter((element) => element.getAttribute(SPLIT_CURRENCY_ATTR) === 'true')
                .forEach(restoreSplitCurrencyElement);
            return;
        }

        const candidates = elements.filter(isSplitCurrencyCandidate);
        candidates
            .filter((candidate) => !candidates.some((other) => other !== candidate && candidate.contains(other)))
            .forEach(convertSplitCurrencyElement);
    }

    function walkTextNodes(node, visitor) {
        if (!node) return;

        const type = node.nodeType;
        if (type === Node.TEXT_NODE) {
            visitor(node);
            return;
        }

        if (type === Node.ELEMENT_NODE) {
            if (isSkippedElement(node)) {
                return;
            }
        } else if (type !== Node.DOCUMENT_NODE && type !== Node.DOCUMENT_FRAGMENT_NODE) {
            return;
        }

        let child = node.firstChild;
        while (child) {
            walkTextNodes(child, visitor);
            child = child.nextSibling;
        }
    }

    function processRoot(root = document.body) {
        if (!root) {
            return;
        }

        walkTextNodes(root, enabled ? processTextNode : restoreTextNode);
        processSplitCurrencyElements(root);
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

    function fetchJson(url) {
        return fetch(url, { credentials: 'omit', cache: 'no-store' }).then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response.json();
        });
    }

    function loadCachedFxRate() {
        const cached = safeReadJsonStorage(FX_RATE_STORAGE_KEY, null);
        if (!cached || typeof cached !== 'object') {
            return false;
        }

        const rate = Number(cached.rate);
        const rates = cached.rates;
        const fetchedAt = Number(cached.fetchedAt);
        if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(fetchedAt) || Date.now() - fetchedAt > FX_RATE_TTL_MS) {
            return false;
        }

        cnyToUsdRate = rate;
        cnyToUsdRates = rates || { USD: rate };
        cnyToUsdRateDate = String(cached.date || '');
        return true;
    }

    function applyFreshCnyToUsdRate(rate, rates, date) {
        const rateChanged = rate !== cnyToUsdRate;
        cnyToUsdRate = rate;
        cnyToUsdRates = rates || { USD: rate };
        cnyToUsdRateDate = date;
        updateMenuToggle();
        updateWidget();
        enhancePage();

        if (!rateChanged) {
            return;
        }

        document.querySelectorAll(`[${SPLIT_CURRENCY_ATTR}="true"]`).forEach(restoreSplitCurrencyElement);
        queueProcess();
    }

    function refreshCnyToUsdRate() {
        if (fxRateLoadPromise) {
            return fxRateLoadPromise;
        }

        fxRateLoadPromise = fetchJson(FX_RATE_API_URL)
            .then((data) => {
                const rate = Number(data?.rates?.USD);
                const rates = data?.rates || {};
                if (!Number.isFinite(rate) || rate <= 0) {
                    throw new Error('Invalid CNY/USD rate response');
                }

                const date = String(data?.date || '');
                safeWriteJsonStorage(FX_RATE_STORAGE_KEY, { rate, rates, date, fetchedAt: Date.now() });
                applyFreshCnyToUsdRate(rate, rates, date);
            })
            .catch(() => {
                // Keep the cached or fallback rate.
            })
            .finally(() => {
                fxRateLoadPromise = null;
            });

        return fxRateLoadPromise;
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

            #${SCRIPT_ID}-currency-widget {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 10000;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            .${SCRIPT_ID}-widget-trigger {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: rgba(24, 24, 27, 0.85);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(63, 63, 70, 0.5);
                color: rgb(45, 212, 191);
                font-size: 20px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
                padding: 0;
            }

            .${SCRIPT_ID}-widget-trigger:hover {
                transform: scale(1.08);
                background: rgba(39, 39, 42, 0.95);
                border-color: rgba(45, 212, 191, 0.5);
            }

            .${SCRIPT_ID}-widget-popup {
                position: absolute;
                bottom: 58px;
                right: 0;
                width: 280px;
                background: rgba(24, 24, 27, 0.98);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(63, 63, 70, 0.5);
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
                transition: opacity 0.2s ease, transform 0.2s ease;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .${SCRIPT_ID}-widget-popup[hidden] {
                display: none !important;
            }

            .${SCRIPT_ID}-widget-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid rgba(63, 63, 70, 0.4);
                padding-bottom: 8px;
            }

            .${SCRIPT_ID}-widget-header h3 {
                margin: 0;
                font-size: 14px;
                font-weight: 600;
                color: rgb(244, 244, 245);
            }

            .${SCRIPT_ID}-widget-close {
                background: transparent;
                border: 0;
                color: rgb(161, 161, 170);
                font-size: 18px;
                cursor: pointer;
                padding: 0 4px;
                transition: color 0.15s ease;
            }

            .${SCRIPT_ID}-widget-close:hover {
                color: rgb(244, 244, 245);
            }

            .${SCRIPT_ID}-field {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .${SCRIPT_ID}-field label {
                font-size: 11px;
                font-weight: 600;
                color: rgb(161, 161, 170);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .${SCRIPT_ID}-searchable-select {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            #${SCRIPT_ID}-search-input {
                background: rgba(9, 9, 11, 0.8);
                border: 1px solid rgba(63, 63, 70, 0.5);
                border-radius: 6px;
                color: rgb(244, 244, 245);
                font-size: 13px;
                padding: 6px 10px;
                outline: none;
                transition: border-color 0.15s ease;
                width: 100%;
                box-sizing: border-box;
            }

            #${SCRIPT_ID}-search-input:focus {
                border-color: rgb(45, 212, 191);
            }

            .${SCRIPT_ID}-options-list {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                z-index: 10001;
                max-height: 180px;
                overflow-y: auto;
                background: rgba(24, 24, 27, 0.98);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(63, 63, 70, 0.5);
                border-radius: 6px;
                display: none;
                flex-direction: column;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                margin-top: 4px;
            }

            .${SCRIPT_ID}-option-item {
                padding: 8px 12px;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid rgba(63, 63, 70, 0.3);
                color: rgb(161, 161, 170);
                transition: background-color 0.15s ease, color 0.15s ease;
            }

            .${SCRIPT_ID}-option-item:last-child {
                border-bottom: none;
            }

            .${SCRIPT_ID}-option-item:hover {
                background: rgba(39, 39, 42, 0.8);
                color: rgb(250, 250, 250);
            }

            .${SCRIPT_ID}-option-item.selected {
                font-weight: 600;
                background: rgba(45, 212, 191, 0.15);
                color: rgb(45, 212, 191);
                border-left: 3px solid rgb(45, 212, 191);
            }

            .${SCRIPT_ID}-option-country {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 8px;
            }

            .${SCRIPT_ID}-option-currency {
                font-family: monospace;
                font-size: 11px;
                font-weight: 600;
                color: rgb(45, 212, 191);
                background: rgba(45, 212, 191, 0.1);
                padding: 2px 6px;
                border-radius: 4px;
                flex-shrink: 0;
            }

            .${SCRIPT_ID}-no-results {
                padding: 12px;
                font-size: 13px;
                color: rgb(161, 161, 170);
                text-align: center;
            }

            .${SCRIPT_ID}-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 12px;
                color: rgb(161, 161, 170);
                background: rgba(9, 9, 11, 0.5);
                border: 1px solid rgba(63, 63, 70, 0.3);
                border-radius: 6px;
                padding: 8px 10px;
            }

            .${SCRIPT_ID}-info p {
                margin: 0;
                display: flex;
                justify-content: space-between;
            }

            .${SCRIPT_ID}-info span {
                color: rgb(244, 244, 245);
                font-weight: 550;
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
            `${SCRIPT_ID}-dashboard-token-total`,
            `${SCRIPT_ID}-toggle`,
            `${SCRIPT_ID}-style`
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

    function normalizeModelLookupText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/^\s*\[[^\]]+\]\s*/g, '')
            .replace(/^(?:aws|azure|openrouter|vertex|bedrock|anthropic|google|openai|xai|deepseek|mistral|meta|alibaba|moonshot)\//i, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
    }

    function getModelTokens(value) {
        return normalizeModelLookupText(value)
            .split('-')
            .filter((token) => token && token.length > 1 && !/^(?:api|model|preview|latest|experimental)$/.test(token));
    }

    function compactModelsDevData(data) {
        const entries = [];
        const providerEntries = Array.isArray(data?.providers)
            ? data.providers.map((provider) => [provider.id || provider.name, provider])
            : Object.entries(data || {});

        for (const [providerKey, provider] of providerEntries) {
            if (!provider || typeof provider !== 'object') {
                continue;
            }

            const providerId = String(provider.id || providerKey || '').toLowerCase();
            const providerName = String(provider.name || providerId || '');
            const models = provider.models || provider.model || {};
            const modelEntries = Array.isArray(models)
                ? models.map((model) => [model.id || model.name, model])
                : Object.entries(models);

            for (const [modelKey, model] of modelEntries) {
                if (!model || typeof model !== 'object') {
                    continue;
                }

                const id = String(model.id || modelKey || '');
                const name = String(model.name || id || '');
                const fullId = id.includes('/') ? id : `${providerId}/${id}`;
                const cost = model.cost && typeof model.cost === 'object' ? model.cost : {};
                const costs = Object.fromEntries(
                    Object.entries(cost)
                        .map(([key, value]) => [String(key), Number(value)])
                        .filter(([, value]) => Number.isFinite(value))
                );

                entries.push({
                    id,
                    name,
                    fullId,
                    providerId,
                    providerName,
                    costs,
                    input: Number.isFinite(Number(cost.input)) ? Number(cost.input) : null,
                    output: Number.isFinite(Number(cost.output)) ? Number(cost.output) : null,
                    cacheRead: Number.isFinite(Number(cost.cache_read)) ? Number(cost.cache_read) : null,
                    cacheWrite: Number.isFinite(Number(cost.cache_write)) ? Number(cost.cache_write) : null
                });
            }
        }

        return entries.filter((entry) => entry.id && (
            entry.input !== null
            || entry.output !== null
            || entry.cacheRead !== null
            || Object.keys(entry.costs || {}).length > 0
        ));
    }

    function loadCachedModelsDevEntries() {
        const cached = safeReadJsonStorage(MODELS_DEV_STORAGE_KEY, null);
        if (!cached || typeof cached !== 'object') {
            return false;
        }

        if (!Array.isArray(cached.entries) || Date.now() - Number(cached.fetchedAt || 0) > MODELS_DEV_TTL_MS) {
            return false;
        }

        if (cached.entries.some((entry) => !entry || typeof entry !== 'object' || !entry.costs)) {
            return false;
        }

        modelsDevEntries = cached.entries;
        return modelsDevEntries.length > 0;
    }

    function loadModelsDevEntries() {
        if (modelsDevEntries.length > 0) {
            return Promise.resolve(modelsDevEntries);
        }

        if (modelsDevLoadPromise) {
            return modelsDevLoadPromise;
        }

        loadCachedModelsDevEntries();
        if (modelsDevEntries.length > 0) {
            return Promise.resolve(modelsDevEntries);
        }

        modelsDevLoadPromise = fetchJson(MODELS_DEV_API_URL)
            .then((data) => {
                modelsDevEntries = compactModelsDevData(data);
                safeWriteJsonStorage(MODELS_DEV_STORAGE_KEY, {
                    fetchedAt: Date.now(),
                    entries: modelsDevEntries
                });

                return modelsDevEntries;
            })
            .catch(() => {
                modelsDevEntries = [];
                return modelsDevEntries;
            })
            .finally(() => {
                modelsDevLoadPromise = null;
            });

        return modelsDevLoadPromise;
    }

    function guessProviderHint(container, rawModelName) {
        const text = normalizeWhitespace(`${rawModelName || ''} ${container?.textContent || ''}`).toLowerCase();

        if (/anthropic|claude/.test(text)) return 'anthropic';
        if (/google|gemini/.test(text)) return 'google';
        if (/openai|gpt-|gpt_|o[1345]\b|chatgpt|codex/.test(text)) return 'openai';
        if (/\bxai\b|grok/.test(text)) return 'xai';
        if (/deepseek/.test(text)) return 'deepseek';
        if (/mistral|codestral|mixtral/.test(text)) return 'mistral';
        if (/meta|llama/.test(text)) return 'meta';
        if (/moonshot|kimi/.test(text)) return 'moonshot';
        if (/qwen|alibaba/.test(text)) return 'alibaba';

        return '';
    }

    function modelMatchScore(rawQuery, providerHint, entry) {
        const query = normalizeModelLookupText(rawQuery);
        if (!query) {
            return 0;
        }

        const candidates = [
            entry.id,
            entry.name,
            entry.fullId,
            entry.fullId.split('/').pop()
        ].map(normalizeModelLookupText).filter(Boolean);

        let best = 0;

        for (const candidate of candidates) {
            if (candidate === query) {
                best = Math.max(best, 100);
                continue;
            }

            if (candidate.endsWith(query) || query.endsWith(candidate)) {
                best = Math.max(best, 92);
                continue;
            }

            if (candidate.includes(query) || query.includes(candidate)) {
                best = Math.max(best, 82);
                continue;
            }

            const queryTokens = new Set(getModelTokens(query));
            const candidateTokens = new Set(getModelTokens(candidate));
            const overlap = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
            const denominator = Math.max(1, queryTokens.size + candidateTokens.size);
            const dice = (2 * overlap / denominator) * 72;

            best = Math.max(best, dice);
        }

        if (providerHint && (entry.providerId === providerHint || normalizeModelLookupText(entry.providerName) === providerHint)) {
            best += 8;
        }

        return best;
    }

    function findModelsDevMatch(rawModelName, container) {
        if (!rawModelName || modelsDevEntries.length === 0) {
            return null;
        }

        const providerHint = guessProviderHint(container, rawModelName);
        let best = null;

        for (const entry of modelsDevEntries) {
            const score = modelMatchScore(rawModelName, providerHint, entry);
            if (!best || score > best.score) {
                best = { entry, score };
            }
        }

        return best && best.score >= 58 ? best : null;
    }

    function parseUsdAmount(value) {
        if (value === undefined || value === null) {
            return null;
        }
        const cleaned = String(value).replaceAll('$', '').replaceAll(',', '').trim();
        if (cleaned === '') {
            return null;
        }
        const number = Number(cleaned);
        return Number.isFinite(number) ? number : null;
    }

    function getUnitScaleToPerMillionFromText(text) {
        const compact = normalizeWhitespace(String(text || '')).toLowerCase().replaceAll(' ', '');

        if (compact.includes('/1k') || compact.includes('per1k') || compact.includes('/1000') || compact.includes('per1000')) {
            return { scale: 1000, unitLabel: '1K' };
        }

        if (compact.includes('/1m') || compact.includes('per1m') || compact.includes('/1000000') || compact.includes('per1000000')) {
            return { scale: 1, unitLabel: '1M' };
        }

        return null;
    }

    function getElementTokenUnitInfo(element) {
        const ownUnit = getUnitScaleToPerMillionFromText(getOriginalElementText(element));
        if (ownUnit) {
            return ownUnit;
        }

        const table = element?.closest?.('table');
        if (table) {
            const tableSection = table.closest('section') || table.parentElement;
            const footnoteText = Array.from(tableSection?.querySelectorAll?.('p, small, [class*="text-muted-foreground"]') || [])
                .map((node) => getOriginalElementText(node))
                .find((candidate) => /prices shown per|1k|1m/i.test(candidate));
            const footnoteUnit = getUnitScaleToPerMillionFromText(footnoteText || '');
            if (footnoteUnit) {
                return footnoteUnit;
            }
        }

        return { scale: 1, unitLabel: '1M' };
    }

    function parseLinkApiTokenPrice(element) {
        const text = getOriginalElementText(element);
        const match = text.match(/(?:\$|¥|￥|CNY|RMB|人民币)?\s*([0-9]+(?:\.[0-9]+)?)/i);
        const rawPrice = match ? parseUsdAmount(match[1]) : null;
        if (rawPrice === null) {
            return null;
        }

        const unitInfo = getElementTokenUnitInfo(element);
        return {
            rawPrice,
            pricePerMillion: rawPrice * unitInfo.scale,
            scaleToPerMillion: unitInfo.scale,
            unitLabel: unitInfo.unitLabel
        };
    }

    function formatUsdPlain(value, digits = 2) {
        if (!Number.isFinite(Number(value))) {
            return '—';
        }

        const numeric = Number(value);
        const abs = Math.abs(numeric);
        const maximumFractionDigits = abs > 0 && abs < 0.0001
            ? 8
            : abs > 0 && abs < 0.01
                ? 6
                : abs > 0 && abs < 1
                    ? 4
                    : digits;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: Math.min(2, maximumFractionDigits),
            maximumFractionDigits
        }).format(numeric);
    }

    function formatPriceForUnit(pricePerMillion, unitInfo) {
        const scale = Number(unitInfo?.scale || 1);
        const unitLabel = unitInfo?.unitLabel || '1M';
        return `${formatUsdPlain(pricePerMillion / scale)}/${unitLabel}`;
    }

    function formatTokenCount(value) {
        if (!Number.isFinite(Number(value)) || value <= 0) {
            return '—';
        }

        return new Intl.NumberFormat('en-US', {
            notation: value >= 1000 ? 'compact' : 'standard',
            maximumFractionDigits: value >= 1000 ? 1 : 0
        }).format(value);
    }

    function comparePriceNumber(linkApiPrice, officialPrice) {
        if (!Number.isFinite(linkApiPrice) || !Number.isFinite(officialPrice) || officialPrice <= 0) {
            return null;
        }

        return {
            ratio: linkApiPrice / officialPrice,
            percent: (1 - linkApiPrice / officialPrice) * 100
        };
    }

    function formatCompactDelta(linkApiPrice, officialPrice) {
        if (!Number.isFinite(linkApiPrice) || !Number.isFinite(officialPrice)) {
            return null;
        }

        if (officialPrice === 0) {
            if (linkApiPrice === 0) {
                return {
                    text: 'same',
                    tone: `${SCRIPT_ID}-models-price-neutral`,
                    title: 'Same as official free pricing'
                };
            }

            return {
                text: 'paid',
                tone: `${SCRIPT_ID}-models-price-bad`,
                title: 'Official pricing is $0.00, so this paid price cannot be expressed as a finite percentage higher'
            };
        }

        const comparison = comparePriceNumber(linkApiPrice, officialPrice);
        if (!comparison) {
            return null;
        }

        if (Math.abs(comparison.percent) < 0.5) {
            return {
                text: 'same',
                tone: `${SCRIPT_ID}-models-price-neutral`,
                title: 'Same as official pricing'
            };
        }

        if (comparison.percent > 0) {
            return {
                text: `−${comparison.percent.toFixed(1)}%`,
                tone: `${SCRIPT_ID}-models-price-good`,
                title: `${comparison.percent.toFixed(1)}% cheaper than official pricing`
            };
        }

        return {
            text: `+${Math.abs(comparison.percent).toFixed(1)}%`,
            tone: `${SCRIPT_ID}-models-price-bad`,
            title: `${Math.abs(comparison.percent).toFixed(1)}% higher than official pricing`
        };
    }

    function getDirectText(element) {
        return Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.__tldLinkApiOriginalText !== undefined ? node.__tldLinkApiOriginalText : (node.textContent || ''))
            .join(' ')
            .trim();
    }

    function findSectionByHeading(container, headingPattern) {
        return Array.from(container.querySelectorAll('section')).find((section) => {
            const heading = section.querySelector(':scope > h2, :scope > h3');
            return headingPattern.test(normalizeWhitespace(getOriginalElementText(heading)));
        }) || null;
    }

    function getHeaderText(header) {
        return normalizeWhitespace(header.childNodes.length
            ? Array.from(header.childNodes)
                .filter((node) => !(node instanceof HTMLElement && node.classList.contains(MODEL_PRICE_NOTE_CLASS)))
                .map((node) => node.nodeType === Node.TEXT_NODE && node.__tldLinkApiOriginalText !== undefined ? node.__tldLinkApiOriginalText : (node.textContent || ''))
                .join(' ')
            : getOriginalElementText(header) || header.getAttribute('aria-label') || header.title || '');
    }

    function getTableColumnMap(table) {
        const headers = Array.from(table.querySelectorAll('thead th, thead [role="columnheader"]'))
            .map((header) => getHeaderText(header).toLowerCase());
        const findIndex = (patterns) => headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));

        return {
            group: findIndex([/^group$/i]),
            ratio: findIndex([/^ratio$/i, /^rate$/i, /^multiplier$/i]),
            input: findIndex([/^input$/i]),
            output: findIndex([/^output$/i]),
            cache: findIndex([/^cache$/i, /^cached$/i, /^cached input$/i]),
            price: findIndex([/^price$/i])
        };
    }

    function headerNote(text, title) {
        return { className: `${MODEL_PRICE_NOTE_CLASS} ${SCRIPT_ID}-models-price-header-note`, text, title };
    }

    function cellNote(text, title, tone) {
        return { className: `${MODEL_PRICE_NOTE_CLASS} ${SCRIPT_ID}-models-price-cell-note ${tone}`, text, title };
    }

    function breakEvenNote(text, title, tone) {
        return { className: `${MODEL_PRICE_NOTE_CLASS} ${SCRIPT_ID}-models-price-break-even-note ${tone}`, text, title };
    }

    function syncPriceNotes(element, notes) {
        if (!element) {
            return;
        }

        const existing = Array.from(element.querySelectorAll(`:scope > .${MODEL_PRICE_NOTE_CLASS}`));
        const unchanged = existing.length === notes.length && notes.every((note, index) =>
            existing[index].className === note.className
            && existing[index].textContent === note.text
            && existing[index].title === note.title);

        if (unchanged) {
            return;
        }

        existing.forEach((note) => note.remove());
        for (const note of notes) {
            const span = document.createElement('span');
            span.className = note.className;
            span.textContent = note.text;
            span.title = note.title;
            element.appendChild(span);
        }
    }

    function getEntryCost(entry, key) {
        const value = entry?.costs?.[key];
        return Number.isFinite(value) ? value : null;
    }

    function getFirstEntryCost(entry, keys) {
        for (const key of keys) {
            const value = getEntryCost(entry, key);
            if (value !== null) {
                return { key, value };
            }
        }

        return null;
    }

    function getOfficialCostInfoForLabel(label, entry) {
        const text = normalizeWhitespace(label || '').toLowerCase();
        const hasInput = text.includes('input') || text.includes('prompt') || text === 'in' || text.endsWith(' in');
        const hasOutput = text.includes('output') || text.includes('completion') || text.includes('response') || text === 'out' || text.endsWith(' out');
        const hasRead = /read/.test(text);
        const hasWrite = /write/.test(text);
        const hasCache = /cache|cached/.test(text);
        const hasAudio = /audio|speech|voice/.test(text);
        const hasImage = /image|vision|photo|picture/.test(text);
        const hasVideo = /video/.test(text);
        const hasPdf = /pdf|document|doc/.test(text);
        const hasReasoning = /reasoning|thinking/.test(text);

        if (hasReasoning) {
            return getFirstEntryCost(entry, ['reasoning', 'output_reasoning', 'reasoning_output']);
        }

        if (hasCache) {
            if (hasWrite) {
                return getFirstEntryCost(entry, ['cache_write', 'cached_write', 'input_cache_write']);
            }
            if (hasRead || !hasWrite) {
                return getFirstEntryCost(entry, ['cache_read', 'cached_read', 'input_cache_read']);
            }
        }

        if (hasAudio) {
            return getFirstEntryCost(entry, hasOutput ? ['output_audio', 'audio_output'] : ['input_audio', 'audio_input']);
        }

        if (hasImage) {
            return getFirstEntryCost(entry, hasOutput ? ['output_image', 'image_output'] : ['input_image', 'image_input']);
        }

        if (hasVideo) {
            return getFirstEntryCost(entry, hasOutput ? ['output_video', 'video_output'] : ['input_video', 'video_input']);
        }

        if (hasPdf) {
            return getFirstEntryCost(entry, hasOutput
                ? ['output_pdf', 'pdf_output', 'output_document', 'document_output']
                : ['input_pdf', 'pdf_input', 'input_document', 'document_input']);
        }

        if (hasOutput) {
            return getFirstEntryCost(entry, ['output']);
        }

        if (hasInput) {
            return getFirstEntryCost(entry, ['input']);
        }

        return null;
    }

    function formatCostKeyLabel(key, { compact = false } = {}) {
        const labels = {
            input: compact ? 'in' : 'Input',
            output: compact ? 'out' : 'Output',
            cache_read: compact ? 'cache read' : 'Cache read',
            cache_write: compact ? 'cache write' : 'Cache write',
            reasoning: compact ? 'reason' : 'Reasoning',
            input_audio: compact ? 'audio in' : 'Audio input',
            output_audio: compact ? 'audio out' : 'Audio output',
            input_image: compact ? 'image in' : 'Image input',
            output_image: compact ? 'image out' : 'Image output',
            input_video: compact ? 'video in' : 'Video input',
            output_video: compact ? 'video out' : 'Video output',
            input_pdf: compact ? 'pdf in' : 'PDF input',
            output_pdf: compact ? 'pdf out' : 'PDF output'
        };

        return labels[key] || key.replace(/_/g, ' ');
    }

    function getOrderedOfficialCostItems(entry) {
        const costs = entry?.costs || {};
        const preferred = [
            'input',
            'output',
            'reasoning',
            'cache_read',
            'cache_write',
            'input_audio',
            'output_audio',
            'input_image',
            'output_image',
            'input_video',
            'output_video',
            'input_pdf',
            'output_pdf'
        ];
        const seen = new Set();
        const items = [];

        for (const key of preferred) {
            const value = getEntryCost(entry, key);
            if (value !== null) {
                seen.add(key);
                items.push({ key, value });
            }
        }

        for (const [key, value] of Object.entries(costs)) {
            if (!seen.has(key) && Number.isFinite(value)) {
                items.push({ key, value });
            }
        }

        return items;
    }

    function formatOfficialTokenPricingSummary(entry, { compact = false } = {}) {
        return getOrderedOfficialCostItems(entry)
            .map(({ key, value }) => `${formatCostKeyLabel(key, { compact })} ${formatUsdPlain(value)}/1M`)
            .join(compact ? ' / ' : ' · ');
    }

    function appendHeaderOfficialPrice(header, label, officialPrice, unitInfo, entry) {
        if (!header || !Number.isFinite(officialPrice)) {
            return;
        }

        const targetCurr = getTargetCurrency();
        const usdFormatted = formatPriceForUnit(officialPrice, unitInfo);

        let headerText;
        if (targetCurr === 'USD') {
            headerText = `Official ${usdFormatted}`;
        } else {
            const scale = Number(unitInfo?.scale || 1);
            const unitLabel = unitInfo?.unitLabel || '1M';
            const priceForUnit = officialPrice / scale;
            const converted = convertUsdToTargetClean(priceForUnit);
            headerText = `Official ${formatUsdPlain(priceForUnit)} (${converted.formatted})/${unitLabel}`;
        }

        syncPriceNotes(header, [headerNote(
            headerText,
            `${label} official models.dev price (${entry.fullId}): ${formatUsdPlain(officialPrice)} / 1M tokens`
        )]);
    }

    function appendHeaderBreakEvenNote(header, entry) {
        if (!header) {
            return;
        }

        const notes = [];
        const officialSummary = formatOfficialTokenPricingSummary(entry, { compact: true });
        if (officialSummary) {
            notes.push(headerNote(
                `Official ${officialSummary}`,
                `Official models.dev token pricing (${entry.fullId}) used for per-request break-even estimates.`
            ));
        }

        notes.push(headerNote(
            'Break-even shown',
            'Shows the approximate token count where fixed per-request pricing becomes cheaper than token-based pricing.'
        ));

        syncPriceNotes(header, notes);
    }

    function appendCompactDelta(cell, linkApiPricePerMillion, officialPrice, label, sourcePrice, entry) {
        if (!cell || !Number.isFinite(linkApiPricePerMillion) || !Number.isFinite(officialPrice)) {
            return;
        }

        const delta = formatCompactDelta(linkApiPricePerMillion, officialPrice);
        if (!delta) {
            return;
        }

        const displayedText = sourcePrice
            ? `Displayed LinkAPI price: ${formatUsdPlain(sourcePrice.rawPrice)}/${sourcePrice.unitLabel}. Normalized LinkAPI price: ${formatUsdPlain(sourcePrice.pricePerMillion)} / 1M.`
            : `LinkAPI price: ${formatUsdPlain(linkApiPricePerMillion)} / 1M.`;

        syncPriceNotes(cell, [cellNote(
            delta.text,
            `${label}: ${displayedText} Official models.dev price (${entry.fullId}): ${formatUsdPlain(officialPrice)} / 1M. ${delta.title}.`,
            delta.tone
        )]);
    }

    function getBreakEvenScenarios(requestPrice, entry) {
        const scenarios = {};
        if (!Number.isFinite(requestPrice) || requestPrice <= 0 || !entry) {
            return scenarios;
        }

        const breakEvenTokens = (pricePerMillion) => {
            const price = Number(pricePerMillion);
            return Number.isFinite(price) && price > 0
                ? requestPrice * 1000000 / price
                : null;
        };

        scenarios.inputOnly = breakEvenTokens(entry.input);
        scenarios.outputOnly = breakEvenTokens(entry.output);
        scenarios.cacheReadOnly = breakEvenTokens(entry.cacheRead);
        scenarios.cacheWriteOnly = breakEvenTokens(entry.cacheWrite);
        scenarios.extra = getOrderedOfficialCostItems(entry)
            .filter(({ key }) => !['input', 'output', 'cache_read', 'cache_write'].includes(key))
            .map(({ key, value }) => ({ key, tokens: breakEvenTokens(value) }))
            .filter((item) => item.tokens);

        if (Number.isFinite(entry.input) && entry.input > 0 && Number.isFinite(entry.output) && entry.output > 0) {
            // Per-side token count for a 1:1 input/output request: 1K+1K means 1K input plus 1K output tokens.
            scenarios.balancedOneToOneEach = requestPrice * 1000000 / (entry.input + entry.output);
        }

        return scenarios;
    }

    function annotatePerRequestPriceCell(cell, requestPrice, entry, { showOfficialInline = false } = {}) {
        if (!cell || !Number.isFinite(requestPrice) || requestPrice <= 0 || !entry) {
            return;
        }

        const notes = [];

        if (showOfficialInline) {
            const officialSummary = formatOfficialTokenPricingSummary(entry, { compact: true });
            if (officialSummary) {
                notes.push(breakEvenNote(
                    `Official ${officialSummary}`,
                    `Official models.dev token pricing (${entry.fullId}) used for the break-even estimates below.`,
                    `${SCRIPT_ID}-models-price-neutral`
                ));
            }
        }

        const scenarios = getBreakEvenScenarios(requestPrice, entry);
        const primaryParts = [];
        const cacheParts = [];
        const extraParts = [];

        if (scenarios.inputOnly) {
            primaryParts.push(`>${formatTokenCount(scenarios.inputOnly)} in`);
        }

        if (scenarios.outputOnly) {
            primaryParts.push(`>${formatTokenCount(scenarios.outputOnly)} out`);
        }

        if (scenarios.balancedOneToOneEach) {
            primaryParts.push(`1:1 >${formatTokenCount(scenarios.balancedOneToOneEach)}+${formatTokenCount(scenarios.balancedOneToOneEach)}`);
        }

        if (scenarios.cacheReadOnly) {
            cacheParts.push(`>${formatTokenCount(scenarios.cacheReadOnly)} read`);
        }

        if (scenarios.cacheWriteOnly) {
            cacheParts.push(`>${formatTokenCount(scenarios.cacheWriteOnly)} write`);
        }

        if (Array.isArray(scenarios.extra)) {
            for (const item of scenarios.extra.slice(0, 3)) {
                extraParts.push(`${formatCostKeyLabel(item.key, { compact: true })} >${formatTokenCount(item.tokens)}`);
            }
        }

        if (primaryParts.length === 0 && cacheParts.length === 0 && extraParts.length === 0 && notes.length === 0) {
            return;
        }

        const titleParts = [];

        if (scenarios.inputOnly) {
            titleParts.push(`Input-only break-even: ${formatTokenCount(scenarios.inputOnly)} input tokens`);
        }

        if (scenarios.outputOnly) {
            titleParts.push(`Output-only break-even: ${formatTokenCount(scenarios.outputOnly)} output tokens`);
        }

        if (scenarios.balancedOneToOneEach) {
            titleParts.push(`1:1 break-even: ${formatTokenCount(scenarios.balancedOneToOneEach)} input + ${formatTokenCount(scenarios.balancedOneToOneEach)} output tokens`);
        }

        if (scenarios.cacheReadOnly) {
            titleParts.push(`Cache-read-only break-even: ${formatTokenCount(scenarios.cacheReadOnly)} cached input read tokens`);
        }

        if (scenarios.cacheWriteOnly) {
            titleParts.push(`Cache-write-only break-even: ${formatTokenCount(scenarios.cacheWriteOnly)} cached input write tokens`);
        }

        if (Array.isArray(scenarios.extra)) {
            for (const item of scenarios.extra) {
                titleParts.push(`${formatCostKeyLabel(item.key)} break-even: ${formatTokenCount(item.tokens)} tokens`);
            }
        }

        if (primaryParts.length > 0) {
            notes.push(breakEvenNote(
                `BE ${primaryParts.join(' / ')}`,
                `${titleParts.join('. ')}. Break-even means official token pricing (models.dev: ${entry.fullId}) equals this fixed per-request price. Above that usage for the same scenario, fixed per-request pricing is cheaper; below it, token pricing is cheaper.`,
                `${SCRIPT_ID}-models-price-good`
            ));
        }

        if (cacheParts.length > 0) {
            notes.push(breakEvenNote(
                `cache BE ${cacheParts.join(' / ')}`,
                `${titleParts.join('. ')}. Cache read/write prices are shown separately because providers often bill cache reads and writes differently.`,
                `${SCRIPT_ID}-models-price-neutral`
            ));
        }

        if (extraParts.length > 0) {
            notes.push(breakEvenNote(
                `extra BE ${extraParts.join(' / ')}`,
                `${titleParts.join('. ')}. These are modality-specific or provider-specific official cost fields from models.dev.`,
                `${SCRIPT_ID}-models-price-neutral`
            ));
        }

        syncPriceNotes(cell, notes);
    }

    function getModelNameForPricingRoot(root) {
        return normalizeWhitespace(
            root.querySelector('header h1.font-mono, header h1, h3.font-mono, h3')?.textContent || ''
        );
    }

    function findModelRootFromPricingSection(section) {
        return section.closest('[class*="@container/details"]')
            || section.closest('.flex-1')
            || section.closest('div.group.relative.flex.flex-col')
            || section.closest('div[class*="rounded-xl"][class*="border"]')
            || document;
    }

    function annotatePricingGroupTable(table, match) {
        if (!table || !match?.entry) {
            return;
        }

        const entry = match.entry;
        const columns = getTableColumnMap(table);
        const headers = Array.from(table.querySelectorAll('thead th, thead [role="columnheader"]'));
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const nonPriceColumns = new Set([columns.group, columns.ratio].filter((index) => index >= 0));
        const priceColumnInfo = [];

        headers.forEach((header, index) => {
            if (nonPriceColumns.has(index)) {
                return;
            }

            const label = getHeaderText(header);

            if (columns.price === index && columns.input < 0 && columns.output < 0) {
                appendHeaderBreakEvenNote(header, entry);
                priceColumnInfo.push({ index, type: 'request', label });
                return;
            }

            const official = getOfficialCostInfoForLabel(label, entry);
            if (!official) {
                syncPriceNotes(header, []);
                return;
            }

            const sampleCell = rows
                .map((row) => row.children[index])
                .find((cell) => cell && /[$][0-9]/.test(getOriginalElementText(cell)));
            const unitInfo = getElementTokenUnitInfo(sampleCell || table);

            appendHeaderOfficialPrice(header, formatCostKeyLabel(official.key), official.value, unitInfo, entry);
            priceColumnInfo.push({ index, type: 'token', label, official });
        });

        for (const row of rows) {
            const cells = Array.from(row.children);

            for (const column of priceColumnInfo) {
                const cell = cells[column.index];
                if (!cell) {
                    continue;
                }

                if (column.type === 'request') {
                    const requestPrice = parseUsdAmount(getOriginalElementText(cell).match(/[$]([0-9][0-9.,]*(?:[.][0-9]+)?)/)?.[1]);
                    if (requestPrice !== null) {
                        annotatePerRequestPriceCell(cell, requestPrice, entry);
                    }
                    continue;
                }

            const parsedPrice = parseLinkApiTokenPrice(cell);
            if (!parsedPrice || !column.official) {
                continue;
            }

            const linkApiPriceInUsd = convertCnyToUsdDirect(parsedPrice.pricePerMillion);

            appendCompactDelta(
                cell,
                linkApiPriceInUsd,
                column.official.value,
                formatCostKeyLabel(column.official.key),
                {
                    rawPrice: convertCnyToUsdDirect(parsedPrice.rawPrice),
                    pricePerMillion: linkApiPriceInUsd,
                    unitLabel: parsedPrice.unitLabel
                },
                entry
            );
            }
        }
    }

    function annotatePerRequestBasePrice(pricingSection, match) {
        const baseSection = findSectionByHeading(pricingSection, /^base price$/i);
        if (!baseSection || !match?.entry) {
            return;
        }

        const requestPrice = getEntryCost(match.entry, 'request');
        if (requestPrice === null) {
            return;
        }

        const priceElement = Array.from(baseSection.querySelectorAll('.font-mono, [class*="font-mono"]'))
            .find((element) => /[0-9]/.test(getOriginalElementText(element)));
        if (!priceElement) {
            return;
        }

        annotatePerRequestPriceCell(priceElement, requestPrice, match.entry, { showOfficialInline: true });
    }

    function annotateTokenBasePriceCards(pricingSection, match) {
        const baseSection = findSectionByHeading(pricingSection, /^base price$/i);
        if (!baseSection || !match?.entry) {
            return;
        }

        const entry = match.entry;
        const cards = Array.from(baseSection.querySelectorAll('div.rounded-lg, div[class*="rounded-lg"], div.flex'));

        for (const card of cards) {
            const label = normalizeWhitespace(
                getOriginalElementText(card.querySelector('.text-muted-foreground, [class*="text-muted-foreground"]'))
                || getDirectText(card)
                || getOriginalElementText(card)
                || ''
            );

            if (!label || /base price|pricing/i.test(label)) {
                continue;
            }

            const official = getOfficialCostInfoForLabel(label, entry);
            if (!official) {
                continue;
            }

            const priceElement = Array.from(card.querySelectorAll('.font-mono, [class*="font-mono"]'))
                .find((element) => /[0-9]/.test(getOriginalElementText(element)));
            if (!priceElement) {
                continue;
            }

            const rawText = getOriginalElementText(priceElement);
            const matchCny = rawText.match(/(?:¥|￥|CNY|RMB|人民币)?\s*([0-9]+(?:\.[0-9]+)?)/i);
            const cnyVal = matchCny ? Number(matchCny[1]) : null;
            if (cnyVal !== null && Number.isFinite(cnyVal)) {
                const usdValue = cnyVal; // Treat parsed value directly as USD!
                const targetCurr = getTargetCurrency();
                const usdFormatted = formatCurrency(usdValue, 'USD');

                let nextHtml;
                if (targetCurr === 'USD') {
                    nextHtml = `${usdFormatted}<span class="text-muted-foreground/40 ml-1 text-xs font-normal">/ 1M</span>`;
                } else {
                    const converted = convertUsdToTargetClean(usdValue);
                    nextHtml = `${usdFormatted} (${converted.formatted})<span class="text-muted-foreground/40 ml-1 text-xs font-normal">/ 1M</span>`;
                }

                if (priceElement.innerHTML !== nextHtml) {
                    priceElement.innerHTML = nextHtml;
                }
                priceElement.classList.add(`${SCRIPT_ID}-price-annotated`);
            }
        }
    }

    function isModelMarketplacePage() {
        const path = window.location.pathname.toLowerCase();
        if (/^\/(?:pricing|marketplace|models?|model(?:s|-marketplace)?)(?:\/|$)/.test(path)) {
            return true;
        }

        return Array.from(document.querySelectorAll('h1, h2, [role="heading"]')).some((heading) => {
            const text = normalizeWhitespace(heading.textContent || '').toLowerCase();
            return /^(?:model marketplace|model square|模型广场)$/.test(text);
        });
    }

    function annotateModelsDevPricingInPlace() {
        const pricingSections = Array.from(document.querySelectorAll('section')).filter((section) => {
            const heading = section.querySelector(':scope > h2');
            return /^pricing$/i.test(normalizeWhitespace(heading?.textContent || ''));
        });

        for (const pricingSection of pricingSections) {
            const root = findModelRootFromPricingSection(pricingSection);
            const rawModelName = getModelNameForPricingRoot(root);
            if (!rawModelName) {
                continue;
            }

            const match = findModelsDevMatch(rawModelName, root);
            if (!match) {
                continue;
            }

            annotateTokenBasePriceCards(pricingSection, match);
            annotatePerRequestBasePrice(pricingSection, match);

            const groupTable = findSectionByHeading(pricingSection, /^pricing by group$/i)?.querySelector('table');
            if (groupTable) {
                annotatePricingGroupTable(groupTable, match);
            }
        }
    }

    function shouldEnhanceModelsDevPricing() {
        return /\/pricing(?:\/|$)?/i.test(window.location.pathname)
            || isModelMarketplacePage()
            || Boolean(document.querySelector('header h1.font-mono, h3.font-mono'));
    }

    function installModelsDevStyles() {
        const existingStyle = document.getElementById(MODEL_PRICE_STYLE_ID);
        const style = existingStyle || document.createElement('style');
        style.id = MODEL_PRICE_STYLE_ID;
        style.textContent = `
            .${SCRIPT_ID}-models-price-header-note {
                display: block !important;
                margin-top: 2px !important;
                color: rgb(107, 114, 128) !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                font-size: 10px !important;
                font-weight: 650 !important;
                line-height: 1.15 !important;
                text-transform: none !important;
                letter-spacing: 0 !important;
                white-space: normal !important;
            }

            .${SCRIPT_ID}-models-price-cell-note {
                display: block !important;
                margin-top: 2px !important;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
                font-size: 10px !important;
                font-weight: 750 !important;
                line-height: 1.15 !important;
                white-space: nowrap !important;
            }

            .${SCRIPT_ID}-models-price-break-even-note {
                display: block !important;
                margin-top: 2px !important;
                color: rgb(107, 114, 128) !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                font-size: 10px !important;
                font-weight: 650 !important;
                line-height: 1.15 !important;
                white-space: normal !important;
            }

            .${SCRIPT_ID}-models-price-good {
                color: rgb(5, 150, 105) !important;
            }

            .${SCRIPT_ID}-models-price-neutral {
                color: rgb(107, 114, 128) !important;
            }

            .${SCRIPT_ID}-models-price-bad {
                color: rgb(220, 38, 38) !important;
            }
        `;

        if (!existingStyle) {
            document.documentElement.appendChild(style);
        }
    }

    function enhanceModelsDevPricing() {
        if (!shouldEnhanceModelsDevPricing()) {
            return;
        }

        installModelsDevStyles();

        if (modelsDevEntries.length > 0) {
            annotateModelsDevPricingInPlace();
            return;
        }

        loadModelsDevEntries().then(() => {
            if (modelsDevEntries.length > 0) {
                annotateModelsDevPricingInPlace();
            }
        });
    }

    function enhancePage() {
        installHelperStyles();
        enhanceRedemptionInput();
        restorePageControlValues();
        removeStaleArtifacts();
        enhanceModelsDevPricing();
        enhanceDashboardValues();
        updateMenuToggle();
        enhanceTopupButtons();
        enhanceCustomAmount();
        removeQuotaText();
        enhanceConfirmationModal();
        enhanceMinimumLabels();
        enhanceCreemCards();
        enhanceCreemPurchaseModal();
        enhanceBillingHistory();
    }

    function queueEnhancements() {
        if (enhancementQueued) {
            return;
        }

        enhancementQueued = true;
        requestAnimationFrame(() => {
            enhancementQueued = false;
            enhancePage();
            queueMenuPlacement();
        });
    }

    function getElementOwnText(element) {
        return normalizeWhitespace(Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent)
            .join(' '));
    }

    function normalizeMenuText(element) {
        return normalizeWhitespace([
            getElementOwnText(element),
            element.getAttribute?.('aria-label') || '',
            element.getAttribute?.('title') || ''
        ].filter(Boolean).join(' ')).toLowerCase();
    }

    function findAccountMenuCandidate() {
        const menuRoots = Array.from(document.querySelectorAll([
            '[role="menu"]',
            '[aria-label*="account" i]',
            '[aria-label*="user" i]',
            '[aria-label*="profile" i]',
            '[data-state="open"]',
            '.dropdown-menu',
            '.menu',
            '.popover',
            '.dropdown',
            '.ant-dropdown',
            '.ant-dropdown-menu',
            '.chakra-menu__menu-list'
        ].join(','))).filter(isElementVisible);

        const scoring = menuRoots.map((root) => {
            const items = Array.from(root.querySelectorAll('a, button, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'))
                .filter(isElementVisible);
            let score = 0;
            const walletIndex = items.findIndex((item) => ACCOUNT_MENU_WALLET_LABELS.some((label) => normalizeMenuText(item) === label));
            const signOutIndex = items.findIndex((item) => ACCOUNT_MENU_SIGN_OUT_LABELS.some((label) => normalizeMenuText(item).includes(label)));

            if (walletIndex >= 0) {
                score += 5;
            }

            if (signOutIndex >= 0) {
                score += 5;
            }

            if (walletIndex >= 0 && signOutIndex >= 0 && walletIndex < signOutIndex) {
                score += 5;
            }

            if (/menu|dropdown|popover|account|profile|user/i.test(root.className || root.id || root.getAttribute('aria-label') || '')) {
                score += 2;
            }

            return { root, items, score, walletIndex, signOutIndex };
        }).sort((left, right) => right.score - left.score);

        return scoring.find((entry) => entry.walletIndex >= 0 || entry.signOutIndex >= 0) || null;
    }

    function buildMenuToggle() {
        const item = document.createElement('button');
        item.id = MENU_TOGGLE_ID;
        item.type = 'button';
        item.className = MENU_TOGGLE_CLASS;
        item.setAttribute('role', 'menuitemcheckbox');
        item.setAttribute('aria-checked', String(enabled));
        item.setAttribute(`data-${SCRIPT_ID}-menu-toggle`, 'true');
        item.textContent = MENU_TOGGLE_LABEL;
        item.addEventListener('click', () => setEnabled(!enabled));
        return item;
    }

    function placeMenuToggle() {
        if (!menuToggleButton) {
            return;
        }

        const menu = findAccountMenuCandidate();
        if (!menu?.root || !menu.items.length) {
            return;
        }

        const existing = menu.root.querySelector(`#${MENU_TOGGLE_ID}`);
        if (existing && existing !== menuToggleButton) {
            existing.remove();
        }

        document.querySelectorAll(`#${MENU_TOGGLE_ID}`).forEach((element) => {
            if (element !== menuToggleButton) {
                element.remove();
            }
        });

        const walletItem = menu.items.find((item) => ACCOUNT_MENU_WALLET_LABELS.some((label) => normalizeMenuText(item) === label));
        const signOutItem = menu.items.find((item) => ACCOUNT_MENU_SIGN_OUT_LABELS.some((label) => normalizeMenuText(item).includes(label)));

        if (!walletItem && !signOutItem) {
            return;
        }

        menuToggleButton.classList.remove(`${SCRIPT_ID}-fallback`, `${SCRIPT_ID}-nav`, `${SCRIPT_ID}-control`);
        menuToggleButton.setAttribute('aria-checked', String(enabled));
        menuToggleButton.hidden = false;

        if (walletItem) {
            walletItem.insertAdjacentElement('afterend', menuToggleButton);
            return;
        }

        if (signOutItem) {
            signOutItem.insertAdjacentElement('beforebegin', menuToggleButton);
            return;
        }

        menu.root.appendChild(menuToggleButton);
    }

    function queueMenuPlacement() {
        if (menuPlacementQueued) {
            return;
        }

        menuPlacementQueued = true;
        requestAnimationFrame(() => {
            menuPlacementQueued = false;
            placeMenuToggle();
        });
    }

    function updateMenuToggle() {
        if (!menuToggleButton) {
            return;
        }

        menuToggleButton.setAttribute('aria-checked', String(enabled));
        let title = `1 CNY = ${cnyToUsdRate.toFixed(6)} USD${cnyToUsdRateDate ? ` (ECB ${cnyToUsdRateDate})` : ' (fallback rate)'}`;
        if (userCountryCode) {
            title += ` | Location: ${userCountryCode}${userCountryName ? ` (${userCountryName})` : ''}`;
            if (vatRate > 0) {
                title += ` - ${Math.round(vatRate * 100)}% VAT`;
            }
        }
        menuToggleButton.title = title;
        queueMenuPlacement();
    }

    function setEnabled(nextEnabled) {
        enabled = nextEnabled;
        localStorage.setItem(STORAGE_KEY, String(enabled));
        updateMenuToggle();
        queueProcess();
    }

    function installMenuToggle() {
        const existingToggle = document.getElementById(MENU_TOGGLE_ID);
        if (existingToggle) {
            menuToggleButton = existingToggle;
            updateMenuToggle();
            return;
        }

        const existingStyle = document.getElementById(MENU_STYLE_ID);
        const style = existingStyle || document.createElement('style');
        style.id = MENU_STYLE_ID;
        style.textContent = `
            #${MENU_TOGGLE_ID} {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                width: 100%;
                min-height: 40px;
                border: 0;
                border-radius: 10px;
                background: transparent;
                color: rgb(244, 247, 251);
                box-shadow: none;
                cursor: pointer;
                font: 500 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                letter-spacing: 0;
                margin: 0;
                padding: 9px 14px;
                text-align: left;
                transition: background-color 140ms ease-out, color 140ms ease-out;
            }

            #${MENU_TOGGLE_ID}[hidden] {
                display: none !important;
            }

            #${MENU_TOGGLE_ID}:hover,
            #${MENU_TOGGLE_ID}:focus-visible {
                background: rgba(255, 255, 255, 0.06);
                outline: none;
            }

            #${MENU_TOGGLE_ID}[aria-checked="true"] {
                color: rgb(45, 212, 191);
            }

            #${MENU_TOGGLE_ID}[aria-checked="true"]::before {
                content: '✓';
                display: inline-flex;
                width: 16px;
                margin-right: 10px;
                color: currentColor;
                flex: 0 0 auto;
            }

            #${MENU_TOGGLE_ID}[aria-checked="false"]::before {
                content: '';
                display: inline-flex;
                width: 16px;
                margin-right: 10px;
                flex: 0 0 auto;
            }
        `;

        menuToggleButton = buildMenuToggle();

        menuToggleButton.hidden = true;

        if (!existingStyle) {
            document.documentElement.appendChild(style);
        }
        updateMenuToggle();
        queueMenuPlacement();
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
                        const convertedText = convertText(node.__tldLinkApiOriginalText, node);
                        const shouldSkip = enabled
                            ? (node.textContent === convertedText)
                            : (node.textContent === node.__tldLinkApiOriginalText);
                        if (shouldSkip) {
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
                    if (node.id === MENU_TOGGLE_ID || node.id === `${SCRIPT_ID}-style` || node.id === HELPER_STYLE_ID || node.id === MENU_STYLE_ID) {
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

    function detectUserLocation() {
        const cached = safeReadJsonStorage(`${SCRIPT_ID}:user-location`, null);
        if (cached && typeof cached === 'object' && cached.countryCode && Date.now() - Number(cached.fetchedAt || 0) < 24 * 60 * 60 * 1000) {
            userCountryCode = cached.countryCode;
            userCountryName = cached.countryName || '';
            initializeVatRate();
            return Promise.resolve();
        }

        const tzCountryMap = {
            'Europe/Warsaw': 'PL', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/London': 'GB',
            'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE',
            'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI',
            'Europe/Dublin': 'IE', 'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR', 'Europe/Prague': 'CZ',
            'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Bratislava': 'SK', 'Europe/Zagreb': 'HR',
            'Europe/Sofia': 'BG', 'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE',
            'Europe/Ljubljana': 'SI', 'Europe/Nicosia': 'CY', 'Europe/Luxembourg': 'LU', 'Europe/Malta': 'MT'
        };

        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const fallbackCountry = tzCountryMap[tz] || '';

        return fetch('https://ipapi.co/json/')
            .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then(data => {
                userCountryCode = data.country_code || fallbackCountry;
                userCountryName = data.country_name || '';
                initializeVatRate();
                safeWriteJsonStorage(`${SCRIPT_ID}:user-location`, {
                    countryCode: userCountryCode,
                    countryName: userCountryName,
                    fetchedAt: Date.now()
                });
            })
            .catch(() => {
                userCountryCode = fallbackCountry;
                initializeVatRate();
            })
            .finally(() => {
                updateMenuToggle();
                updateWidget();
                queueProcess();
            });
    }

    function getLocalCurrency() {
        const match = COUNTRY_LIST.find(c => c.code === userCountryCode);
        return match ? match.currency : 'USD';
    }

    function getTargetCountry() {
        return localStorage.getItem(`${SCRIPT_ID}:target-country`) || userCountryCode || 'US';
    }

    function getTargetCurrency() {
        return localStorage.getItem(`${SCRIPT_ID}:target-currency`) || getLocalCurrency();
    }

    function initializeVatRate() {
        vatRate = VAT_RATES[userCountryCode] || 0;
    }

    function getTargetRate() {
        const currency = getTargetCurrency();
        return Number(cnyToUsdRates?.[currency]) || FALLBACK_CNY_TO_USD_RATE;
    }

    function convertUsdToTarget(usdValue, applyVat = false) {
        const usdRate = Number(cnyToUsdRates?.['USD']) || cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE;
        const cnyValue = usdValue / usdRate;
        return convertCnyToTarget(cnyValue, applyVat, false); // Stable!
    }

    function convertUsdToTargetDirect(usdValue, applyVat = false, applyFluctuation = true) {
        const usdRate = Number(cnyToUsdRates?.['USD']) || cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE;
        const targetCurr = getTargetCurrency();
        const targetRate = Number(cnyToUsdRates?.[targetCurr]) || (targetCurr === 'USD' ? (cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE) : 1);
        const midMarketRate = targetRate / usdRate;

        const bankMarkup = targetCurr === 'USD' ? 1.0 : 1.03; // 3% bank exchange rate markup
        const rateOffset = applyFluctuation ? liveFluctuation : 1.0;
        let val = usdValue * midMarketRate * bankMarkup * rateOffset;
        const hasVat = applyVat && vatRate > 0;
        if (hasVat) {
            val = val * (1 + vatRate);
        }

        return {
            value: val,
            formatted: formatCurrency(val, targetCurr)
        };
    }

    function convertUsdToTargetClean(usdValue) {
        if (!Number.isFinite(usdValue)) {
            return { value: 0, formatted: '' };
        }
        const usdRate = Number(cnyToUsdRates?.['USD']) || cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE;
        const targetCurr = getTargetCurrency();
        const targetRate = Number(cnyToUsdRates?.[targetCurr]) || (targetCurr === 'USD' ? (cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE) : 1);
        const midMarketRate = targetRate / usdRate;
        const val = usdValue * midMarketRate;
        return {
            value: val,
            currency: targetCurr,
            formatted: formatCurrency(val, targetCurr)
        };
    }

    function convertCnyToTargetClean(cnyValue) {
        if (!Number.isFinite(cnyValue)) {
            return { value: 0, formatted: '' };
        }
        const targetCurr = getTargetCurrency();
        const targetRate = Number(cnyToUsdRates?.[targetCurr]) || (targetCurr === 'USD' ? (cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE) : 1);
        const val = cnyValue * targetRate;
        return {
            value: val,
            currency: targetCurr,
            formatted: formatCurrency(val, targetCurr)
        };
    }

    function convertCnyToTarget(cnyValue, applyVat = true, applyFluctuation = true) {
        const targetCurr = getTargetCurrency();
        const hkdRate = Number(cnyToUsdRates?.['HKD']) || 1.1566;
        const targetRate = Number(cnyToUsdRates?.[targetCurr]) || (targetCurr === 'USD' ? (cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE) : 1);

        const hkdValue = cnyValue * 1.24;
        const midMarketRate = targetRate / hkdRate;
        const stripeMarkup = targetCurr === 'HKD' ? 1.0 : 1.0397;
        const stripeRate = midMarketRate * stripeMarkup;

        const rateOffset = applyFluctuation ? liveFluctuation : 1.0;
        let val = hkdValue * stripeRate * rateOffset;
        const hasVat = applyVat && vatRate > 0;
        if (hasVat) {
            val = val * (1 + vatRate);
        }

        return {
            value: val,
            currency: targetCurr,
            formatted: formatCurrency(val, targetCurr)
        };
    }

    function convertCnyToUsdDirect(cnyValue) {
        if (!Number.isFinite(cnyValue)) return 0;
        const hkdRate = Number(cnyToUsdRates?.['HKD']) || 1.1566;
        const targetRate = Number(cnyToUsdRates?.['USD']) || cnyToUsdRate || FALLBACK_CNY_TO_USD_RATE;
        const hkdValue = cnyValue * 1.24;
        const midMarketRate = targetRate / hkdRate;
        const stripeMarkup = 1.0397;
        const stripeRate = midMarketRate * stripeMarkup;
        return hkdValue * stripeRate;
    }

    function enhanceDashboardValues() {
        const DASH_CLASS = `${SCRIPT_ID}-dashboard-converted`;
        const CNY_RE = /[¥￥]\s*([0-9]+(?:[,.][0-9]+)?)/;

        function convertElement(el) {
            if (el.__tldOriginalDashText === undefined) {
                const text = el.textContent || '';
                if (!CNY_RE.test(text)) {
                    return;
                }
                el.__tldOriginalDashText = text;
                // Permanent marker: keeps the generic text-path converter away
                // from elements this enhancer owns.
                el.classList.add(DASH_CLASS);
            }

            if (!enabled) {
                if (el.textContent !== el.__tldOriginalDashText) {
                    el.textContent = el.__tldOriginalDashText;
                }
                return;
            }

            const match = el.__tldOriginalDashText.match(CNY_RE);
            if (!match) {
                return;
            }
            const cnyValue = Number(match[1].replace(',', ''));
            if (!Number.isFinite(cnyValue)) {
                return;
            }
            const converted = convertCnyToTargetClean(cnyValue);
            if (el.textContent !== converted.formatted) {
                el.textContent = converted.formatted;
            }
        }

        // Dashboard stats bar: Current Balance, Total Usage (may be inside profile card)
        const statValues = document.querySelectorAll('.font-mono.tabular-nums');
        for (const el of statValues) {
            if (el.closest('table') || el.closest('section')) {
                continue;
            }
            convertElement(el);
        }

        // Daily Check-in card stats grid
        const cards = document.querySelectorAll('[data-slot="card"]');
        for (const card of cards) {
            const heading = card.querySelector('h3');
            if (!heading) {
                continue;
            }
            const headingText = (heading.textContent || '').trim().toLowerCase();
            if (!headingText.includes('check-in') && !headingText.includes('签到') && !headingText.includes('checkin')) {
                continue;
            }
            const valueEls = card.querySelectorAll('.tabular-nums');
            for (const el of valueEls) {
                if (el.closest('button')) {
                    continue;
                }
                convertElement(el);
            }
        }
    }

    function enhanceTopupButtons() {
        const buttons = Array.from(document.querySelectorAll('button[data-slot="button"]'));
        for (const button of buttons) {
            const bigNumDiv = button.querySelector('.text-base.font-semibold, [class*="text-base"][class*="font-semibold"]');
            const payDiv = button.querySelector('.text-muted-foreground');
            if (!bigNumDiv || !payDiv) {
                continue;
            }

            const rawNum = bigNumDiv.textContent?.replace(/[¥￥\sCNY元,]/g, '').trim();
            const cnyValue = Number(rawNum);
            if (!Number.isFinite(cnyValue) || cnyValue <= 0) {
                continue;
            }

            const payText = payDiv.textContent || '';
            if (!payText.toLowerCase().includes('pay')) {
                continue;
            }

            if (button.__tldOriginalBigNum === undefined) {
                button.__tldOriginalBigNum = bigNumDiv.textContent;
                button.__tldOriginalPayText = payDiv.textContent;
            }

            if (enabled) {
                const formattedCny = cnyValue.toLocaleString('en-US');
                bigNumDiv.textContent = `¥${formattedCny}`;

                const local = convertCnyToTarget(cnyValue, false, true);
                payDiv.textContent = `Pay ~${local.formatted}`;
            } else {
                bigNumDiv.textContent = button.__tldOriginalBigNum;
                payDiv.textContent = button.__tldOriginalPayText;
            }
        }
    }

    function enhanceCustomAmount() {
        const input = document.getElementById('topup-amount');
        const label = document.querySelector('label[for="topup-amount"]');
        if (label) {
            if (label.__tldOriginalText === undefined) {
                label.__tldOriginalText = label.textContent;
            }
            if (enabled) {
                const nextLabel = 'Custom Amount (CNY)';
                if (label.textContent !== nextLabel) {
                    label.textContent = nextLabel;
                }
            } else {
                label.textContent = label.__tldOriginalText;
            }
        }

        if (input) {
            if (input.__tldOriginalPlaceholder === undefined) {
                input.__tldOriginalPlaceholder = input.placeholder;
            }
            if (enabled) {
                const nextPlaceholder = 'Minimum 1 CNY';
                if (input.placeholder !== nextPlaceholder) {
                    input.placeholder = nextPlaceholder;
                }
            } else {
                input.placeholder = input.__tldOriginalPlaceholder;
            }

            const container = input.closest('div');
            if (container) {
                const valueSpan = container.querySelector('.text-sm.font-semibold, [class*="text-sm"][class*="font-semibold"]');
                if (valueSpan) {
                    const rawVal = valueSpan.textContent?.replace(/[¥￥\sCNY元,]/g, '').split('(')[0].trim();
                    const num = Number(rawVal);
                    if (Number.isFinite(num) && num > 0) {
                        if (valueSpan.__tldOriginalVal === undefined || valueSpan.__tldOriginalVal !== rawVal) {
                            valueSpan.__tldOriginalVal = rawVal;
                        }
                        const local = convertCnyToTarget(num, false, true);
                        const formattedCny = num.toLocaleString('en-US');
                        const nextText = `¥${formattedCny} (~${local.formatted})`;
                        if (valueSpan.textContent !== nextText) {
                            valueSpan.textContent = nextText;
                        }
                    }
                }
            }
        }
    }

    function removeQuotaText() {
        const elements = Array.from(document.querySelectorAll('div, span, p'));
        for (const el of elements) {
            const text = el.textContent || '';
            if (/^Quota:\s*/i.test(text.trim())) {
                if (enabled) {
                    if (el.style.display !== 'none') {
                        el.__tldOriginalDisplay = el.style.display;
                        el.style.display = 'none';
                    }
                } else {
                    if (el.__tldOriginalDisplay !== undefined) {
                        el.style.display = el.__tldOriginalDisplay;
                    }
                }
            }
        }
    }

    function enhanceConfirmationModal() {
        const modal = document.querySelector('[role="alertdialog"], [data-slot="alert-dialog-content"]');
        if (!modal) return;

        const rows = Array.from(modal.querySelectorAll('div.flex.items-center.justify-between'));
        for (const row of rows) {
            const labelSpan = row.querySelector('span');
            if (labelSpan && labelSpan.textContent.trim().toLowerCase() === 'you pay') {
                const valSpan = row.querySelector('.text-2xl.font-semibold, [class*="text-2xl"][class*="font-semibold"]');
                if (valSpan) {
                    if (valSpan.__tldOriginalText === undefined) {
                        valSpan.__tldOriginalText = valSpan.textContent;
                    }

                    if (enabled) {
                        const rawVal = valSpan.__tldOriginalText.replace(/[¥￥\sCNY元,]/g, '').trim();
                        const cnyValue = Number(rawVal);
                        if (Number.isFinite(cnyValue) && cnyValue > 0) {
                            const local = convertCnyToTarget(cnyValue, false, true);
                            const nextText = `~${local.formatted}`;
                            if (valSpan.textContent !== nextText) {
                                valSpan.textContent = nextText;
                            }
                        }
                    } else {
                        if (valSpan.textContent !== valSpan.__tldOriginalText) {
                            valSpan.textContent = valSpan.__tldOriginalText;
                        }
                    }
                }
            }
        }
    }

    function enhanceMinimumLabels() {
        const spans = Array.from(document.querySelectorAll('span, div, p'));
        for (const el of spans) {
            if (el.children.length > 0) continue;
            const text = el.textContent || '';
            const match = text.match(/^(Minimum:\s*)(\d+)$/i);
            if (match) {
                if (el.__tldOriginalText === undefined) {
                    el.__tldOriginalText = text;
                }
                if (enabled) {
                    const nextText = `${match[1]}¥${match[2]}`;
                    if (el.textContent !== nextText) {
                        el.textContent = nextText;
                    }
                } else {
                    if (el.textContent !== el.__tldOriginalText) {
                        el.textContent = el.__tldOriginalText;
                    }
                }
            }
        }

        const buttons = Array.from(document.querySelectorAll('button[title*="Minimum"], button[aria-label*="Minimum"]'));
        for (const btn of buttons) {
            const title = btn.getAttribute('title') || '';
            const titleMatch = title.match(/^(Minimum topup amount:\s*)(\d+)$/i);
            if (titleMatch) {
                if (btn.__tldOriginalTitle === undefined) {
                    btn.__tldOriginalTitle = title;
                }
                if (enabled) {
                    const nextTitle = `${titleMatch[1]}¥${titleMatch[2]}`;
                    if (btn.getAttribute('title') !== nextTitle) {
                        btn.setAttribute('title', nextTitle);
                    }
                } else {
                    if (btn.getAttribute('title') !== btn.__tldOriginalTitle) {
                        btn.setAttribute('title', btn.__tldOriginalTitle);
                    }
                }
            }

            const ariaLabel = btn.getAttribute('aria-label') || '';
            const ariaMatch = ariaLabel.match(/^(Stripe\.\s*Minimum topup amount:\s*)(\d+)$/i);
            if (ariaMatch) {
                if (btn.__tldOriginalAriaLabel === undefined) {
                    btn.__tldOriginalAriaLabel = ariaLabel;
                }
                if (enabled) {
                    const nextAria = `${ariaMatch[1]}¥${ariaMatch[2]}`;
                    if (btn.getAttribute('aria-label') !== nextAria) {
                        btn.setAttribute('aria-label', nextAria);
                    }
                } else {
                    if (btn.getAttribute('aria-label') !== btn.__tldOriginalAriaLabel) {
                        btn.setAttribute('aria-label', btn.__tldOriginalAriaLabel);
                    }
                }
            }
        }
    }

    function enhanceCreemCards() {
        const cards = Array.from(document.querySelectorAll('[data-slot="card"]'));
        const creemCards = cards.filter(card => {
            const titleDiv = card.querySelector('.mb-2.text-lg.font-medium, [class*="text-lg"][class*="font-medium"]');
            if (!titleDiv) return false;
            const text = titleDiv.__tldOriginalText || titleDiv.textContent || '';
            return /LinkAPI\s*-\s*\d+\s*Credits/i.test(text);
        });

        for (const card of creemCards) {
            const titleDiv = card.querySelector('.mb-2.text-lg.font-medium, [class*="text-lg"][class*="font-medium"]');
            if (titleDiv) {
                if (titleDiv.__tldOriginalText === undefined) {
                    titleDiv.__tldOriginalText = titleDiv.textContent || '';
                }
                if (enabled) {
                    const creditsMatch = titleDiv.__tldOriginalText.match(/LinkAPI\s*-\s*([\d,]+)\s*Credits/i);
                    if (creditsMatch) {
                        const creditsCny = Number(creditsMatch[1].replace(/,/g, ''));
                        const formattedCny = creditsCny.toLocaleString('en-US');
                        const nextTitle = `Top-up ¥${formattedCny}`;
                        if (titleDiv.textContent !== nextTitle) {
                            titleDiv.textContent = nextTitle;
                        }
                    }
                } else {
                    if (titleDiv.textContent !== titleDiv.__tldOriginalText) {
                        titleDiv.textContent = titleDiv.__tldOriginalText;
                    }
                }
            }

            const priceDiv = card.querySelector('.text-primary.text-lg.font-semibold, [class*="text-primary"][class*="text-lg"][class*="font-semibold"]');
            if (priceDiv) {
                if (priceDiv.__tldOriginalText === undefined) {
                    priceDiv.__tldOriginalText = priceDiv.textContent || '';
                }

                if (enabled) {
                    const rawVal = priceDiv.__tldOriginalText.replace(/[$\s,]/g, '').trim();
                    const usdValue = Number(rawVal);
                    if (Number.isFinite(usdValue) && usdValue > 0) {
                        const usdWithVat = usdValue * (1 + vatRate);
                        const formattedUsd = formatCurrency(usdWithVat, 'USD');
                        const badgeHtml = `<span style="display: inline-block; font-size: 11px; font-weight: 500; line-height: 1.2; padding: 3px 6px; border-radius: 6px; background: rgba(45, 212, 191, 0.12); color: rgb(45, 212, 191); border: 1px solid rgba(45, 212, 191, 0.25); margin-left: 6px; vertical-align: middle;">incl. ${Math.round(vatRate * 100)}% VAT</span>`;

                        const targetCurr = getTargetCurrency();
                        if (targetCurr !== 'USD') {
                            const local = convertUsdToTargetDirect(usdValue, true);
                            const nextHtml = vatRate > 0
                                ? `${formattedUsd} (~${local.formatted}) ${badgeHtml}`
                                : `${formattedUsd} (~${local.formatted})`;
                            if (priceDiv.innerHTML !== nextHtml) {
                                priceDiv.innerHTML = nextHtml;
                            }
                        } else {
                            const nextHtml = vatRate > 0
                                ? `${formattedUsd} ${badgeHtml}`
                                : formattedUsd;
                            if (priceDiv.innerHTML !== nextHtml) {
                                priceDiv.innerHTML = nextHtml;
                            }
                        }
                    }
                } else {
                    if (priceDiv.innerHTML !== priceDiv.__tldOriginalText) {
                        priceDiv.innerHTML = priceDiv.__tldOriginalText;
                    }
                }
            }
        }
    }

    function enhanceCreemPurchaseModal() {
        const modal = document.querySelector('[role="dialog"], [data-slot="dialog-content"]');
        if (!modal) return;

        const titleEl = modal.querySelector('[data-slot="dialog-title"]');
        const isCreemModal = titleEl && /confirm\s+creem\s+purchase/i.test(titleEl.textContent || '');
        if (!isCreemModal) return;

        const rows = Array.from(modal.querySelectorAll('div.flex.items-center.justify-between'));
        for (const row of rows) {
            const labelEl = row.querySelector('.text-muted-foreground');
            if (!labelEl) continue;

            const labelText = labelEl.textContent.trim().toLowerCase();
            if (labelText === 'product') {
                const valEl = row.querySelector('.font-medium, span:last-child');
                if (valEl) {
                    if (valEl.__tldOriginalText === undefined) {
                        valEl.__tldOriginalText = valEl.textContent || '';
                    }
                    if (enabled) {
                        const creditsMatch = valEl.__tldOriginalText.match(/LinkAPI\s*-\s*([\d,]+)\s*Credits/i);
                        if (creditsMatch) {
                            const creditsCny = Number(creditsMatch[1].replace(/,/g, ''));
                            const formattedCny = creditsCny.toLocaleString('en-US');
                            const nextTitle = `Top-up ¥${formattedCny}`;
                            if (valEl.textContent !== nextTitle) {
                                valEl.textContent = nextTitle;
                            }
                        }
                    } else {
                        if (valEl.textContent !== valEl.__tldOriginalText) {
                            valEl.textContent = valEl.__tldOriginalText;
                        }
                    }
                }
            } else if (labelText === 'price') {
                const valEl = row.querySelector('.text-primary, span:last-child');
                if (valEl) {
                    if (valEl.__tldOriginalText === undefined) {
                        valEl.__tldOriginalText = valEl.textContent || '';
                    }
                    if (enabled) {
                        const rawVal = valEl.__tldOriginalText.replace(/[$\s,]/g, '').trim();
                        const usdValue = Number(rawVal);
                        if (Number.isFinite(usdValue) && usdValue > 0) {
                            const usdWithVat = usdValue * (1 + vatRate);
                            const formattedUsd = formatCurrency(usdWithVat, 'USD');
                            const badgeHtml = `<span style="display: inline-block; font-size: 11px; font-weight: 500; line-height: 1.2; padding: 3px 6px; border-radius: 6px; background: rgba(45, 212, 191, 0.12); color: rgb(45, 212, 191); border: 1px solid rgba(45, 212, 191, 0.25); margin-left: 6px; vertical-align: middle;">incl. ${Math.round(vatRate * 100)}% VAT</span>`;

                            const targetCurr = getTargetCurrency();
                            if (targetCurr !== 'USD') {
                                const local = convertUsdToTargetDirect(usdValue, true, true);
                                const nextHtml = vatRate > 0
                                    ? `${formattedUsd} (~${local.formatted}) ${badgeHtml}`
                                    : `${formattedUsd} (~${local.formatted})`;
                                if (valEl.innerHTML !== nextHtml) {
                                    valEl.innerHTML = nextHtml;
                                }
                            } else {
                                const nextHtml = vatRate > 0
                                    ? `${formattedUsd} ${badgeHtml}`
                                    : formattedUsd;
                                if (valEl.innerHTML !== nextHtml) {
                                    valEl.innerHTML = nextHtml;
                                }
                            }
                        }
                    } else {
                        if (valEl.innerHTML !== valEl.__tldOriginalText) {
                            valEl.innerHTML = valEl.__tldOriginalText;
                        }
                    }
                }
            } else if (labelText === 'quota') {
                if (enabled) {
                    if (row.style.display !== 'none') {
                        row.__tldOriginalDisplay = row.style.display;
                        row.style.display = 'none';
                    }
                } else {
                    if (row.__tldOriginalDisplay !== undefined) {
                        row.style.display = row.__tldOriginalDisplay;
                    }
                }
            }
        }
    }

    function enhanceBillingHistory() {
        const dialog = document.querySelector('[role="dialog"], [data-slot="dialog-content"]');
        if (!dialog) return;

        const titleEl = dialog.querySelector('[data-slot="dialog-title"]');
        const isBillingHistory = titleEl && /billing\s+history/i.test(titleEl.textContent || '');
        if (!isBillingHistory) return;

        const txCards = Array.from(dialog.querySelectorAll('.rounded-lg.border.p-3, .rounded-lg.border.p-4'));
        for (const card of txCards) {
            const columns = Array.from(card.querySelectorAll('.space-y-1, [class*="space-y-1"]'));
            let paymentMethod = '';
            let paymentDiv = null;

            for (const col of columns) {
                const label = col.querySelector('label')?.textContent?.trim()?.toLowerCase() || '';
                const valueDiv = col.querySelector('div');
                if (!valueDiv) continue;

                if (label.includes('payment method')) {
                    paymentMethod = valueDiv.textContent?.trim()?.toLowerCase() || '';
                } else if (label.includes('payment')) {
                    paymentDiv = valueDiv;
                }
            }

            if (paymentDiv) {
                if (paymentDiv.__tldOriginalText === undefined) {
                    paymentDiv.__tldOriginalText = paymentDiv.textContent || '';
                }

                if (enabled) {
                    const rawVal = paymentDiv.__tldOriginalText.replace(/[¥￥\sCNY元$PLNzł,]/g, '').trim();
                    const originalPayVal = Number(rawVal);
                    if (Number.isFinite(originalPayVal) && originalPayVal > 0) {
                        let formatted = '';
                        if (paymentMethod === 'creem') {
                            const local = convertUsdToTargetDirect(originalPayVal, true, false);
                            formatted = local.formatted;
                        } else {
                            const local = convertCnyToTarget(originalPayVal, false, false);
                            formatted = local.formatted;
                        }
                        if (paymentDiv.textContent !== formatted) {
                            paymentDiv.textContent = formatted;
                        }
                    }
                } else {
                    if (paymentDiv.textContent !== paymentDiv.__tldOriginalText) {
                        paymentDiv.textContent = paymentDiv.__tldOriginalText;
                    }
                }
            }
        }
    }

    function renderOptions(filterText = '') {
        const listContainer = document.getElementById(`${SCRIPT_ID}-options-list`);
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const searchVal = filterText.toLowerCase().trim();

        const currentCurrency = getTargetCurrency();
        const currentCountry = getTargetCountry();

        const filtered = COUNTRY_LIST.filter(item => {
            return item.name.toLowerCase().includes(searchVal) ||
                   item.currency.toLowerCase().includes(searchVal) ||
                   item.code.toLowerCase().includes(searchVal);
        });

        if (filtered.length === 0) {
            const noRes = document.createElement('div');
            noRes.className = `${SCRIPT_ID}-no-results`;
            noRes.textContent = 'No matching countries';
            listContainer.appendChild(noRes);
            return;
        }

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = `${SCRIPT_ID}-option-item`;
            if (item.currency === currentCurrency && item.code === currentCountry) {
                div.classList.add('selected');
            }
            div.innerHTML = `
                <span class="${SCRIPT_ID}-option-country">${item.name} (${item.currency})</span>
            `;
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                localStorage.setItem(`${SCRIPT_ID}:target-currency`, item.currency);
                localStorage.setItem(`${SCRIPT_ID}:target-country`, item.code);

                // Trigger dynamic page update — VAT stays tied to detected location
                document.querySelectorAll(`[${SPLIT_CURRENCY_ATTR}="true"]`).forEach(restoreSplitCurrencyElement);
                walkTextNodes(document.body, restoreTextNode);
                updateMenuToggle();
                updateWidget();
                queueProcess();

                // Hide options list
                const optionsList = document.getElementById(`${SCRIPT_ID}-options-list`);
                if (optionsList) optionsList.style.display = 'none';
            });
            listContainer.appendChild(div);
        });
    }

    function installWidget() {
        const existingWidget = document.getElementById(`${SCRIPT_ID}-currency-widget`);
        if (existingWidget) {
            updateWidget();
            return;
        }

        const widget = document.createElement('div');
        widget.id = `${SCRIPT_ID}-currency-widget`;
        widget.className = `${SCRIPT_ID}-widget-container`;
        widget.innerHTML = `
            <button type="button" class="${SCRIPT_ID}-widget-trigger" title="Currency Settings">
                <span>⇆</span>
            </button>
            <div class="${SCRIPT_ID}-widget-popup" hidden>
                <div class="${SCRIPT_ID}-widget-header">
                    <h3>Currency & Tax Settings</h3>
                    <button type="button" class="${SCRIPT_ID}-widget-close">×</button>
                </div>
                <div class="${SCRIPT_ID}-widget-body">
                    <div class="${SCRIPT_ID}-field">
                        <label>Target Currency</label>
                        <div class="${SCRIPT_ID}-searchable-select">
                            <input type="text" id="${SCRIPT_ID}-search-input" placeholder="Search country or currency..." autocomplete="off">
                            <div id="${SCRIPT_ID}-options-list" class="${SCRIPT_ID}-options-list"></div>
                        </div>
                    </div>
                    <div class="${SCRIPT_ID}-info">
                        <p><span>Location:</span> <span id="${SCRIPT_ID}-info-country">-</span></p>
                        <p><span>VAT:</span> <span id="${SCRIPT_ID}-info-vat">-</span></p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(widget);

        const trigger = widget.querySelector(`.${SCRIPT_ID}-widget-trigger`);
        const popup = widget.querySelector(`.${SCRIPT_ID}-widget-popup`);
        const closeBtn = widget.querySelector(`.${SCRIPT_ID}-widget-close`);
        const searchInput = widget.querySelector(`#${SCRIPT_ID}-search-input`);

        const optionsList = widget.querySelector(`#${SCRIPT_ID}-options-list`);

        function showOptions() {
            if (optionsList) {
                optionsList.style.display = 'flex';
                renderOptions(searchInput ? searchInput.value : '');
            }
        }

        function hideOptions() {
            if (optionsList) {
                optionsList.style.display = 'none';
            }
        }

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = !popup.hidden;
            popup.hidden = isHidden;
            if (!isHidden && searchInput) {
                searchInput.value = '';
            }
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.hidden = true;
            hideOptions();
        });

        popup.addEventListener('click', (e) => {
            const selectContainer = widget.querySelector(`.${SCRIPT_ID}-searchable-select`);
            if (selectContainer && !selectContainer.contains(e.target)) {
                hideOptions();
            }
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            popup.hidden = true;
            hideOptions();
        });

        if (searchInput) {
            ['focus', 'click', 'input'].forEach(evt => {
                searchInput.addEventListener(evt, (e) => {
                    e.stopPropagation();
                    showOptions();
                });
            });
        }

        updateWidget();
    }

    function updateWidget() {
        const widget = document.getElementById(`${SCRIPT_ID}-currency-widget`);
        if (!widget) return;

        const countrySpan = widget.querySelector(`#${SCRIPT_ID}-info-country`);
        if (countrySpan) {
            countrySpan.textContent = userCountryCode ? `${userCountryCode}${userCountryName ? ` (${userCountryName})` : ''}` : 'Unknown';
        }

        const vatSpan = widget.querySelector(`#${SCRIPT_ID}-info-vat`);
        if (vatSpan) {
            vatSpan.textContent = vatRate > 0 ? `${Math.round(vatRate * 100)}%` : '0% / None';
        }
    }

    function boot() {
        removeStaleArtifacts();
        initializeVatRate();
        if (!loadCachedFxRate()) {
            refreshCnyToUsdRate();
        }
        detectUserLocation().then(() => {
            initializeVatRate();
            updateWidget();
        });
        installWidget();

        loadCachedModelsDevEntries();
        installMenuToggle();
        installObserver();
        document.addEventListener('change', handlePageControlChange, true);
        document.addEventListener('input', handlePageControlChange, true);
        processRoot();
        processAccessibleFrames();
        enhancePage();

        // Dynamic ticker and cache refresh polling
        setInterval(() => {
            if (!enabled || document.hidden) return;

            const cached = safeReadJsonStorage(FX_RATE_STORAGE_KEY, null);
            if (!cached || !fxRateLoadPromise || Date.now() - Number(cached.fetchedAt || 0) > FX_RATE_TTL_MS) {
                if (!loadCachedFxRate()) {
                    refreshCnyToUsdRate();
                }
            }

            const drift = (Math.random() - 0.5) * 0.0004;
            liveFluctuation = Math.min(Math.max(liveFluctuation + drift, 0.999), 1.001);

            enhancePage();
            document.querySelectorAll(`[${SPLIT_CURRENCY_ATTR}="true"]`).forEach(restoreSplitCurrencyElement);
            walkTextNodes(document.body, restoreTextNode);
            queueProcess();
        }, 4000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.addEventListener('load', () => {
        queueProcess();
        queueMenuPlacement();
    }, { once: true });
    window.addEventListener('pageshow', () => {
        queueProcess();
        queueMenuPlacement();
    });
})();
