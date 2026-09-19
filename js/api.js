const API_URL = '';
let authGeneration = 0;

class SessionExpiredError extends Error {}
function invalidateAuth() {
  authGeneration += 1;
  window.dispatchEvent(new Event('session-expired'));
}

async function request(path, method = 'GET', body, { auth = true } = {}) {
  const generation = authGeneration;
  const response = await fetch(API_URL + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body == null ? {} : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });
  if (generation !== authGeneration) throw new SessionExpiredError('Сессия завершена');
  if (response.status === 401 && auth) {
    invalidateAuth();
    throw new SessionExpiredError('Войдите заново');
  }
  if (!response.ok) throw new Error(response.status === 401 ? 'Неверный логин или пароль' : `Ошибка ${response.status}`);
  if (response.status === 204) return null;
  const text = await response.text();
  if (generation !== authGeneration) throw new SessionExpiredError('Сессия завершена');
  return text ? JSON.parse(text) : null;
}

const api = path => request(path);
const apiPost = (path, body) => request(path, 'POST', body);
const apiDelete = (path, body) => request(path, 'DELETE', body);
const apiPatch = (path, body) => request(path, 'PATCH', body);
const apiVip = (telegramId, isVip) => request(`/api/admin/users/${telegramId}/vip`, isVip ? 'POST' : 'DELETE');
