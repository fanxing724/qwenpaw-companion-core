// Run actual frontend source with host doubles; verify registration and API resolution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('ui/index.js', 'utf8');
(async () => {
for (const mode of ['plain', 'api-prefix', 'no-helper', 'menu-only', 'route-failure', 'legacy-router', 'base-path']) {
  const calls = [], requests = [], effects = [];
  const React = {
    createElement: (type, props, ...children) => ({type, props, children}),
    useState: value => [value, () => {}], useEffect: fn => effects.push(fn),
    useRef: value => ({current: value}),
  };
  const host = {React, antd: {Input: {TextArea: {}}}};
  if (mode !== 'no-helper') host.getApiUrl = p => mode === 'api-prefix' ? '/api' + p : mode === 'base-path' ? '/paw/api' + p : p;
  const qp = {host, menu: {add: (id, items) => calls.push(['menu', items])},
    route: {add: (id, items) => calls.push(['route', items])}};
  if (mode !== 'menu-only') qp.registerRoutes = (id, items) => {
    if (mode === 'route-failure') throw new Error('simulated unavailable route API');
    calls.push(['apps', items]);
  };
  const context = {window: {QwenPaw: qp}, console: {warn() {}, error() {}},
    fetch: (url, opts) => {requests.push(url); const missing = mode === 'legacy-router' && !url.includes('/plugins/'); return Promise.resolve({ok: !missing, status: missing ? 404 : 200, json: () => Promise.resolve({version: '2.4.0'})});}};
  vm.runInNewContext(source.replace('  var api = {', '  window.testApi = apiFetch;\n  var api = {'), context);
  assert(calls.some(c => c[0] === 'menu'));
  const route = calls.find(c => c[0] === 'route')[1][0];
  assert.equal(route.id, 'companion-core.home');
  const tree = route.component();
  // Default shows every tab; collapsing is an explicit user choice (localStorage).
  const tabsNode = tree.children.find(c => c && c.props && Array.isArray(c.props.items));
  assert.equal(tabsNode.props.items.length, 16);
  assert.equal(tabsNode.props.destroyInactiveTabPane, false, "switching tabs preserves drafts");
  effects[1]();
  await new Promise(resolve => setImmediate(resolve));
  const base = mode === 'base-path' ? '/paw/api' : '/api';
  const mount = mode === 'legacy-router' ? '/plugins' : '';
  assert.equal(requests[0], base + '/companion-core/health', mode);
  assert.equal(requests[1], base + mount + '/companion-core/setup', mode);
  assert.equal(requests[2], base + mount + '/companion-core/health', mode);
  await context.window.testApi('/companion-core/state', {method:'PUT', body:{energy:50}});
  assert.equal(requests.at(-1), base + mount + '/companion-core/state', mode);
  assert.equal(requests.length, 4, 'one discovery probe and no mutation retries');
}
console.log('Frontend: 7 host modes, routes, 16 tabs visible by default; user toggle collapses secondary and health API passed');

// Evaluate date helpers in isolation without adding production globals.
const helperContext = {window:{QwenPaw:{host:{React:{createElement(){}, useState(){}, useEffect(){}},antd:{Input:{}}}}},console};
vm.runInNewContext(source.replace('  var APP_CSS = ', '  window.dateChecks = {isValidDate, daysUntilAnniversary, localToday, setTimezone:function(tz){BUSINESS_TIMEZONE=tz;}};\n  var APP_CSS = '), helperContext);
const dates=helperContext.window.dateChecks;
assert.equal(dates.isValidDate('2026-02-30'), false);
assert.equal(dates.isValidDate('2028-02-29'), true);
assert.equal(dates.isValidDate('2026-13-01'), false);
assert.equal(dates.daysUntilAnniversary('invalid'), null);
const NativeDate=Date;
helperContext.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-10-15T16:30:00Z']));}};
dates.setTimezone('Asia/Shanghai');assert.equal(dates.localToday(),'2026-10-16');
dates.setTimezone('UTC');assert.equal(dates.localToday(),'2026-10-15');
console.log('Date helpers: calendar validation, leap day and business timezone midnight boundary passed');

})().catch(error => {console.error(error); process.exitCode = 1;});
