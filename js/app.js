const USER_CACHE_KEY = 'ticketsUserCache';

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function userInitial(user) {
  return (user.firstName || '?')[0].toUpperCase();
}

function userName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

function pluralSubs(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'подписка';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'подписки';
  return 'подписок';
}

// --- Session cache ---

function cacheUsers(users) {
  try { sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(users)); } catch (_) {}
}

function findCachedUser(telegramId) {
  try {
    const data = sessionStorage.getItem(USER_CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data).find(u => String(u.telegramId) === String(telegramId)) || null;
  } catch (_) { return null; }
}

// --- Router ---

function getRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash || hash === 'users') return { page: 'list', filter: 'all' };
  const mDetail = hash.match(/^users\/(\d+)$/);
  if (mDetail) return { page: 'detail', telegramId: mDetail[1] };
  const mFilter = hash.match(/^users\?filter=(\w+)$/);
  if (mFilter) return { page: 'list', filter: mFilter[1] };
  return { page: 'list', filter: 'all' };
}

function setFilter(filter) {
  location.hash = filter === 'all' ? '#/users' : `#/users?filter=${filter}`;
}

function goToUser(telegramId) {
  location.hash = `#/users/${telegramId}`;
}

async function renderRoute() {
  const route = getRoute();
  if (route.page === 'detail') {
    await renderUserDetail(route.telegramId);
  } else {
    await renderUserList(route.filter);
  }
}

window.addEventListener('hashchange', renderRoute);

// --- User List ---

async function renderUserList(filter) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <span class="page-title">Подписчики</span>
      <span class="count-chip" id="user-count"></span>
    </div>
    <div class="filter-tabs">
      <button class="filter-tab ${filter === 'all' ? 'active' : ''}" onclick="setFilter('all')">Все</button>
      <button class="filter-tab ${filter === 'withSubs' ? 'active' : ''}" onclick="setFilter('withSubs')">С подписками</button>
      <button class="filter-tab ${filter === 'noSubs' ? 'active' : ''}" onclick="setFilter('noSubs')">Без подписок</button>
    </div>
    <div class="table-wrap">
      <div class="loading"><div class="spinner"></div><br>Загрузка...</div>
    </div>
  `;

  let qs = '';
  if (filter === 'withSubs') qs = '?hasSubscriptions=true';
  if (filter === 'noSubs') qs = '?hasSubscriptions=false';

  try {
    const users = await api('/api/admin/users' + qs);
    cacheUsers(users);
    document.getElementById('user-count').textContent = users.length;

    const wrap = app.querySelector('.table-wrap');
    if (!users.length) {
      wrap.innerHTML = '<div class="empty">Нет пользователей</div>';
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Telegram ID</th>
            <th>Имя</th>
            <th>Фамилия</th>
            <th>Username</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr class="clickable" onclick="goToUser('${esc(String(u.telegramId))}')">
              <td class="muted">${esc(String(u.telegramId))}</td>
              <td>${esc(u.firstName)}</td>
              <td class="muted">${esc(u.lastName)}</td>
              <td class="muted">${u.username ? '@' + esc(u.username) : '—'}</td>
              <td>
                <span class="badge ${u.isActive ? 'badge-active' : 'badge-inactive'}">
                  ${u.isActive ? 'Активен' : 'Неактивен'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    app.querySelector('.table-wrap').innerHTML = `<div class="error">Ошибка загрузки: ${esc(e.message)}</div>`;
  }
}

// --- User Detail ---

async function renderUserDetail(telegramId) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="loading"><div class="spinner"></div><br>Загрузка...</div>`;

  try {
    let user = findCachedUser(telegramId);
    if (!user) {
      const users = await api('/api/admin/users');
      cacheUsers(users);
      user = users.find(u => String(u.telegramId) === String(telegramId));
    }

    const groups = await api(`/api/users/${telegramId}/subscriptions`);
    const totalSubs = groups.reduce((acc, g) => acc + g.subscriptions.length, 0);

    app.innerHTML = `
      <div class="page-header">
        <button class="btn-back" onclick="history.back()">← Назад</button>
        <span class="page-title">${user ? esc(userName(user)) : 'Пользователь'}</span>
        ${user && !user.isActive ? '<span class="badge badge-inactive">Неактивен</span>' : ''}
      </div>

      ${user ? `
        <div class="user-card">
          <div class="user-avatar">${esc(userInitial(user))}</div>
          <div class="user-info-main">
            <div class="user-name">${esc(userName(user))}</div>
            <div class="user-meta">
              <span>Telegram ID: <strong>${esc(String(user.telegramId))}</strong></span>
              ${user.username ? `<span>@${esc(user.username)}</span>` : ''}
              <span>${totalSubs} ${pluralSubs(totalSubs)}</span>
            </div>
          </div>
        </div>
      ` : ''}

      ${!groups.length
        ? '<div class="empty">Нет подписок</div>'
        : groups.map(g => renderTheatreGroup(g)).join('')
      }
    `;
  } catch (e) {
    app.innerHTML = `<div class="error">Ошибка загрузки: ${esc(e.message)}</div>`;
  }
}

function renderTheatreGroup(group) {
  const { theatre, subscriptions } = group;
  const hasScene = subscriptions.some(s => s.performance.scene);
  return `
    <div class="theatre-section">
      <div class="theatre-header">
        <span class="theatre-name">
          <a href="${esc(theatre.websiteUrl)}" target="_blank" rel="noopener">${esc(theatre.name)}</a>
        </span>
        <span class="sub-count">${subscriptions.length}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Спектакль</th>
            ${hasScene ? '<th>Сцена</th>' : ''}
            <th>Подписан</th>
            <th>Уведомлений</th>
          </tr>
        </thead>
        <tbody>
          ${subscriptions.map(s => `
            <tr>
              <td><a href="${esc(s.performance.url)}" target="_blank" rel="noopener">${esc(s.performance.title)}</a></td>
              ${hasScene ? `<td class="muted">${esc(s.performance.scene)}</td>` : ''}
              <td class="muted">${formatDate(s.subscribedAt)}</td>
              <td class="muted">${s.notificationCount}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- Init ---
renderRoute();
