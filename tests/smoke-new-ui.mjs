import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const chromeEndpoint = process.env.CHROME_CDP_ENDPOINT || 'http://127.0.0.1:9222';
const scriptPath = resolve(root, 'LinkAPI USD And English.user.js');
const debug = process.env.SMOKE_DEBUG === '1';

function logDebug(...args) {
    if (debug) {
        console.error('[smoke]', ...args);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function contentType(pathname) {
    switch (extname(pathname)) {
        case '.html':
            return 'text/html; charset=utf-8';
        case '.js':
            return 'text/javascript; charset=utf-8';
        default:
            return 'text/plain; charset=utf-8';
    }
}

async function startServer() {
    logDebug('starting fixture server');
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url || '/', 'http://127.0.0.1');
            if (url.pathname === '/api/data' || url.pathname === '/api/data/self') {
                const noTokenFixture = url.searchParams.get('fixture') === 'no-token';
                const data = noTokenFixture
                    ? [
                        { created_at: 1778284800, model_name: 'gpt-5.5', count: 10000, quota: 123 },
                        { created_at: 1778371200, model_name: 'claude', count: 14866, quota: 456 }
                    ]
                    : [
                        { created_at: 1778284800, model_name: 'gpt-5.5', count: 10000, quota: 123, token_used: 1200000 },
                        { created_at: 1778371200, model_name: 'claude', count: 14866, quota: 456, token_used: 345678 }
                    ];
                response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify({ success: true, data }));
                return;
            }

            const pathname = url.pathname === '/' ? '/tests/fixtures/new-ui-parity.html' : url.pathname;
            const filePath = resolve(root, `.${decodeURIComponent(pathname)}`);
            assert(filePath.startsWith(root), 'Blocked path traversal');
            const body = await readFile(filePath);
            response.writeHead(200, { 'content-type': contentType(filePath) });
            response.end(body);
        } catch (error) {
            response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            response.end(String(error.message || error));
        }
    });

    await new Promise((resolveListen, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out starting fixture server')), 10000);
        server.listen(0, '127.0.0.1', () => {
            clearTimeout(timeout);
            resolveListen();
        });
    });
    logDebug('fixture server listening', server.address().port);
    return {
        server,
        origin: `http://127.0.0.1:${server.address().port}`
    };
}

async function chromeFetch(path, options) {
    const response = await fetch(`${chromeEndpoint}${path}`, options);
    if (!response.ok) {
        throw new Error(`Chrome CDP request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

class CdpClient {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.events = new EventTarget();
        socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.method) {
                this.events.dispatchEvent(new MessageEvent(message.method, { data: message.params || {} }));
            }

            if (!message.id) {
                return;
            }

            const pending = this.pending.get(message.id);
            if (!pending) {
                return;
            }

            this.pending.delete(message.id);
            if (message.error) {
                pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
            } else {
                pending.resolve(message.result);
            }
        });
    }

    send(method, params = {}) {
        const id = this.nextId;
        this.nextId += 1;
        const payload = JSON.stringify({ id, method, params });
        return new Promise((resolveSend, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP command timed out: ${method}`));
            }, 10000);
            this.pending.set(id, {
                resolve: (value) => {
                    clearTimeout(timeout);
                    resolveSend(value);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            this.socket.send(payload);
        });
    }

    waitForEvent(name, timeoutMs = 10000) {
        return new Promise((resolveEvent, reject) => {
            const timeout = setTimeout(() => {
                this.events.removeEventListener(name, onEvent);
                reject(new Error(`Timed out waiting for CDP event: ${name}`));
            }, timeoutMs);
            const onEvent = (event) => {
                clearTimeout(timeout);
                resolveEvent(event.data);
            };
            this.events.addEventListener(name, onEvent, { once: true });
        });
    }

    close() {
        return new Promise((resolveClose) => {
            if (this.socket.readyState === WebSocket.CLOSED) {
                resolveClose();
                return;
            }

            this.socket.addEventListener('close', resolveClose, { once: true });
            this.socket.close();
            setTimeout(resolveClose, 1000);
        });
    }
}

