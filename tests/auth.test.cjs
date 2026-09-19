const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(request) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', innerHTML: '', listeners: {},
      replaceChildren() { this.innerHTML = ''; }, addEventListener(name, fn) { this.listeners[name] = fn; } });
    return nodes.get(id);
  };
  let removed = 0, cleared = 0, renders = 0;
  const events = {};
  const context = vm.createContext({
    location: { hash: '#/users/123' }, request,
    sessionStorage: { removeItem(key) { assert.equal(key, 'ticketsUserCache'); cleared++; } },
    document: { getElementById: node, querySelector: node,
      querySelectorAll() { return [{remove() {removed++;}}]; } },
    window: { addEventListener(name, fn) { events[name] = fn; } },
    renderRoute: async () => { renders++; }
  });
  vm.runInContext('class SessionExpiredError extends Error {}; let authGeneration = 0;', context);
  vm.runInContext(fs.readFileSync('js/auth.js', 'utf8'), context);
  return { run: code => vm.runInContext(code, context), node, events,
    stats: () => ({removed,cleared,renders}) };
}
test('private routes wait for the session check', async () => {
  let resolve;
  const c = setup(() => new Promise(r => {resolve=r;}));
  const pending = c.run('initializeAuth()');
  assert.equal(c.stats().renders,0);
  assert.equal(c.node('nav').hidden,true);
  resolve({username:'admin'});
  await pending;
  assert.equal(c.stats().renders,1);
  assert.equal(c.node('nav').hidden,false);
});
test('expiry clears private cache and modals and displays login', () => {
  const c = setup(async () => ({}));
  c.events['session-expired']();
  assert.equal(c.stats().cleared,1);
  assert.equal(c.stats().removed,1);
  assert.equal(c.node('nav').hidden,true);
  assert.match(c.node('app').innerHTML,/login-form/);
});
