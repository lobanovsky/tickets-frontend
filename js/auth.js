let authenticated = false;
let pendingRoute = location.hash;

function clearPrivateView() {
  authenticated = false;
  try { sessionStorage.removeItem('ticketsUserCache'); } catch (_) {}
  document.querySelectorAll('.modal-overlay, #modal-overlay, #paid-modal-overlay').forEach(el => el.remove());
  document.querySelector('nav').hidden = true;
  document.getElementById('app').replaceChildren();
}

function showLogin(message = '') {
  clearPrivateView();
  const app = document.getElementById('app');
  app.innerHTML = `<form id="login-form" class="login-form">
    <h2>Вход в Tickets</h2>
    <label>Логин<input name="username" autocomplete="username" required></label>
    <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
    <p id="login-error" role="alert"></p>
    <button type="submit">Войти</button>
  </form>`;
  document.getElementById('login-error').textContent = message;
  document.getElementById('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await request('/api/admin/login', 'POST', {
        username: form.elements.username.value,
        password: form.elements.password.value
      }, { auth: false });
      form.reset();
      authenticated = true;
      document.querySelector('nav').hidden = false;
      if (location.hash !== pendingRoute) location.hash = pendingRoute;
      await renderRoute();
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) {
        document.getElementById('login-error').textContent = error instanceof TypeError ? 'Не удалось связаться с сервером' : error.message;
      }
    } finally { button.disabled = false; }
  });
}

window.addEventListener('session-expired', () => {
  pendingRoute = location.hash;
  showLogin();
});

async function initializeAuth() {
  clearPrivateView();
  document.getElementById('app').textContent = 'Проверка входа…';
  try {
    await request('/api/admin/session');
    authenticated = true;
    document.querySelector('nav').hidden = false;
    await renderRoute();
  } catch (error) {
    if (!(error instanceof SessionExpiredError)) showLogin('Не удалось проверить вход. Попробуйте войти снова.');
  }
}

document.getElementById('logout-button').addEventListener('click', async () => {
  authGeneration += 1;
  clearPrivateView();
  document.getElementById('app').textContent = 'Выход…';
  try {
    await request('/api/admin/logout', 'POST', undefined, { auth: false });
    showLogin();
  } catch (_) {
    const app = document.getElementById('app');
    app.textContent = 'Не удалось завершить сессию на сервере. ';
    const retry = document.createElement('button');
    retry.textContent = 'Повторить выход';
    retry.onclick = () => document.getElementById('logout-button').click();
    app.append(retry);
  }
});