async function connectToPage() {
    logDebug('creating target');
    const target = await chromeFetch('/json/new?about:blank', { method: 'PUT' });
    logDebug('opening websocket', target.webSocketDebuggerUrl);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out opening Chrome page WebSocket')), 10000);
        socket.addEventListener('open', () => {
            clearTimeout(timeout);
            resolveOpen();
        }, { once: true });
        socket.addEventListener('error', (event) => {
            clearTimeout(timeout);
            reject(new Error(`Chrome page WebSocket error: ${event.message || 'unknown error'}`));
        }, { once: true });
    });

    const client = new CdpClient(socket);
    logDebug('Runtime.enable');
    await client.send('Runtime.enable');
    logDebug('Page.enable');
    await client.send('Page.enable');
    return { client, target };
}

async function evaluate(client, expression, { awaitPromise = false } = {}) {
    const result = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise,
        returnByValue: true
    });
    if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
    }

    return result.result.value;
}

async function loadFixture(client, url) {
    logDebug('loading', url);
    const loaded = client.waitForEvent('Page.loadEventFired');
    await client.send('Page.navigate', { url });
    await loaded;
    logDebug('injecting userscript');
    const scriptSource = await readFile(scriptPath, 'utf8');
    await evaluate(client, scriptSource);
    await delay(100);
}

async function runNewUiAssertions(client) {
    logDebug('new ui assertions');
    await loadFixture(client, `${globalThis.__smokeOrigin}/tests/fixtures/new-ui-parity.html`);

    await evaluate(client, 'localStorage.setItem("chats", JSON.stringify([{ "Other": "other" }]))');
    await evaluate(client, 'Storage.prototype.setItem.call(localStorage, "chats", localStorage.getItem("chats"))');
    await delay(50);

    const initial = await evaluate(client, `(() => ({
        inlineInLogGrid: document.querySelectorAll('#usage-filter-grid .tld-linkapi-cny-usd-midnight-button').length,
        hasLogShortcut: Boolean(document.querySelector('#tld-linkapi-cny-usd-log-helper #tld-linkapi-cny-usd-time-shortcut')),
        hasAutoRefresh: Boolean(document.querySelector('#tld-linkapi-cny-usd-log-helper #tld-linkapi-cny-usd-log-refresh')),
        redeemWrap: Boolean(document.querySelector('[data-tld-linkapi-cny-usd-redeem-wrap="true"]')),
        importNames: JSON.parse(localStorage.getItem('chats')).flatMap((entry) => Object.keys(entry))
    }))()`);

    assert(initial.inlineInLogGrid === 0, 'Usage Logs compact grid received inline 00:00 buttons');
    assert(initial.hasLogShortcut, 'Usage Logs safe 00:00 start shortcut was not rendered');
    assert(initial.hasAutoRefresh, 'Usage Logs auto-refresh control was not rendered');
    assert(initial.redeemWrap, 'Redemption compact wrapper was not marked');
    assert(initial.importNames.includes('CC Switch'), 'CC Switch import template missing');
    assert(initial.importNames.includes('Cherry Studio'), 'Cherry Studio import template missing');
    assert(initial.importNames.includes('流畅阅读'), 'FluentRead import template missing');

    await evaluate(client, `document.querySelector('#tld-linkapi-cny-usd-time-shortcut button').click()`);
    await delay(50);
    const logStart = await evaluate(client, 'document.getElementById("log-start").value');
    assert(logStart === '2026-05-09 00:00:00', 'Usage Logs 00:00 start shortcut did not set start input');

    await evaluate(client, `document.querySelector('#tld-linkapi-cny-usd-log-refresh button').click()`);
    await delay(50);
    const refreshState = await evaluate(client, `(() => ({
        clicks: window.__fixture.searchClicks,
        reloads: window.__fixture.reloads,
        pressed: document.querySelector('#tld-linkapi-cny-usd-log-refresh button').getAttribute('aria-pressed')
    }))()`);
    assert(refreshState.clicks === 1, 'Auto-refresh did not click Search immediately when enabled');
    assert(refreshState.reloads === 0, 'Auto-refresh reloaded despite a Search button being available');
    assert(refreshState.pressed === 'true', 'Auto-refresh button did not enter pressed state');

    await evaluate(client, `document.querySelector('#api-table th:nth-child(2)').click()`);
    await delay(50);
    const sortedAsc = await evaluate(client, `Array.from(document.querySelectorAll('#api-table tbody tr')).map((row) => row.children[1].textContent).join(',')`);
    assert(sortedAsc === 'A,B', 'Generic table sort did not sort ascending on first click');

    await evaluate(client, `document.querySelector('#api-table th:nth-child(2)').click()`);
    await delay(50);
    const sortedDesc = await evaluate(client, `Array.from(document.querySelectorAll('#api-table tbody tr')).map((row) => row.children[1].textContent).join(',')`);
    assert(sortedDesc === 'B,A', 'Generic table sort did not sort descending on second click');

    await evaluate(client, `(() => {
        const popup = document.createElement('div');
        popup.setAttribute('role', 'menu');
        popup.innerHTML = '<button>Asc</button><button>Desc</button><button>Hide</button>';
        document.body.appendChild(popup);
        document.body.appendChild(document.createElement('div')).textContent = 'trigger mutations';
    })()`);
    await delay(100);
    const popupCount = await evaluate(client, `Array.from(document.querySelectorAll('[role="menu"]')).filter((node) => /Asc.*Desc.*Hide/s.test(node.textContent)).length`);
    assert(popupCount === 0, 'Asc/Desc/Hide popup was not removed');

    await evaluate(client, `(() => {
        const toggle = document.getElementById('tld-linkapi-cny-usd-toggle');
        toggle.click();
        const added = document.createElement('input');
        added.setAttribute('aria-label', 'Dynamic Start Time');
        added.value = '2026-05-09 10:30:00';
        document.querySelector('main').appendChild(added);
    })()`);
    await delay(100);
    const dynamicHelpers = await evaluate(client, `document.querySelectorAll('main > input[aria-label="Dynamic Start Time"] + .tld-linkapi-cny-usd-midnight-button').length`);
    assert(dynamicHelpers === 0, 'Usage Logs dynamic input received inline midnight button');
    const helperStillVisible = await evaluate(client, `Boolean(document.querySelector('#tld-linkapi-cny-usd-log-helper #tld-linkapi-cny-usd-time-shortcut'))`);
    assert(helperStillVisible, 'Log helper disappeared after toggling conversion off and adding nodes');

    await evaluate(client, `history.pushState({}, '', '/pricing'); document.body.innerHTML = '<main><h1>Model Square</h1></main>'; document.body.appendChild(document.getElementById('tld-linkapi-cny-usd-toggle'));`);
    await delay(100);
    const toggleHidden = await evaluate(client, `document.getElementById('tld-linkapi-cny-usd-toggle').hidden`);
    assert(toggleHidden, 'Toggle did not hide on marketplace/pricing surface');
}

