const USER_CACHE_KEY = 'ticketsUserCache';

const THEATRES = [
  { slug: 'ramt',       name: 'РАМТ' },
  { slug: 'nations',    name: 'Театр Наций' },
  { slug: 'vakhtangov', name: 'Театр им. Вахтангова' },
  { slug: 'fomenki',    name: 'Мастерская Фоменко' },
];

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
  const mPerf = hash.match(/^performances(?:\?theatre=([\w]+))?$/);
  if (mPerf) return { page: 'performances', theatre: mPerf[1] || THEATRES[0].slug };
  return { page: 'list', filter: 'all' };
}

function updateNav() {
  const route = getRoute();
  document.getElementById('nav-users').classList.toggle('active', route.page === 'list' || route.page === 'detail');
  document.getElementById('nav-performances').classList.toggle('active', route.page === 'performances');
}

function setFilter(filter) {
  location.hash = filter === 'all' ? '#/users' : `#/users?filter=${filter}`;
}

function goToUser(telegramId) {
  location.hash = `#/users/${telegramId}`;
}

async function renderRoute() {
  updateNav();
  const route = getRoute();
  if (route.page === 'detail') {
    await renderUserDetail(route.telegramId);
  } else if (route.page === 'performances') {
    await renderPerformancesView(route.theatre);
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
        <button class="btn-add-sub" onclick="openSubscribeModal('${esc(String(telegramId))}', '${esc(user ? userName(user) : '')}')">
          + Добавить подписку
        </button>
      </div>

      ${user ? `
        <div class="user-card">
          <div class="user-avatar">${esc(userInitial(user))}</div>
          <div class="user-info-main">
            <div class="user-name">${esc(userName(user))}</div>
            <div class="user-meta">
              <span>Telegram ID: <strong>${esc(String(user.telegramId))}</strong></span>
              ${user.username ? `<span>@${esc(user.username)}</span>` : ''}
              <span id="sub-total-chip">${totalSubs} ${pluralSubs(totalSubs)}</span>
            </div>
          </div>
        </div>
      ` : ''}

      <div id="subscriptions-section">
        ${!groups.length
          ? '<div class="empty">Нет подписок</div>'
          : groups.map(g => renderTheatreGroup(g, telegramId)).join('')
        }
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="error">Ошибка загрузки: ${esc(e.message)}</div>`;
  }
}

function renderTheatreGroup(group, telegramId) {
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${subscriptions.map(s => `
            <tr data-performance-id="${esc(s.performance.id)}">
              <td><a href="${esc(s.performance.url)}" target="_blank" rel="noopener">${esc(s.performance.title)}</a></td>
              ${hasScene ? `<td class="muted">${esc(s.performance.scene)}</td>` : ''}
              <td class="muted">${formatDate(s.subscribedAt)}</td>
              <td class="muted">${s.notificationCount}</td>
              <td class="td-action">
                <button class="btn-danger-sm"
                  onclick="inlineUnsubscribe(this, '${esc(String(telegramId))}', '${esc(s.performance.id)}')">
                  Отписать
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// --- Inline unsubscribe (from detail page rows) ---

async function inlineUnsubscribe(btn, telegramId, performanceId) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await apiDelete('/api/subscriptions', { telegramId: Number(telegramId), performanceId });
    const row = btn.closest('tr');
    const section = btn.closest('.theatre-section');
    row.remove();

    // Update sub-count chip in theatre header
    const countEl = section.querySelector('.sub-count');
    const remaining = section.querySelectorAll('tbody tr').length;
    if (remaining === 0) {
      section.remove();
    } else {
      countEl.textContent = remaining;
    }

    // Update total chip in user card
    const totalChip = document.getElementById('sub-total-chip');
    if (totalChip) {
      const total = document.querySelectorAll('#subscriptions-section tbody tr').length;
      totalChip.textContent = `${total} ${pluralSubs(total)}`;
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Отписать';
    alert('Ошибка: ' + e.message);
  }
}

// --- Subscribe modal ---

let _modalHasChanges = false;
let _modalTelegramId = null;

function openSubscribeModal(telegramId, name) {
  _modalHasChanges = false;
  _modalTelegramId = telegramId;

  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog">
      <div class="modal-header">
        <span class="modal-title">Управление подписками</span>
        <span class="modal-subtitle">${esc(name)}</span>
        <button class="modal-close" onclick="closeSubscribeModal()">✕</button>
      </div>
      <div class="modal-tabs">
        ${THEATRES.map((t, i) => `
          <button class="modal-tab ${i === 0 ? 'active' : ''}"
            data-slug="${esc(t.slug)}"
            onclick="switchModalTab(this, '${esc(t.slug)}', '${esc(String(telegramId))}')">
            ${esc(t.name)}
          </button>
        `).join('')}
      </div>
      <div class="modal-body" id="modal-body">
        <div class="loading"><div class="spinner"></div><br>Загрузка...</div>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSubscribeModal(); });
  document.body.appendChild(overlay);

  loadTheatreTab(THEATRES[0].slug, telegramId);
}

function closeSubscribeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.remove();
  if (_modalHasChanges && _modalTelegramId) {
    renderUserDetail(_modalTelegramId);
  }
}

function switchModalTab(btn, slug, telegramId) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  loadTheatreTab(slug, telegramId);
}

async function loadTheatreTab(slug, telegramId) {
  const body = document.getElementById('modal-body');
  if (!body) return;
  body.innerHTML = '<div class="loading"><div class="spinner"></div><br>Загрузка...</div>';

  try {
    const performances = await api(`/api/theatres/${slug}/performances?telegramId=${telegramId}`);
    if (!performances.length) {
      body.innerHTML = '<div class="empty">Нет спектаклей</div>';
      return;
    }
    body.innerHTML = `
      <table class="modal-table">
        <tbody>
          ${performances.map(p => `
            <tr>
              <td>
                <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>
                ${p.scene ? `<span class="scene-tag">${esc(p.scene)}</span>` : ''}
              </td>
              <td class="td-action">
                <button
                  class="${p.isSubscribed ? 'btn-unsubscribe' : 'btn-subscribe'}"
                  data-subscribed="${p.isSubscribed}"
                  onclick="toggleSubscription(this, '${esc(String(telegramId))}', '${esc(p.id)}')">
                  ${p.isSubscribed ? 'Отписать' : 'Подписать'}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    body.innerHTML = `<div class="error">Ошибка загрузки: ${esc(e.message)}</div>`;
  }
}

async function toggleSubscription(btn, telegramId, performanceId) {
  const isSubscribed = btn.dataset.subscribed === 'true';
  btn.disabled = true;
  btn.textContent = '...';
  try {
    if (isSubscribed) {
      await apiDelete('/api/subscriptions', { telegramId: Number(telegramId), performanceId });
      btn.textContent = 'Подписать';
      btn.className = 'btn-subscribe';
      btn.dataset.subscribed = 'false';
    } else {
      await apiPost('/api/subscriptions', { telegramId: Number(telegramId), performanceId });
      btn.textContent = 'Отписать';
      btn.className = 'btn-unsubscribe';
      btn.dataset.subscribed = 'true';
    }
    _modalHasChanges = true;
  } catch (e) {
    btn.textContent = isSubscribed ? 'Отписать' : 'Подписать';
    btn.disabled = false;
    alert('Ошибка: ' + e.message);
    return;
  }
  btn.disabled = false;
}

// --- Performances View ---

function setTheatreTab(slug) {
  location.hash = `#/performances?theatre=${slug}`;
}

