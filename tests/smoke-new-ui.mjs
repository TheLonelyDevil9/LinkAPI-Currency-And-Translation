import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
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
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url || '/', 'http://127.0.0.1');
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

    return {
        server,
        origin: `http://127.0.0.1:${server.address().port}`
    };
}

async function chromeFetch(path, options) {
    logDebug('chrome fetch', path);
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
        try {
            this.socket.close();
        } catch (_) {
            // Best-effort cleanup only; the Chrome target is closed separately.
        }
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

function closeChromeTargetAfterExit(targetId) {
    if (!targetId) {
        return;
    }

    const cleanupScript = `
        fetch(${JSON.stringify(`${chromeEndpoint}/json/close/${targetId}`)})
            .finally(() => process.exit(0));
        setTimeout(() => process.exit(0), 5000);
    `;
    const child = spawn(process.execPath, ['-e', cleanupScript], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    });
    child.unref();
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

async function loadFixture(client, url, { seedStaleArtifacts = false } = {}) {
    logDebug('loading fixture', url);
    const loaded = client.waitForEvent('Page.loadEventFired');
    await client.send('Page.navigate', { url });
    await loaded;
    logDebug('fixture loaded');

    if (seedStaleArtifacts) {
        logDebug('seeding stale artifacts');
        await evaluate(client, `(() => {
            localStorage.setItem('tld-linkapi-cny-usd:log-auto-refresh', 'true');
            localStorage.setItem('tld-linkapi-cny-usd:model-filter', JSON.stringify({ hidden: ['gpt-5.5'] }));
            localStorage.setItem('chats', JSON.stringify([{ Other: 'other' }]));
            localStorage.setItem('tld-linkapi-cny-usd:page-settings:v1', JSON.stringify({
                [window.location.origin + window.location.pathname]: {
                    tableSorts: { old: { headerKey: '1:model', direction: 'desc' } },
                    controls: {}
                }
            }));

            document.body.insertAdjacentHTML('beforeend', [
                '<span id="tld-linkapi-cny-usd-time-shortcut"></span>',
                '<span id="tld-linkapi-cny-usd-log-helper"></span>',
                '<span id="tld-linkapi-cny-usd-log-refresh"></span>',
                '<span id="tld-linkapi-cny-usd-dashboard-token-total"></span>',
                '<button id="tld-linkapi-cny-usd-toggle" class="tld-linkapi-cny-usd-control">USD</button>',
                '<style id="tld-linkapi-cny-usd-style">#tld-linkapi-cny-usd-toggle{position:fixed}</style>',
                '<button class="tld-linkapi-cny-usd-midnight-button">00:00</button>',
                '<div class="tld-linkapi-cny-usd-model-filter"></div>',
                '<div class="tld-linkapi-cny-usd-dialog-model-filter-wrap"></div>',
                '<span class="tld-linkapi-cny-usd-api-info-label"></span>'
            ].join(''));

            const hidden = document.createElement('div');
            hidden.className = 'tld-linkapi-cny-usd-hidden-by-model-filter';
            document.body.appendChild(hidden);

            const header = document.querySelector('#api-table th:nth-child(2)');
            header.setAttribute('data-tld-linkapi-cny-usd-sort-bound', 'true');
            header.setAttribute('aria-sort', 'descending');
            header.title = 'Click to sort ascending, click again for descending';
        })()`);
    }

    const scriptSource = await readFile(scriptPath, 'utf8');
    logDebug('injecting script');
    await evaluate(client, scriptSource);
    logDebug('script injected');
    await delay(100);
}

async function runReducedScopeAssertions(client) {
    logDebug('run reduced scope assertions');
    await loadFixture(client, `${globalThis.__smokeOrigin}/tests/fixtures/new-ui-parity.html`, { seedStaleArtifacts: true });

    const initial = await evaluate(client, `(() => ({
        balance: document.getElementById('balance').textContent,
        cost: document.getElementById('cost').textContent,
        yuan: document.getElementById('yuan').textContent,
        unit: document.getElementById('unit').textContent,
        copyright: document.getElementById('copyright').textContent,
        announcement: document.getElementById('announcement').textContent,
        oldToggle: Boolean(document.getElementById('tld-linkapi-cny-usd-toggle')),
        oldToggleStyle: Boolean(document.getElementById('tld-linkapi-cny-usd-style')),
        menuToggleText: document.getElementById('tld-linkapi-cny-usd-menu-toggle')?.textContent,
        menuToggleChecked: document.getElementById('tld-linkapi-cny-usd-menu-toggle')?.getAttribute('aria-checked'),
        menuToggleRole: document.getElementById('tld-linkapi-cny-usd-menu-toggle')?.getAttribute('role'),
        menuToggleAfterWallet: document.getElementById('wallet-item')?.nextElementSibling?.id === 'tld-linkapi-cny-usd-menu-toggle',
        menuToggleBeforeDivider: document.getElementById('tld-linkapi-cny-usd-menu-toggle')?.nextElementSibling?.id === 'account-divider',
        menuToggleCount: document.querySelectorAll('#tld-linkapi-cny-usd-menu-toggle').length,
        hasInlineTime: Boolean(document.querySelector('.tld-linkapi-cny-usd-midnight-button')),
        hasLogHelper: Boolean(document.getElementById('tld-linkapi-cny-usd-log-helper')),
        hasLogRefresh: Boolean(document.getElementById('tld-linkapi-cny-usd-log-refresh')),
        hasDashboardBadge: Boolean(document.getElementById('tld-linkapi-cny-usd-dashboard-token-total')),
        hasModelFilter: Boolean(document.querySelector('.tld-linkapi-cny-usd-model-filter, .tld-linkapi-cny-usd-dialog-model-filter-wrap')),
        hiddenClassCount: document.querySelectorAll('.tld-linkapi-cny-usd-hidden-by-model-filter').length,
        logStorage: localStorage.getItem('tld-linkapi-cny-usd:log-auto-refresh'),
        modelStorage: localStorage.getItem('tld-linkapi-cny-usd:model-filter'),
        chats: localStorage.getItem('chats'),
        tableOrder: Array.from(document.querySelectorAll('#api-table tbody tr')).map((row) => row.children[1].textContent).join(','),
        headerSortBound: document.querySelector('#api-table th:nth-child(2)').hasAttribute('data-tld-linkapi-cny-usd-sort-bound'),
        headerAriaSort: document.querySelector('#api-table th:nth-child(2)').getAttribute('aria-sort'),
        headerTitle: document.querySelector('#api-table th:nth-child(2)').getAttribute('title'),
        helperStyle: document.getElementById('tld-linkapi-cny-usd-helper-style')?.textContent || '',
        redeemWrap: Boolean(document.querySelector('[data-tld-linkapi-cny-usd-redeem-wrap="true"]')),
        redeemPlaceholder: document.getElementById('redeem-code').placeholder
    }))()`);

    assert(initial.balance === '当前余额: $14.62', 'CNY prefix amount was not converted to USD');
    assert(initial.cost === 'Cost: $0.001798', 'Tiny suffix CNY amount was not converted with extra precision');
    assert(initial.yuan === '充值金额 $1.75', 'Yuan suffix amount was not converted');
    assert(initial.unit === 'Price (USD)', 'CNY unit label was not converted');
    assert(initial.copyright === '© 2026 LinkAPI', 'Copyright year was not updated');
    assert(initial.announcement === '亲爱的用户，请先Refresh后再查询。', 'Chinese UI text was translated despite reduced scope');
    assert(!initial.oldToggle, 'Old top-bar toggle was not removed');
    assert(!initial.oldToggleStyle, 'Old top-bar toggle stylesheet was not removed');
    assert(initial.menuToggleText === 'Show USD values', 'Menu toggle did not use the stable preference label');
    assert(initial.menuToggleChecked === 'true', 'Menu toggle did not start checked in USD mode');
    assert(initial.menuToggleRole === 'menuitemcheckbox', 'Menu toggle did not use checkable menu semantics');
    assert(initial.menuToggleAfterWallet, 'Menu toggle was not inserted after Wallet');
    assert(initial.menuToggleBeforeDivider, 'Menu toggle was not inserted before the sign-out divider');
    assert(initial.menuToggleCount === 1, 'Menu toggle was inserted more than once');
    assert(!initial.hasInlineTime, 'Removed inline time helper still exists');
    assert(!initial.hasLogHelper, 'Removed log helper still exists');
    assert(!initial.hasLogRefresh, 'Removed log refresh helper still exists');
    assert(!initial.hasDashboardBadge, 'Removed dashboard token badge still exists');
    assert(!initial.hasModelFilter, 'Removed model filter artifacts still exist');
    assert(initial.hiddenClassCount === 0, 'Hidden-by-model-filter class was not cleaned');
    assert(initial.logStorage === null, 'Log auto-refresh storage key was not removed');
    assert(initial.modelStorage === null, 'Model filter storage key was not removed');
    assert(initial.chats === JSON.stringify([{ Other: 'other' }]), 'Chat storage was unexpectedly normalized');
    assert(initial.tableOrder === 'B,A', 'Table rows were sorted even though table sorting was removed');
    assert(!initial.headerSortBound, 'Table sort binding attribute was not cleaned');
    assert(initial.headerAriaSort === null, 'Table aria-sort was not cleaned');
    assert(initial.headerTitle === null, 'Old table-sort title was not cleaned');
    assert(!/midnight|log-refresh|dashboard-token|sort-bound/i.test(initial.helperStyle), 'Helper stylesheet still includes removed feature CSS');
    assert(initial.redeemWrap, 'Redemption compact wrapper was not marked');
    assert(initial.redeemPlaceholder === 'Enter your redemption code here', 'Redemption placeholder was not normalized');

    await evaluate(client, `document.getElementById('tld-linkapi-cny-usd-menu-toggle').click()`);
    await delay(100);
    const cnyMode = await evaluate(client, `(() => ({
        balance: document.getElementById('balance').textContent,
        cost: document.getElementById('cost').textContent,
        unit: document.getElementById('unit').textContent,
        copyright: document.getElementById('copyright').textContent,
        menuToggleText: document.getElementById('tld-linkapi-cny-usd-menu-toggle').textContent,
        menuToggleChecked: document.getElementById('tld-linkapi-cny-usd-menu-toggle').getAttribute('aria-checked'),
        menuToggleCount: document.querySelectorAll('#tld-linkapi-cny-usd-menu-toggle').length,
        stored: localStorage.getItem('tld-linkapi-cny-usd:enabled')
    }))()`);

    assert(cnyMode.balance === '当前余额: CNY 100.00', 'Toggle did not restore original CNY prefix amount');
    assert(cnyMode.cost === 'Cost: 0.0123 CNY', 'Toggle did not restore original CNY suffix amount');
    assert(cnyMode.unit === 'Price (CNY)', 'Toggle did not restore original CNY unit label');
    assert(cnyMode.copyright === '© 2025 LinkAPI', 'Toggle did not restore original copyright text');
    assert(cnyMode.menuToggleText === 'Show USD values', 'Menu toggle label changed outside stable preference text');
    assert(cnyMode.menuToggleChecked === 'false', 'Menu toggle did not uncheck in CNY mode');
    assert(cnyMode.menuToggleCount === 1, 'Menu toggle duplicated after switching to CNY mode');
    assert(cnyMode.stored === 'false', 'Toggle state was not persisted');

    await evaluate(client, `document.getElementById('tld-linkapi-cny-usd-menu-toggle').click()`);
    await delay(100);
    const usdMode = await evaluate(client, `(() => ({
        balance: document.getElementById('balance').textContent,
        menuToggleText: document.getElementById('tld-linkapi-cny-usd-menu-toggle').textContent,
        menuToggleChecked: document.getElementById('tld-linkapi-cny-usd-menu-toggle').getAttribute('aria-checked'),
        stored: localStorage.getItem('tld-linkapi-cny-usd:enabled')
    }))()`);

    assert(usdMode.balance === '当前余额: $14.62', 'Toggle did not reconvert to USD');
    assert(usdMode.menuToggleText === 'Show USD values', 'Menu toggle label changed after switching back to USD mode');
    assert(usdMode.menuToggleChecked === 'true', 'Menu toggle did not recheck in USD mode');
    assert(usdMode.stored === 'true', 'USD toggle state was not persisted');

    await evaluate(client, `(() => {
        const dynamic = document.createElement('p');
        dynamic.id = 'dynamic-price';
        dynamic.textContent = 'Dynamic CNY 25.00';
        document.getElementById('dynamic-root').appendChild(dynamic);
    })()`);
    await delay(100);
    const dynamicText = await evaluate(client, `document.getElementById('dynamic-price').textContent`);
    assert(dynamicText === 'Dynamic $3.66', 'Dynamic DOM currency value was not converted');

    await evaluate(client, `(() => {
        document.getElementById('model-filter').value = 'claude';
        document.getElementById('model-filter').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('api-key').value = 'sk-new-secret-abcdefghijklmnopqrstuvwxyz';
        document.getElementById('api-key').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('prompt-field').value = 'new private prompt';
        document.getElementById('prompt-field').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('status-filter').value = 'Active';
        document.getElementById('status-filter').dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await delay(100);

    const persisted = await evaluate(client, `JSON.parse(localStorage.getItem('tld-linkapi-cny-usd:page-settings:v1'))[window.location.origin + window.location.pathname]`);
    const persistedJson = JSON.stringify(persisted);
    assert(!Object.prototype.hasOwnProperty.call(persisted, 'tableSorts'), 'tableSorts stayed in page settings');
    assert(persistedJson.includes('claude'), 'Safe model filter setting was not persisted');
    assert(persistedJson.includes('Active'), 'Safe select setting was not persisted');
    assert(!persistedJson.includes('sk-new-secret'), 'Sensitive API key was persisted');
    assert(!persistedJson.includes('new private prompt'), 'Textarea/prompt content was persisted');

    await loadFixture(client, `${globalThis.__smokeOrigin}/tests/fixtures/new-ui-parity.html`);
    const restored = await evaluate(client, `(() => ({
        modelFilter: document.getElementById('model-filter').value,
        statusFilter: document.getElementById('status-filter').value,
        apiKey: document.getElementById('api-key').value,
        prompt: document.getElementById('prompt-field').value
    }))()`);

    assert(restored.modelFilter === 'claude', 'Safe model filter setting was not restored');
    assert(restored.statusFilter === 'Active', 'Safe select setting was not restored');
    assert(restored.apiKey === 'sk-sensitive-1234567890abcdef', 'Sensitive API key was restored unexpectedly');
    assert(restored.prompt === 'private prompt content', 'Textarea/prompt content was restored unexpectedly');
}

async function runRemovedDashboardAssertions(client) {
    logDebug('run removed dashboard assertions');
    await loadFixture(client, `${globalThis.__smokeOrigin}/tests/fixtures/dashboard-filter.html`);

    const result = await evaluate(client, `(() => {
        const nativeFetch = window.fetch;
        const nativeOpen = XMLHttpRequest.prototype.open;
        const nativeSend = XMLHttpRequest.prototype.send;
        document.body.appendChild(document.createElement('div')).textContent = 'rerender';
        return new Promise((resolve) => {
            requestAnimationFrame(() => resolve({
                fetchPatched: window.fetch !== nativeFetch,
                xhrOpenPatched: XMLHttpRequest.prototype.open !== nativeOpen,
                xhrSendPatched: XMLHttpRequest.prototype.send !== nativeSend,
                dashboardBadge: Boolean(document.getElementById('tld-linkapi-cny-usd-dashboard-token-total')),
                inlineTimeButtons: document.querySelectorAll('.tld-linkapi-cny-usd-midnight-button').length,
                shortcut: Boolean(document.getElementById('tld-linkapi-cny-usd-time-shortcut')),
                dialogMarked: Boolean(document.querySelector('[data-tld-linkapi-cny-usd-dashboard-filter-dialog]')),
                rangeMarked: Boolean(document.querySelector('[data-tld-linkapi-cny-usd-quick-range-row]'))
            }));
        });
    })()`, { awaitPromise: true });

    assert(!result.fetchPatched, 'window.fetch was patched despite dashboard hooks being removed');
    assert(!result.xhrOpenPatched, 'XMLHttpRequest.open was patched despite dashboard hooks being removed');
    assert(!result.xhrSendPatched, 'XMLHttpRequest.send was patched despite dashboard hooks being removed');
    assert(!result.dashboardBadge, 'Dashboard token badge was rendered despite removal');
    assert(result.inlineTimeButtons === 0, 'Dashboard inline time buttons were rendered despite removal');
    assert(!result.shortcut, 'Dashboard fallback time shortcut was rendered despite removal');
    assert(!result.dialogMarked, 'Dashboard dialog was styled despite helper removal');
    assert(!result.rangeMarked, 'Dashboard quick range row was styled despite helper removal');
}

async function runRemovedLogAssertions(client) {
    logDebug('run removed log assertions');
    await loadFixture(client, `${globalThis.__smokeOrigin}/tests/fixtures/old-layout-log.html`);

    const result = await evaluate(client, `(() => ({
        helper: Boolean(document.getElementById('tld-linkapi-cny-usd-log-helper')),
        refresh: Boolean(document.getElementById('tld-linkapi-cny-usd-log-refresh')),
        shortcut: Boolean(document.getElementById('tld-linkapi-cny-usd-time-shortcut')),
        inlineButtons: document.querySelectorAll('.tld-linkapi-cny-usd-midnight-button').length,
        oldStart: document.getElementById('old-start').value
    }))()`);

    assert(!result.helper, 'Usage Logs helper cluster was rendered despite removal');
    assert(!result.refresh, 'Usage Logs auto-refresh was rendered despite removal');
    assert(!result.shortcut, 'Usage Logs time shortcut was rendered despite removal');
    assert(result.inlineButtons === 0, 'Usage Logs inline time buttons were rendered despite removal');
    assert(result.oldStart === '2026-05-09 11:47:32', 'Usage Logs time input was unexpectedly modified');
}

async function main() {
    const { server, origin } = await startServer();
    globalThis.__smokeOrigin = origin;
    let client;
    let target;

    try {
        ({ client, target } = await connectToPage());
        await runReducedScopeAssertions(client);
        await runRemovedDashboardAssertions(client);
        await runRemovedLogAssertions(client);
        console.log('Smoke tests passed');
        if (target?.id) {
            closeChromeTargetAfterExit(target.id);
            target = null;
        }
        await delay(250);
        process.exit(0);
    } finally {
        if (target?.id) {
            await chromeFetch(`/json/close/${target.id}`).catch(() => {});
        }

        server.close();
    }

    process.exit(0);
}

main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exit(1);
});
