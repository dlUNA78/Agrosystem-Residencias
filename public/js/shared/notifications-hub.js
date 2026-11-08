(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initNotificationsHub();
  });

  function initNotificationsHub() {
    const triggerBtn = document.getElementById('notifications-trigger-btn');
    const panel = document.getElementById('notifications-dropdown-panel');
    const badge = document.getElementById('notifications-badge');
    const unreadCounter = document.getElementById(
      'notifications-unread-counter',
    );
    const markAllBtn = document.getElementById('notifications-mark-all-btn');
    const summaryBox = document.getElementById(
      'notifications-operational-summary',
    );
    const listContainer = document.getElementById(
      'notifications-list-container',
    );

    if (!triggerBtn || !panel) return;

    let isLoaded = false;

    const togglePanel = (show) => {
      const willShow =
        typeof show === 'boolean' ? show : panel.classList.contains('hidden');
      if (willShow) {
        panel.classList.remove('hidden');
        triggerBtn.setAttribute('aria-expanded', 'true');
        loadNotificationsData();
      } else {
        panel.classList.add('hidden');
        triggerBtn.setAttribute('aria-expanded', 'false');
      }
    };

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && !triggerBtn.contains(e.target)) {
        togglePanel(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.classList.contains('hidden')) {
        togglePanel(false);
        triggerBtn.focus();
      }
    });

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          });
          if (res.ok) {
            updateBadgeCount(0);
            if (listContainer) {
              const unreadItems = listContainer.querySelectorAll(
                '[data-notification-unread="true"]',
              );
              unreadItems.forEach((item) => {
                item.setAttribute('data-notification-unread', 'false');
                item.classList.remove('bg-emerald-50/40');
              });
            }
            if (unreadCounter) unreadCounter.textContent = '0 nuevas';
          }
        } catch (err) {
          console.warn(
            '[notifications] Error al marcar todas como leídas:',
            err,
          );
        }
      });
    }

    fetchBadgeCountOnly();

    async function fetchBadgeCountOnly() {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.unreadCount === 'number') {
          updateBadgeCount(data.unreadCount);
        }
      } catch (_e) {
        // Fallback silencioso
      }
    }

    async function loadNotificationsData() {
      if (isLoaded) return;
      try {
        const res = await fetch('/api/notifications?limit=15');
        if (!res.ok) throw new Error('Network response not ok');
        const data = await res.json();

        updateBadgeCount(data.unreadCount || 0);
        if (unreadCounter) {
          unreadCounter.textContent = `${data.unreadCount || 0} nuevas`;
        }

        renderOperationalSummary(data.operationalSummary);
        renderNotificationsList(data.notifications || []);
        isLoaded = true;
      } catch (err) {
        console.error('[notifications] Error cargando datos:', err);
        if (listContainer) {
          listContainer.innerHTML =
            '<div class="py-6 text-center text-xs text-rose-500">Error al cargar notificaciones.</div>';
        }
      }
    }

    function updateBadgeCount(count) {
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    function renderOperationalSummary(summary = {}) {
      if (!summaryBox) return;
      const chips = [];

      if (summary.openHealthAlerts > 0) {
        chips.push(
          `<span class="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
            ⚠️ ${summary.openHealthAlerts} alerta(s) fitosanitaria(s) en predios
          </span>`,
        );
      }
      if (summary.itemsInReview > 0) {
        chips.push(
          `<span class="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#1b4332]">
            📋 ${summary.itemsInReview} ficha(s) en revisión editorial
          </span>`,
        );
      }
      if (summary.pendingUsers > 0) {
        chips.push(
          `<span class="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-800">
            👤 ${summary.pendingUsers} usuario(s) pendientes de aprobación
          </span>`,
        );
      }

      if (chips.length > 0) {
        summaryBox.innerHTML = chips.join(' ');
        summaryBox.classList.remove('hidden');
      } else {
        summaryBox.classList.add('hidden');
      }
    }

    function renderNotificationsList(items = []) {
      if (!listContainer) return;

      if (items.length === 0) {
        listContainer.innerHTML =
          '<div class="py-8 text-center text-xs text-slate-400">No tienes notificaciones en tu buzón.</div>';
        return;
      }

      const html = items
        .map((item) => {
          const isUnread = !item.is_read;
          const bgClass = isUnread ? 'bg-emerald-50/40' : 'bg-white';
          const dotClass = isUnread ? 'bg-emerald-600' : 'bg-slate-300';
          const link = item.action_url
            ? `/notifications/${item.id}/open`
            : null;

          const actionHtml = link
            ? `<a href="${link}" class="text-[11px] font-semibold text-[#1b4332] hover:underline">Ver detalles &rarr;</a>`
            : '';

          return `
            <div data-notification-unread="${isUnread}" class="p-3.5 transition-colors hover:bg-slate-50 ${bgClass}">
              <div class="flex items-start gap-2.5">
                <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}"></span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.title)}</p>
                    <span class="font-['Geist_Mono'] text-[9px] uppercase tracking-wider text-slate-400">${escapeHtml(item.category)}</span>
                  </div>
                  <p class="mt-0.5 text-[11px] text-slate-600 leading-snug">${escapeHtml(item.message)}</p>
                  <div class="mt-2 flex items-center justify-between">
                    ${actionHtml}
                    ${
                      isUnread
                        ? `<button type="button" data-read-id="${item.id}" class="text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer">Marcar leída</button>`
                        : ''
                    }
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      listContainer.innerHTML = html;

      listContainer.querySelectorAll('[data-read-id]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const notifId = btn.getAttribute('data-read-id');
          if (!notifId) return;

          try {
            await fetch(`/api/notifications/${notifId}/read`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            const parent = btn.closest('[data-notification-unread]');
            if (parent) {
              parent.setAttribute('data-notification-unread', 'false');
              parent.classList.remove('bg-emerald-50/40');
            }
            btn.remove();
            fetchBadgeCountOnly();
          } catch (_e) {
            // Ignorar error individual
          }
        });
      });
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }
})();