async function renderPerformancesView(activeSlug) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <span class="page-title">Спектакли</span>
    </div>
    <div class="filter-tabs">
      ${THEATRES.map(t => `
        <button class="filter-tab ${t.slug === activeSlug ? 'active' : ''}"
          onclick="setTheatreTab('${esc(t.slug)}')">
          ${esc(t.name)}
        </button>
      `).join('')}
    </div>
    <div id="perf-list">
      <div class="loading"><div class="spinner"></div><br>Загрузка...</div>
    </div>
  `;
  await loadTheatreSubscriptions(activeSlug);
}

async function loadTheatreSubscriptions(slug) {
  const container = document.getElementById('perf-list');
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div><br>Загрузка...</div>';

  try {
    const groups = await api(`/api/admin/theatres/${slug}/subscriptions`);
    if (!groups.length) {
      container.innerHTML = '<div class="empty">Нет спектаклей</div>';
      return;
    }
    container.innerHTML = groups.map(g => renderAccordionItem(g)).join('');
  } catch (e) {
    container.innerHTML = `<div class="error">Ошибка загрузки: ${esc(e.message)}</div>`;
  }
}

function renderAccordionItem(group) {
  const { performance, subscribers } = group;
  const count = subscribers.length;
  const id = 'acc-' + esc(performance.id);
  return `
    <div class="accordion-item" id="${id}">
      <div class="accordion-header" onclick="toggleAccordion('${id}')">
        <span class="accordion-arrow">▶</span>
        <span class="accordion-title">
          <a href="${esc(performance.url)}" target="_blank" rel="noopener"
            onclick="event.stopPropagation()">${esc(performance.title)}</a>
          ${performance.scene ? `<span class="scene-tag">${esc(performance.scene)}</span>` : ''}
        </span>
        <span class="sub-count accordion-badge">${count}</span>
        <button class="btn-add-inline"
          onclick="event.stopPropagation(); showAddSubscriberForm('${esc(performance.id)}', '${id}')">
          + Добавить
        </button>
      </div>
      <div class="accordion-body" hidden>
        <div class="add-sub-form" id="form-${esc(performance.id)}" hidden>
          <input class="add-sub-input" type="text" placeholder="Telegram ID" inputmode="numeric"
            onkeydown="if(event.key==='Enter') submitAddSubscriber(this.nextElementSibling, this.value, '${esc(performance.id)}', '${id}')">
          <button class="btn-subscribe"
            onclick="submitAddSubscriber(this, this.previousElementSibling.value, '${esc(performance.id)}', '${id}')">
            Подписать
          </button>
          <span class="add-sub-error" id="err-${esc(performance.id)}"></span>
        </div>
        ${renderSubscriberTable(subscribers, performance.id)}
      </div>
    </div>
  `;
}

function renderSubscriberTable(subscribers, performanceId) {
  if (!subscribers.length) {
    return '<div class="empty-small">Нет подписчиков</div>';
  }
  return `
    <table class="sub-table">
      <thead>
        <tr>
          <th>Имя</th>
          <th>Username</th>
          <th>Подписан</th>
          <th>Уведомлений</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${subscribers.map(s => renderSubscriberRow(s, performanceId)).join('')}
      </tbody>
    </table>
  `;
}

function renderSubscriberRow(s, performanceId) {
  return `
    <tr data-telegram-id="${esc(String(s.telegramId))}">
      <td>
        <a class="user-link" onclick="goToUser('${esc(String(s.telegramId))}')">
          ${esc(s.firstName)}
        </a>
      </td>
      <td class="muted">${s.username ? '@' + esc(s.username) : '—'}</td>
      <td class="muted">${formatDate(s.subscribedAt)}</td>
      <td class="muted">${s.notificationCount}</td>
      <td class="td-action">
        <button class="btn-danger-sm"
          onclick="perfUnsubscribe(this, '${esc(String(s.telegramId))}', '${esc(performanceId)}')">
          Отписать
        </button>
      </td>
    </tr>
  `;
}

function toggleAccordion(id) {
  const item = document.getElementById(id);
  if (!item) return;
  const body = item.querySelector('.accordion-body');
  const arrow = item.querySelector('.accordion-arrow');
  const isOpen = !body.hidden;
  body.hidden = isOpen;
  arrow.textContent = isOpen ? '▶' : '▼';
  item.classList.toggle('accordion-open', !isOpen);
}

function showAddSubscriberForm(performanceId, accordionId) {
  const form = document.getElementById('form-' + performanceId);
  if (!form) return;

  // Open accordion if closed
  const item = document.getElementById(accordionId);
  const body = item && item.querySelector('.accordion-body');
  if (body && body.hidden) toggleAccordion(accordionId);

  form.hidden = !form.hidden;
  if (!form.hidden) {
    const input = form.querySelector('input');
    input.value = '';
    document.getElementById('err-' + performanceId).textContent = '';
    input.focus();
  }
}

async function submitAddSubscriber(btn, rawId, performanceId, accordionId) {
  const telegramId = Number(rawId.trim());
  const errEl = document.getElementById('err-' + performanceId);
  if (!telegramId) {
    errEl.textContent = 'Введите числовой Telegram ID';
    return;
  }
  btn.disabled = true;
  errEl.textContent = '';
  try {
    await apiPost('/api/subscriptions', { telegramId, performanceId });

    // Add row to subscriber table
    const item = document.getElementById(accordionId);
    const body = item.querySelector('.accordion-body');
    let tbody = body.querySelector('tbody');
    if (!tbody) {
      // Replace empty-small placeholder with table
      const placeholder = body.querySelector('.empty-small');
      if (placeholder) placeholder.remove();
      body.insertAdjacentHTML('beforeend', renderSubscriberTable([], performanceId));
      tbody = body.querySelector('tbody');
    }
    const newSub = { telegramId, firstName: String(telegramId), username: null, subscribedAt: new Date().toISOString(), notificationCount: 0 };
    tbody.insertAdjacentHTML('beforeend', renderSubscriberRow(newSub, performanceId));

    // Update badge
    updateAccordionBadge(item, 1);

    // Hide form
    document.getElementById('form-' + performanceId).hidden = true;
  } catch (e) {
    errEl.textContent = 'Ошибка: ' + e.message;
  }
  btn.disabled = false;
}

async function perfUnsubscribe(btn, telegramId, performanceId) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await apiDelete('/api/subscriptions', { telegramId: Number(telegramId), performanceId });
    const row = btn.closest('tr');
    const item = btn.closest('.accordion-item');
    row.remove();
    updateAccordionBadge(item, -1);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Отписать';
    alert('Ошибка: ' + e.message);
  }
}

function updateAccordionBadge(item, delta) {
  const badge = item.querySelector('.accordion-badge');
  if (!badge) return;
  badge.textContent = Math.max(0, Number(badge.textContent) + delta);
}

// --- Init ---
renderRoute();
