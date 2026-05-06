// ==UserScript==
// @name         LinkAPI USD And English
// @namespace    https://violentmonkey.github.io/
// @version      2.1
// @description  Replace CNY values with USD and clean up mixed Chinese text on LinkAPI
// @author       TheLonelyDevil
// @updateURL    https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js
// @downloadURL  https://raw.githubusercontent.com/TheLonelyDevil9/LinkAPI-Currency-And-Translation/main/LinkAPI%20USD%20And%20English.user.js
// @match        https://api.linkapi.ai/*
// @match        https://linkapi.ai/*
// @match        https://hk.linkapi.ai/*
// @match        https://jp.linkapi.ai/*
// @match        https://home.linkapi.ai/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_ID = 'tld-linkapi-cny-usd';
    const STORAGE_KEY = `${SCRIPT_ID}:enabled`;
    const CNY_TO_USD_RATE = 0.146201;

    const PREFIX_CNY_PATTERN = /(?<![\w$])(?:CNY|RMB|CN¥|CN￥|¥|￥|人民币)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?!\s*(?:CNY|RMB|元)?\s*\))/gi;
    const SUFFIX_CNY_PATTERN = /(?<![\w$])([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:CNY|RMB|人民币|元)(?!\s*\))/gi;
    const CNY_UNIT_LABEL_PATTERN = /\((?:CNY|RMB)\)/gi;
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE']);
    const HAS_CJK_PATTERN = /[\u3400-\u9fff]/;
    const BILINGUAL_SEPARATOR_PATTERN = /\s*(?:\/|／|\||｜)\s*/;
    const ENGLISH_TEXT_PATTERN = /[A-Za-z][A-Za-z0-9\s()[\].,:'"#+&%!?-]*$/;
    const URL_OR_KEY_PATTERN = /^(?:https?:\/\/|sk-|pk-|[A-Za-z0-9_-]{24,})/;
    const TRANSLATIONS = new Map([
        ['当前余额', 'Current Balance'],
        ['历史用量', 'Historical Usage'],
        ['总用量', 'Total Usage'],
        ['剩余额度', 'Remaining Quota'],
        ['总消耗额度', 'Total Consumed Quota'],
        ['总请求数', 'Total Requests'],
        ['请求次数', 'Request Count'],
        ['令牌管理', 'API Keys'],
        ['使用日志', 'Usage Logs'],
        ['任务日志', 'Task Logs'],
        ['钱包', 'Wallet'],
        ['充值', 'Recharge'],
        ['公告', 'Announcements'],
        ['点击查看详情', 'Click For Details'],
        ['暂无数据', 'No Data'],
        ['无数据', 'No Data'],
        ['加载中', 'Loading'],
        ['复制', 'Copy'],
        ['已复制', 'Copied'],
        ['打开新标签页', 'Open In New Tab'],
        ['测试延迟', 'Test Latency'],
        ['外部测速', 'External Speed Test'],
        ['复制地址', 'Copy URL'],
        ['模型广场', 'Model Square'],
        ['控制台', 'Console'],
        ['首页', 'Home'],
        ['排名', 'Rankings'],
        ['概览', 'Overview'],
        ['仪表盘', 'Dashboard'],
        ['个人资料', 'Profile'],
        ['个人中心', 'Profile'],
        ['分组', 'Group'],
        ['倍率', 'Rate'],
        ['按次', 'Per Request'],
        ['按量', 'Usage Based'],
        ['特价', 'Special Price'],
        ['缓存', 'Cache'],
        ['输入', 'Input'],
        ['输出', 'Output'],
        ['状态', 'Status'],
        ['模型', 'Model'],
        ['时间', 'Time'],
        ['创建时间', 'Created At'],
        ['消耗', 'Cost'],
        ['余额', 'Balance'],
        ['价格', 'Price'],
        ['请求', 'Request'],
        ['响应', 'Response'],
        ['成功', 'Success'],
        ['失败', 'Failed'],
        ['错误', 'Error'],
        ['处理中', 'Processing'],
        ['已完成', 'Completed'],
        ['全部', 'All'],
        ['搜索', 'Search'],
        ['筛选', 'Filter'],
        ['上一页', 'Previous'],
        ['下一页', 'Next'],
        ['详情', 'Details'],
        ['删除', 'Delete'],
        ['编辑', 'Edit'],
        ['保存', 'Save'],
        ['取消', 'Cancel'],
        ['确认', 'Confirm'],
        ['关闭', 'Close'],
        ['刷新', 'Refresh'],
        ['导出', 'Export'],
        ['导入', 'Import'],
        ['语言', 'Language'],
        ['英文', 'English'],
        ['中文', 'Chinese'],
        ['美国直连线路', 'US Direct Route'],
        ['香港直接线路', 'HK Direct Route'],
        ['日本SoftBanK', 'Japan SoftBank'],
        ['香港CN2GIA', 'Hong Kong CN2GIA'],
        ['软银优质线路', 'SoftBank Premium Route'],
        ['高带宽', 'High Bandwidth'],
        ['推荐', 'Recommended'],
        ['生图视频使用这个', 'Use This For Image Generation And Video'],
        ['非流限制', 'Non-Streaming Limit'],
        ['切换别的线路', 'Switch To Another Route'],
        ['市场断货缺货', 'Market Supply Shortage'],
        ['价格上调', 'Price Increase'],
        ['价格下调', 'Price Decrease'],
        ['恢复稳定状态', 'Stable Again'],
        ['新增', 'Added'],
        ['上线', 'Live'],
        ['分组更新', 'Group Update'],
        ['分组调整', 'Group Adjustment'],
        ['模型命名规则说明', 'Model Naming Rules'],
        ['接入指南', 'Integration Guide'],
        ['新手必读', 'Beginner Must Read'],
        ['常见问题指南', 'FAQ Guide'],
        ['注册问题', 'Registration Issues'],
        ['充值问题', 'Recharge Issues'],
        ['手机点充值无反应', 'Recharge Button Does Not Respond On Mobile'],
        ['建议使用手', 'Try Using A Desktop Browser'],
        ['令牌管理->聊天->▽，支持 CC Switch/Cherry Studio 一键导入', 'API Keys -> Chat -> Dropdown Supports One-Click Import For CC Switch/Cherry Studio'],
        ['绘图模型调整', 'Image Model Adjustment'],
        ['对话用户切勿使用', 'Chat Users Should Not Use It'],
        ['以免产生不必要的消耗', 'Avoid Unnecessary Usage'],
        ['渠道升级与价格调整公告', 'Channel Upgrade And Price Adjustment Notice'],
        ['内容中断与空回复提示', 'Interrupted Or Empty Response Notice'],
        ['关于空回,流式截断以及报错的原因', 'Why Empty Replies, Stream Truncation, And Errors Happen'],
        ['关于模型回复速度慢的解答', 'Why Model Responses Can Be Slow'],
        ['暂无可用渠道', 'No Available Channels'],
        ['无描述', 'No Description'],
        ['暂无描述', 'No Description'],
        ['未配置运行时间监控', 'No Uptime Monitoring Configured']
    ]);

    let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    let observer = null;
    let queued = false;
    let toggleButton = null;

    function toNumber(rawAmount) {
        return Number(rawAmount.replace(/,/g, ''));
    }

    function formatUsd(cnyValue) {
        const usdValue = cnyValue * CNY_TO_USD_RATE;
        const fractionDigits = Math.abs(usdValue) < 0.01 && usdValue !== 0 ? 4 : 2;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        }).format(usdValue);
    }

    function normalizeWhitespace(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    function looksLikeEnglish(text) {
        return ENGLISH_TEXT_PATTERN.test(text.trim());
    }

    function stripBilingualText(text) {
        if (!HAS_CJK_PATTERN.test(text) || !BILINGUAL_SEPARATOR_PATTERN.test(text)) {
            return text;
        }

        const leading = text.match(/^\s*/)?.[0] ?? '';
        const trailing = text.match(/\s*$/)?.[0] ?? '';
        const parts = text.trim().split(BILINGUAL_SEPARATOR_PATTERN).map((part) => part.trim()).filter(Boolean);
        const englishParts = parts.filter((part) => !HAS_CJK_PATTERN.test(part) && looksLikeEnglish(part));

        if (englishParts.length === 0) {
            return text;
        }

        return `${leading}${englishParts.join(' / ')}${trailing}`;
    }

    function translateChineseText(text) {
        if (!HAS_CJK_PATTERN.test(text) || URL_OR_KEY_PATTERN.test(text.trim())) {
            return text;
        }

        let nextText = stripBilingualText(text);
        if (!HAS_CJK_PATTERN.test(nextText)) {
            return nextText;
        }

        const leading = nextText.match(/^\s*/)?.[0] ?? '';
        const trailing = nextText.match(/\s*$/)?.[0] ?? '';
        const compactText = normalizeWhitespace(nextText);

        if (TRANSLATIONS.has(compactText)) {
            return `${leading}${TRANSLATIONS.get(compactText)}${trailing}`;
        }

        for (const [source, target] of TRANSLATIONS) {
            nextText = nextText.replaceAll(source, target);
        }

        return nextText;
    }

    function convertText(text) {
        const replaceAmount = (match, rawAmount) => {
            const cnyValue = toNumber(rawAmount);
            if (!Number.isFinite(cnyValue)) {
                return match;
            }

            return formatUsd(cnyValue);
        };

        const convertedCurrencyText = text
            .replace(PREFIX_CNY_PATTERN, replaceAmount)
            .replace(SUFFIX_CNY_PATTERN, replaceAmount)
            .replace(CNY_UNIT_LABEL_PATTERN, '(USD)');

        return translateChineseText(convertedCurrencyText);
    }

    function shouldSkipNode(node) {
        const parent = node.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest(`#${SCRIPT_ID}-toggle`)) {
            return true;
        }

        return false;
    }

    function processTextNode(node) {
        if (shouldSkipNode(node)) {
            return;
        }

        const originalText = node.__tldCnyOriginalText ?? node.textContent;
        const convertedText = convertText(originalText);

        if (convertedText === originalText) {
            return;
        }

        node.__tldCnyOriginalText = originalText;
        if (node.textContent !== convertedText) {
            node.textContent = convertedText;
        }
    }

    function restoreTextNode(node) {
        if (node.__tldCnyOriginalText !== undefined && node.textContent !== node.__tldCnyOriginalText) {
            node.textContent = node.__tldCnyOriginalText;
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

    function queueProcess(root = document.body) {
        if (queued) {
            return;
        }

        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            processRoot(root);
            processAccessibleFrames();
        });
    }

    function processAccessibleFrames() {
        const frames = Array.from(document.querySelectorAll('iframe'));

        frames.forEach((frame) => {
            let frameDocument;

            try {
                frameDocument = frame.contentDocument;
            } catch (_) {
                return;
            }

            if (frameDocument?.body) {
                processRoot(frameDocument.body);
            }
        });
    }

    function updateToggle() {
        if (!toggleButton) {
            return;
        }

        toggleButton.setAttribute('aria-pressed', String(enabled));
        toggleButton.textContent = enabled ? 'USD + EN' : 'Original';
        toggleButton.title = enabled ? 'Show original CNY and Chinese text' : 'Convert CNY values to USD and clean up Chinese text';
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
        style.id = `${SCRIPT_ID}-style`;
        style.textContent = `
            #${SCRIPT_ID}-toggle {
                position: fixed;
                right: 16px;
                bottom: 16px;
                z-index: 2147483647;
                width: 112px;
                height: 38px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(20, 29, 42, 0.2);
                border-radius: 999px;
                background: rgba(245, 247, 250, 0.96);
                color: rgb(30, 38, 51);
                box-shadow: 0 12px 28px rgba(8, 13, 23, 0.22);
                cursor: pointer;
                font: 750 12px/1.1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                letter-spacing: 0;
                padding: 0 14px 0 40px;
                transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out, box-shadow 160ms ease-out;
            }

            #${SCRIPT_ID}-toggle::before {
                content: "";
                position: absolute;
                left: 7px;
                top: 7px;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                background: rgb(119, 128, 144);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42), 0 2px 5px rgba(8, 13, 23, 0.2);
                transition: transform 160ms ease-out, background-color 160ms ease-out;
            }

            #${SCRIPT_ID}-toggle[aria-pressed="true"] {
                background: rgb(16, 99, 88);
                border-color: rgba(16, 99, 88, 0.86);
                color: rgb(248, 252, 250);
                box-shadow: 0 12px 28px rgba(9, 78, 68, 0.26);
                padding: 0 40px 0 14px;
            }

            #${SCRIPT_ID}-toggle[aria-pressed="true"]::before {
                transform: translateX(74px);
                background: rgb(248, 252, 250);
            }

            #${SCRIPT_ID}-toggle:focus-visible {
                outline: 3px solid rgba(18, 95, 86, 0.35);
                outline-offset: 2px;
            }
        `;

        toggleButton = document.createElement('button');
        toggleButton.id = `${SCRIPT_ID}-toggle`;
        toggleButton.type = 'button';
        toggleButton.addEventListener('click', () => setEnabled(!enabled));

        document.documentElement.appendChild(style);
        document.documentElement.appendChild(toggleButton);
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

                    if (node.__tldCnyOriginalText !== undefined && (!enabled || node.textContent !== convertText(node.__tldCnyOriginalText))) {
                        node.__tldCnyOriginalText = node.textContent;
                    }

                    if (!enabled) {
                        continue;
                    }

                    processTextNode(node);
                    continue;
                }

                if (!enabled) {
                    continue;
                }

                for (const node of mutation.addedNodes) {
                    if (node.id === `${SCRIPT_ID}-toggle` || node.id === `${SCRIPT_ID}-style`) {
                        continue;
                    }

                    processRoot(node);
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
        installToggle();
        installObserver();
        processRoot();
        processAccessibleFrames();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.addEventListener('load', () => queueProcess(), { once: true });
    window.addEventListener('pageshow', () => queueProcess());
})();
