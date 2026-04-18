const API_URL = 'http://localhost:8080';
const API_KEY = 'admin-secret';

async function api(path) {
  const res = await fetch(API_URL + path, {
    headers: { Authorization: 'Bearer ' + API_KEY }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
