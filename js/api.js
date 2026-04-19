const API_URL = 'http://localhost:8080';
const API_KEY = 'admin-secret';

async function api(path) {
  const res = await fetch(API_URL + path, {
    headers: { Authorization: 'Bearer ' + API_KEY }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_URL + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function apiDelete(path, body) {
  const res = await fetch(API_URL + path, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function apiVip(telegramId, isVip) {
  const res = await fetch(API_URL + `/api/admin/users/${telegramId}/vip`, {
    method: isVip ? 'POST' : 'DELETE',
    headers: { Authorization: 'Bearer ' + API_KEY }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}
