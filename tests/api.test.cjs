const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(fetch) {
  let expired = 0;
  const context = vm.createContext({ fetch, Event, window: { dispatchEvent() { expired++; } } });
  vm.runInContext(fs.readFileSync('js/api.js', 'utf8'), context);
  return { run: code => vm.runInContext(code, context), expired: () => expired };
}
test('uses cookie, same origin and no bearer key', async () => {
  const c = setup(async (url, options) => {
    assert.equal(url, '/api/admin/users');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, status: 200, text: async () => '[]' };
  });
  await c.run("api('/api/admin/users')");
});
test('401 clears authentication and rejects the response', async () => {
  const c = setup(async () => ({ status: 401 }));
  await assert.rejects(c.run("api('/api/admin/users')"), /Войдите/);
  assert.equal(c.expired(), 1);
});
test('a stale response cannot restore private data after logout', async () => {
  let complete;
  const c = setup(() => new Promise(resolve => { complete = resolve; }));
  const pending = c.run("api('/api/admin/users')");
  c.run('invalidateAuth()');
  complete({ ok: true, status: 200, text: async () => '[{"private":true}]' });
  await assert.rejects(pending, /Сессия завершена/);
});
test('failed login does not trigger global session expiry', async () => {
  const c = setup(async () => ({ status: 401, ok: false }));
  await assert.rejects(c.run("request('/api/admin/login', 'POST', {}, {auth:false})"), /Неверный/);
  assert.equal(c.expired(), 0);
});
