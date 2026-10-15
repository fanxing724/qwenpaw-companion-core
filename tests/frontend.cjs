// Run actual frontend source with host doubles; verify registration and API resolution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('ui/index.js', 'utf8');
for (const mode of ['plain', 'api-prefix', 'no-helper', 'menu-only', 'route-failure']) {
  const calls = [], requests = [], effects = [];
  const React = {
    createElement: (type, props, ...children) => ({type, props, children}),
    useState: value => [value, () => {}], useEffect: fn => effects.push(fn),
    useRef: value => ({current: value}),
  };
  const host = {React, antd: {Input: {TextArea: {}}}};
  if (mode !== 'no-helper') host.getApiUrl = p => mode === 'api-prefix' ? '/api' + p : p;
  const qp = {host, menu: {add: (id, items) => calls.push(['menu', items])},
    route: {add: (id, items) => calls.push(['route', items])}};
  if (mode !== 'menu-only') qp.registerRoutes = (id, items) => {
    if (mode === 'route-failure') throw new Error('simulated unavailable route API');
    calls.push(['apps', items]);
  };
  const context = {window: {QwenPaw: qp}, console: {warn() {}, error() {}},
    fetch: (url) => {requests.push(url); return Promise.resolve({ok: true, json: () => Promise.resolve({version: '2.4.0'})});}};
  vm.runInNewContext(source, context);
  assert(calls.some(c => c[0] === 'menu'));
  const route = calls.find(c => c[0] === 'route')[1][0];
  assert.equal(route.id, 'companion-core.home');
  const tree = route.component();
  assert.equal(tree.children.at(-1).props.items.length, 8);
  effects[0]();
  assert.equal(requests[0], '/api/plugins/companion-core/health', mode);
}
console.log('Frontend: 5 host modes, routes, eight tabs and health API passed');

// Evaluate date helpers in isolation without adding production globals.
const helperContext = {window:{QwenPaw:{host:{React:{createElement(){}, useState(){}, useEffect(){}},antd:{Input:{}}}}},console};
vm.runInNewContext(source.replace('  var APP_CSS = ', '  window.dateChecks = {isValidDate, daysUntilAnniversary};\n  var APP_CSS = '), helperContext);
const dates=helperContext.window.dateChecks;
assert.equal(dates.isValidDate('2026-02-30'), false);
assert.equal(dates.isValidDate('2028-02-29'), true);
assert.equal(dates.isValidDate('2026-13-01'), false);
assert.equal(dates.daysUntilAnniversary('invalid'), null);
console.log('Date helpers: invalid calendar dates rejected, leap day accepted');