async function runDashboardAssertions(client) {
    logDebug('dashboard assertions');
    await loadFixture(client, `${globalThis.__smokeOrigin}/tests/fixtures/dashboard-filter.html`);
    logDebug('dashboard initial read');
    const initial = await evaluate(client, `(() => ({
        pathname: window.location.pathname,
        buttons: document.querySelectorAll('[role="dialog"] .tld-linkapi-cny-usd-midnight-button').length,
        fallback: Boolean(document.getElementById('tld-linkapi-cny-usd-time-shortcut')),
        logHelper: Boolean(document.getElementById('tld-linkapi-cny-usd-log-helper'))
    }))()`);
    logDebug('dashboard initial', JSON.stringify(initial));
    assert(initial.pathname === '/dashboard/models', 'Dashboard fixture did not run on the live dashboard route shape');
    assert(initial.buttons >= 2, 'Dashboard custom time triggers did not receive 00:00 buttons');
    assert(!initial.fallback, 'Dashboard rendered fallback despite visible inline shortcuts');
    assert(!initial.logHelper, 'Dashboard was misdetected as Usage Logs because of sidebar text');

    logDebug('dashboard click midnight');
    await evaluate(client, `document.getElementById('dashboard-start-trigger').parentElement.querySelector('.tld-linkapi-cny-usd-midnight-button').click()`);
    await delay(100);
    logDebug('dashboard result read');
    const dashboard = await evaluate(client, `(() => ({
        triggerText: document.getElementById('dashboard-start-trigger').textContent.trim(),
        hiddenValue: document.getElementById('dashboard-start-hidden').value
    }))()`);
    assert(dashboard.triggerText === '00:00', 'Dashboard custom trigger did not select visible midnight option');
    assert(dashboard.hiddenValue.endsWith('00:00:00'), 'Dashboard hidden start value was not set to midnight');

    await evaluate(client, `fetch('/api/data/self?start_timestamp=1778284800&end_timestamp=1778371200').then((response) => response.json())`, { awaitPromise: true });
    await delay(150);
    const tokenBadge = await evaluate(client, `(() => {
        const badge = document.getElementById('tld-linkapi-cny-usd-dashboard-token-total');
        return {
            text: badge?.textContent.trim() || '',
            previous: badge?.previousElementSibling?.textContent.trim() || '',
            inHeader: Boolean(badge?.closest('header'))
        };
    })()`);
    assert(tokenBadge.text === 'Tokens: 1,545,678', 'Dashboard token total was not rendered from token_used');
    assert(tokenBadge.previous === 'Total: 24,866', 'Dashboard token total was not placed beside the chart total');
    assert(tokenBadge.inHeader, 'Dashboard token total was not placed in the analytics header');

    await evaluate(client, `fetch('/api/data/self?fixture=no-token').then((response) => response.json())`, { awaitPromise: true });
    await delay(150);
    const tokenBadgeRemoved = await evaluate(client, `Boolean(document.getElementById('tld-linkapi-cny-usd-dashboard-token-total'))`);
    assert(!tokenBadgeRemoved, 'Dashboard token total stayed visible after token fields were absent');

    await evaluate(client, `(() => {
        const header = document.querySelector('[aria-label="Model analytics"] header');
        header.children[0].textContent = '模型调用分析';
        header.children[1].textContent = '总计：24,866';
        header.parentElement.querySelectorAll('.row')[1].textContent = '调用次数分布';
        header.parentElement.querySelectorAll('.row')[2].textContent = '调用趋势';
        header.parentElement.querySelectorAll('.row')[3].textContent = '调用次数排行';
    })()`);
    await delay(100);
    await evaluate(client, `fetch('/api/data/self?start_timestamp=1778284800&end_timestamp=1778371200').then((response) => response.json())`, { awaitPromise: true });
    await delay(150);
    const chineseTokenBadge = await evaluate(client, `(() => {
        const badge = document.getElementById('tld-linkapi-cny-usd-dashboard-token-total');
        return {
            text: badge?.textContent.trim() || '',
            previous: badge?.previousElementSibling?.textContent.trim() || ''
        };
    })()`);
    assert(chineseTokenBadge.text === 'Tokens: 1,545,678', 'Dashboard token total did not attach to Chinese analytics header');
    assert(chineseTokenBadge.previous === '总计：24,866', 'Dashboard token total was not placed beside the Chinese total');

    await evaluate(client, `(() => {
        document.querySelector('[aria-label="Model analytics"] header span').textContent = 'Total: 1';
        document.body.appendChild(document.createElement('div')).textContent = 'retarget dashboard header';
    })()`);
    await delay(100);
    const mismatchedBadge = await evaluate(client, `Boolean(document.getElementById('tld-linkapi-cny-usd-dashboard-token-total'))`);
    assert(!mismatchedBadge, 'Dashboard token total stayed visible when request total no longer matched the payload');
}

