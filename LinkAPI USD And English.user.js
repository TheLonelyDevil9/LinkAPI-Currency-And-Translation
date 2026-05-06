// ==UserScript==
// @name         LinkAPI USD And English
// @namespace    https://violentmonkey.github.io/
// @version      2.3
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
    const HELPER_STYLE_ID = `${SCRIPT_ID}-helper-style`;
    const CNY_TO_USD_RATE = 0.146201;

    const PREFIX_CNY_PATTERN = /(?<![\w$])(?:CNY|RMB|CN¥|CN￥|¥|￥|人民币)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?!\s*(?:CNY|RMB|元)?\s*\))/gi;
    const SUFFIX_CNY_PATTERN = /(?<![\w$])([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:CNY|RMB|人民币|元)(?!\s*\))/gi;
    const CNY_UNIT_LABEL_PATTERN = /\((?:CNY|RMB)\)/gi;
    const COPYRIGHT_YEAR_PATTERN = /©\s*2025(?=\s*LinkAPI)/g;
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
        ['未配置运行时间监控', 'No Uptime Monitoring Configured'],
        ['Gemini已经恢复稳定Status', 'Gemini Has Returned To Stable Status'],
        ['尊敬的客户', 'Dear customers'],
        ['由于数据中心对于开源Model的计算能力费用持续上涨', 'Due to the data center compute costs for open source models continuing to rise'],
        ['我们预计在合同结束后', 'After the contract ends, we expect'],
        ['将从平台上移除一批开源Model', 'to remove a batch of open source models from the platform'],
        ['因为连续两周每周Price上涨10%', 'Because prices have increased 10% each week for two consecutive weeks'],
        ['我们确实无法再继续支持这些Model', 'we can no longer continue supporting these models'],
        ['待批量前通知', 'We will notify you before batch removal'],
        ['感谢您的理解', 'Thank you for your understanding'],
        ['各个Group进行陆续的Price上调', 'Each group will receive gradual price increases'],
        ['Gemini分组升至', 'Gemini group increased to '],
        ['分组升至', 'group increased to '],
        ['预通知', 'Advance Notice'],
        ['市场降价后会第一Time降价', 'Prices will be lowered immediately after the market price drops'],
        ['因为只剩4.6系列了', 'because only the 4.6 series remains'],
        ['我会对claudecheapGroup和claude的-r降价处理', 'I will reduce pricing for the claudecheap group and Claude -r'],
        ['稳定可用性只能尽力维持', 'stability and availability can only be maintained as best as possible'],
        ['Gemini Model报错说明', 'Gemini Model Error Explanation'],
        ['如果您看到报错', 'If you see the error'],
        ['Request被GeminiAPI阻止-禁止内容', 'Request blocked by Gemini API: prohibited content'],
        ['或遇到', 'or encounter'],
        ['这明确表示您的Input内容触发了谷歌官方的严格审核', 'this clearly means your input triggered Google official strict review'],
        ['解决方案', 'Solution'],
        ['请检查并调整您的提示词或对话切入点', 'check and adjust your prompt or conversation entry point'],
        ['即可绕过审核', 'to pass the review'],
        ['关于 Gemini 2.5 Pro Response延迟的说明', 'About Gemini 2.5 Pro Response Latency'],
        ['大家好', 'Hello everyone'],
        ['如果您感觉 Gemini 2.5 Pro 的Response有时较慢', 'If you feel Gemini 2.5 Pro responses are sometimes slow'],
        ['这是由多个因素共同造成的', 'this is caused by multiple factors'],
        ['高质量的生成确实需要一些Time', 'high-quality generation does require some time'],
        ['物理距离', 'Physical Distance'],
        ['我们的服务器位于美西', 'our servers are in the western United States'],
        ['与国内的数据往返本身存在约3秒的物理网络延迟', 'round trips to domestic networks have about 3 seconds of physical network latency'],
        ['Model思考', 'Model Reasoning'],
        ['作为顶级大Model', 'as a top-tier large model'],
        ['处理您的复杂指令需要更充分的计算与思考Time', 'processing complex instructions needs more compute and reasoning time'],
        ['综合负载', 'Overall Load'],
        ['高峰期的账号池调度与谷歌服务器的实时负载', 'account pool scheduling during peak times and real-time Google server load'],
        ['也是影响最终速度的重要因素', 'are also important factors affecting final speed'],
        ['我们理解您对速度的期待', 'We understand your expectations for speed'],
        ['也感谢您的耐心', 'and appreciate your patience'],
        ['高质量的回复值得片刻等待', 'high-quality replies are worth a short wait']
    ]);

    let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';
    let observer = null;
    let queued = false;
    let enhancementQueued = false;
    let toggleButton = null;

    function toNumber(rawAmount) {
        return Number(rawAmount.replace(/,/g, ''));
    }

    function formatUsd(cnyValue) {
        const usdValue = cnyValue * CNY_TO_USD_RATE;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
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

        if (parts.length < 2 || englishParts.length === 0) {
            return text;
        }

        const firstPartHasCjk = HAS_CJK_PATTERN.test(parts[0]);
        const englishWordCount = englishParts.join(' ').split(/\s+/).filter((word) => /[A-Za-z]{2,}/.test(word)).length;

        if (!firstPartHasCjk || englishWordCount < 2) {
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

        const sortedTranslations = Array.from(TRANSLATIONS).sort((left, right) => right[0].length - left[0].length);

        for (const [source, target] of sortedTranslations) {
            nextText = nextText.replaceAll(source, target);
        }

        return nextText.replace(/。/g, '.').replace(/，/g, ', ');
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
            .replace(CNY_UNIT_LABEL_PATTERN, '(USD)')
            .replace(COPYRIGHT_YEAR_PATTERN, '© 2026');

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
            queueEnhancements();
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

    function installHelperStyles() {
        if (document.getElementById(HELPER_STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = HELPER_STYLE_ID;
        style.textContent = `
            .${SCRIPT_ID}-midnight-button,
            .${SCRIPT_ID}-model-filter {
                border: 1px solid rgba(134, 146, 166, 0.36);
                border-radius: 8px;
                background: rgba(34, 38, 48, 0.92);
                color: rgb(236, 241, 247);
                font: 700 12px/1.1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                letter-spacing: 0;
                min-height: 28px;
            }

            .${SCRIPT_ID}-midnight-button {
                cursor: pointer;
                padding: 0 10px;
                margin-left: 6px;
                white-space: nowrap;
            }

            .${SCRIPT_ID}-midnight-button:hover,
            .${SCRIPT_ID}-midnight-button:focus-visible {
                border-color: rgba(56, 189, 248, 0.72);
                color: rgb(240, 249, 255);
            }

            .${SCRIPT_ID}-model-filter {
                width: min(240px, 100%);
                padding: 0 10px;
                margin: 6px 8px 6px 0;
            }

            .${SCRIPT_ID}-hidden-by-model-filter {
                display: none !important;
            }

            [data-${SCRIPT_ID}-redeem="true"] {
                max-width: 560px !important;
            }

            [data-${SCRIPT_ID}-redeem-wrap="true"] {
                align-items: flex-start !important;
            }
        `;

        document.documentElement.appendChild(style);
    }

    function findInputs() {
        return Array.from(document.querySelectorAll('input')).filter((input) => {
            if (input.type === 'hidden' || input.disabled) {
                return false;
            }

            return input.offsetParent !== null || input.getClientRects().length > 0 || document.body.contains(input);
        });
    }

    function normalizeInputValue(value) {
        return String(value || '').toLowerCase().trim();
    }

    function enhanceRedemptionInput() {
        for (const input of findInputs()) {
            const placeholder = normalizeInputValue(input.placeholder);
            if (!placeholder.includes('redemption code')) {
                continue;
            }

            input.placeholder = 'Enter your redemption code here';
            input.setAttribute(`data-${SCRIPT_ID}-redeem`, 'true');
            const wrapper = input.closest('div');
            if (wrapper) {
                wrapper.setAttribute(`data-${SCRIPT_ID}-redeem-wrap`, 'true');
            }
        }
    }

    function setInputValue(input, value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
            nativeSetter.call(input, value);
        } else {
            input.value = value;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function enhanceTimeInputs() {
        for (const input of findInputs()) {
            const value = normalizeInputValue(input.value);
            const placeholder = normalizeInputValue(input.placeholder);
            const isTimeInput = input.type === 'time' || /\d{1,2}\s*:\s*\d{2}(?:\s*[ap]m)?/i.test(value) || placeholder.includes('time');

            if (!isTimeInput || input.getAttribute(`data-${SCRIPT_ID}-midnight-bound`) === 'true') {
                continue;
            }

            input.setAttribute(`data-${SCRIPT_ID}-midnight-bound`, 'true');

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `${SCRIPT_ID}-midnight-button`;
            button.textContent = '00:00';
            button.title = 'Set this time to 00:00:00';
            button.addEventListener('click', () => {
                const midnightValue = input.type === 'time' ? '00:00:00' : '00 : 00 AM';
                setInputValue(input, midnightValue);
            });

            input.insertAdjacentElement('afterend', button);
        }
    }

    function getRowsNear(element) {
        const scope = element.closest('main, [role="dialog"], section, article, body') || document.body;
        return Array.from(scope.querySelectorAll('tbody tr, [role="row"], li, article')).filter((row) => {
            const text = normalizeWhitespace(row.textContent || '');
            return text.length > 0 && /model|token|group|claude|gemini|gpt|deepseek|codex|api|sk-/i.test(text);
        });
    }

    function applyModelFilter(input) {
        const query = normalizeInputValue(input.value);
        const rows = getRowsNear(input);

        rows.forEach((row) => {
            if (!query || normalizeInputValue(row.textContent).includes(query)) {
                row.classList.remove(`${SCRIPT_ID}-hidden-by-model-filter`);
            } else {
                row.classList.add(`${SCRIPT_ID}-hidden-by-model-filter`);
            }
        });
    }

    function enhanceModelFilters() {
        const anchors = Array.from(document.querySelectorAll('main, [role="dialog"], section')).filter((element) => {
            const text = normalizeInputValue(element.textContent);
            return /(usage logs|task logs|model|token|api keys|filter)/.test(text) && getRowsNear(element).length >= 3;
        });

        for (const anchor of anchors.slice(0, 3)) {
            if (anchor.querySelector(`.${SCRIPT_ID}-model-filter`)) {
                continue;
            }

            const input = document.createElement('input');
            input.type = 'search';
            input.className = `${SCRIPT_ID}-model-filter`;
            input.placeholder = 'Filter loaded models, groups, or tokens';
            input.addEventListener('input', () => applyModelFilter(input));

            const insertionPoint = anchor.querySelector('input, button, table, [role="table"]') || anchor.firstElementChild;
            if (insertionPoint) {
                insertionPoint.insertAdjacentElement('beforebegin', input);
            } else {
                anchor.prepend(input);
            }
        }
    }

    function ratioRank(text) {
        if (/auto/i.test(text)) {
            return { isAuto: true, value: 0 };
        }

        const ratios = Array.from(text.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*[x×]/gi)).map((match) => Number(match[1]));
        if (ratios.length === 0) {
            return { isAuto: false, value: Number.POSITIVE_INFINITY };
        }

        return { isAuto: false, value: Math.min(...ratios) };
    }

    function enhanceApiKeySorting() {
        const tables = Array.from(document.querySelectorAll('table')).filter((table) => /api key|quota|group|enabled|auto/i.test(table.textContent || ''));

        for (const table of tables) {
            if (table.getAttribute(`data-${SCRIPT_ID}-api-sort`) === 'true') {
                continue;
            }

            const headers = Array.from(table.querySelectorAll('th'));
            const groupHeader = headers.find((header) => normalizeWhitespace(header.textContent || '').toLowerCase().includes('group'));
            const tbody = table.querySelector('tbody');

            if (!groupHeader || !tbody) {
                continue;
            }

            table.setAttribute(`data-${SCRIPT_ID}-api-sort`, 'true');
            groupHeader.style.cursor = 'pointer';
            groupHeader.title = 'Sort groups by cost ratio, with Auto first in ascending and last in descending';
            groupHeader.addEventListener('click', () => {
                const ascending = table.getAttribute(`data-${SCRIPT_ID}-api-sort-dir`) !== 'asc';
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const groupColumnIndex = Math.max(headers.indexOf(groupHeader), 0);

                rows.sort((left, right) => {
                    const leftRank = ratioRank(left.children[groupColumnIndex]?.textContent || left.textContent || '');
                    const rightRank = ratioRank(right.children[groupColumnIndex]?.textContent || right.textContent || '');

                    if (leftRank.isAuto || rightRank.isAuto) {
                        if (leftRank.isAuto && rightRank.isAuto) {
                            return 0;
                        }

                        return ascending ? (leftRank.isAuto ? -1 : 1) : (leftRank.isAuto ? 1 : -1);
                    }

                    const diff = leftRank.value - rightRank.value;
                    return ascending ? diff : -diff;
                });

                table.setAttribute(`data-${SCRIPT_ID}-api-sort-dir`, ascending ? 'asc' : 'desc');
                rows.forEach((row) => tbody.appendChild(row));
            });
        }
    }

    function enhancePage() {
        installHelperStyles();
        enhanceRedemptionInput();
        enhanceTimeInputs();
        enhanceModelFilters();
        enhanceApiKeySorting();
    }

    function queueEnhancements() {
        if (enhancementQueued) {
            return;
        }

        enhancementQueued = true;
        requestAnimationFrame(() => {
            enhancementQueued = false;
            enhancePage();
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
        installToggle();
        installObserver();
        processRoot();
        processAccessibleFrames();
        enhancePage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.addEventListener('load', () => queueProcess(), { once: true });
    window.addEventListener('pageshow', () => queueProcess());
})();