async function runOldLayoutAssertions(client) {
    logDebug('old layout assertions');
    await loadFixture(client, `${globalThis.__smokeOrigin}/tests/fixtures/old-layout-log.html`);
    const initial = await evaluate(client, `(() => ({
        isLogHelper: Boolean(document.getElementById('tld-linkapi-cny-usd-log-helper')),
        hasShortcut: Boolean(document.querySelector('#tld-linkapi-cny-usd-time-shortcut')),
        inlineButtons: document.querySelectorAll('.tld-linkapi-cny-usd-midnight-button').length
    }))()`);
    assert(initial.isLogHelper, 'Old layout was not detected as a log page');
    assert(initial.hasShortcut, 'Old layout start-time fallback was not rendered');
    assert(initial.inlineButtons === 0, 'Old layout received inline midnight buttons');

    await evaluate(client, `document.querySelector('#tld-linkapi-cny-usd-time-shortcut button').click()`);
    await delay(50);
    const oldStart = await evaluate(client, 'document.getElementById("old-start").value');
    assert(oldStart === '2026-05-09 00:00:00', 'Old layout fallback did not set unlabeled start input');
}

async function main() {
    const { server, origin } = await startServer();
    globalThis.__smokeOrigin = origin;
    let client;
    let target;

    try {
        ({ client, target } = await connectToPage());
        await runNewUiAssertions(client);
        await runDashboardAssertions(client);
        await runOldLayoutAssertions(client);
        console.log('Smoke tests passed');
    } finally {
        if (client) {
            client.close();
        }

        if (target?.id) {
            chromeFetch(`/json/close/${target.id}`).catch(() => {});
        }

        server.close();
    }

    process.exit(0);
}

main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
});
