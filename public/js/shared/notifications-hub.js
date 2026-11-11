(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initNotificationsHub();
  });

  function initNotificationsHub() {
    const triggerBtn = document.getElementById('notifications-trigger-btn');
    const panel = document.getElementById('notifications-dropdown-panel');
    const badge = document.getElementById('notifications-badge');
    const mobileDrawerBtn = document.getElementById(
      'mobile-drawer-notifications-btn',
    );
    const mobileDrawerBadge = document.getElementById('mobile-drawer-badge');
    const bottomBarMenuBadge = document.getElementById('bottom-bar-menu-badge');
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

    if (!triggerBtn && !mobileDrawerBtn) return;

    let isLoaded = false;
    let cachedNotifications = [];

    const ensureNotificationDetailModal = () => {
      let modal = document.getElementById('notification-detail-modal');
      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'notification-detail-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'notification-modal-title');
      modal.className =
        'fixed inset-0 z-[220] hidden items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs font-[Geist]';
      modal.innerHTML = `
        <div class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
            <div class="flex items-center gap-2">
              <span id="notification-modal-category" class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#1b4332]">EVENTO</span>
              <span id="notification-modal-date" class="font-mono text-[10px] text-slate-400"></span>
            </div>
            <button type="button" data-close-notif-modal class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer" aria-label="Cerrar detalle">✕</button>
          </div>
          <div class="p-5 space-y-3">
            <h3 id="notification-modal-title" class="text-sm font-extrabold text-slate-900 leading-snug"></h3>
            <p id="notification-modal-message" class="text-xs leading-relaxed text-slate-600 whitespace-pre-line"></p>
          </div>
          <div class="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3">
            <button type="button" data-close-notif-modal class="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cerrar</button>
            <a id="notification-modal-cta" href="/dashboard" class="hidden rounded-xl bg-[#1b4332] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#143326]">Ir al registro afectado &rarr;</a>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        window.modalScrollLock?.unlock();
      };

      modal.querySelectorAll('[data-close-notif-modal]').forEach((btn) => {
        btn.addEventListener('click', closeModal);
      });
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) closeModal();
      });
      return modal;
    };

    const setModalText = (modal, selector, value) => {
      const el = modal.querySelector(selector);
      if (el) el.textContent = value;
    };

    const syncModalCta = (modal, item) => {
      const ctaEl = modal.querySelector('#notification-modal-cta');
      if (!ctaEl) return;
      if (item.action_url) {
        ctaEl.href = `/notifications/${item.id}/open`;
        ctaEl.classList.remove('hidden');
      } else {
        ctaEl.classList.add('hidden');
      }
    };

    const openNotificationDetailModal = (item) => {
      if (!item) return;
      const modal = ensureNotificationDetailModal();
      const formattedDate = item.createdAt
        ? new Date(item.createdAt).toLocaleString('es-MX')
        : 'Reciente';

      setModalText(
        modal,
        '#notification-modal-category',
        item.category || 'SISTEMA',
      );
      setModalText(modal, '#notification-modal-date', formattedDate);
      setModalText(
        modal,
        '#notification-modal-title',
        item.title || 'Notificación',
      );
      setModalText(modal, '#notification-modal-message', item.message || '');
      syncModalCta(modal, item);

      togglePanel(false);
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      window.modalScrollLock?.lock();
    };

    const togglePanel = (show) => {
      if (!panel || !triggerBtn) return;
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

    const ensureMobileNotificationsModal = () => {
      let modal = document.getElementById('mobile-notifications-modal');
      if (modal) return modal;

      modal = document.createElement('div');
      modal.id = 'mobile-notifications-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'mobile-notifications-title');
      modal.className =
        'fixed inset-0 z-[210] hidden items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-xs font-[Geist]';
      modal.innerHTML = `
        <div class="w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 shrink-0">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-lg text-[#1b4332]">notifications</span>
              <h3 id="mobile-notifications-title" class="text-sm font-bold text-slate-900">Notificaciones</h3>
              <span id="mobile-notifications-unread-counter" class="rounded-full bg-emerald-100 px-2 py-0.5 font-['Geist_Mono'] text-[10px] font-bold text-[#1b4332]">0 nuevas</span>
            </div>
            <div class="flex items-center gap-2">
              <button id="mobile-notifications-mark-all-btn" type="button" class="text-xs font-semibold text-slate-500 hover:text-[#1b4332] cursor-pointer">Marcar leídas</button>
              <button type="button" data-close-mobile-notif class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Cerrar">✕</button>
            </div>
          </div>
          <div id="mobile-notifications-operational-summary" class="hidden border-b border-slate-200 bg-emerald-50/40 p-2.5 shrink-0"></div>
          <div id="mobile-notifications-list-container" class="overflow-y-auto divide-y divide-slate-100 p-1 flex-1">
            <div class="py-8 text-center text-xs text-slate-400">Cargando notificaciones...</div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        window.modalScrollLock?.unlock();
      };

      modal.querySelectorAll('[data-close-mobile-notif]').forEach((btn) => {
        btn.addEventListener('click', closeModal);
      });
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) closeModal();
      });

      const mobileMarkAll = modal.querySelector(
        '#mobile-notifications-mark-all-btn',
      );
      if (mobileMarkAll) {
        mobileMarkAll.addEventListener('click', () => {
          markAllBtn?.click();
        });
      }

      return modal;
    };

    const openMobileModal = () => {
      document.getElementById('mobile-drawer-close')?.click();
      const modal = ensureMobileNotificationsModal();
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      window.modalScrollLock?.lock();
      loadNotificationsData();
    };

    if (triggerBtn && panel) {
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
    }

    if (mobileDrawerBtn) {
      mobileDrawerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMobileModal();
      });
    }

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
            const allUnreads = document.querySelectorAll(
              '[data-notification-unread="true"]',
            );
            allUnreads.forEach((item) => {
              item.setAttribute('data-notification-unread', 'false');
              item.classList.remove('bg-emerald-50/40');
            });
            if (unreadCounter) unreadCounter.textContent = '0 nuevas';
            const mobCounter = document.getElementById(
              'mobile-notifications-unread-counter',
            );
            if (mobCounter) mobCounter.textContent = '0 nuevas';
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
        const countText = `${data.unreadCount || 0} nuevas`;
        if (unreadCounter) unreadCounter.textContent = countText;
        const mobCounter = document.getElementById(
          'mobile-notifications-unread-counter',
        );
        if (mobCounter) mobCounter.textContent = countText;

        renderOperationalSummary(data.operationalSummary);
        cachedNotifications = data.notifications || [];
        renderNotificationsList(cachedNotifications);
        isLoaded = true;
      } catch (err) {
        console.error('[notifications] Error cargando datos:', err);
        const containers = [
          listContainer,
          document.getElementById('mobile-notifications-list-container'),
        ];
        containers.forEach((box) => {
          if (box) {
            box.innerHTML =
              '<div class="py-6 text-center text-xs text-rose-500">Error al cargar notificaciones.</div>';
          }
        });
      }
    }

    function updateBadgeCount(count) {
      const text = count > 99 ? '99+' : String(count);
      const isVisible = count > 0;
      const applyBadge = (el) => {
        if (!el) return;
        el.textContent = text;
        if (isVisible) el.classList.remove('hidden');
        else el.classList.add('hidden');
      };

      applyBadge(badge);
      applyBadge(mobileDrawerBadge);
      if (bottomBarMenuBadge) {
        if (isVisible) bottomBarMenuBadge.classList.remove('hidden');
        else bottomBarMenuBadge.classList.add('hidden');
      }
    }

    function renderOperationalSummary(summary = {}) {
      const chips = [];
      if (summary.openHealthAlerts > 0) {
        chips.push(
          `<span class="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">⚠️ ${summary.openHealthAlerts} alerta(s) fitosanitaria(s) en predios</span>`,
        );
      }
      if (summary.itemsInReview > 0) {
        chips.push(
          `<span class="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#1b4332]">📋 ${summary.itemsInReview} ficha(s) en revisión editorial</span>`,
        );
      }
      if (summary.pendingUsers > 0) {
        chips.push(
          `<span class="inline-flex items-center gap-1 rounded-md border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-800">👤 ${summary.pendingUsers} usuario(s) pendientes de aprobación</span>`,
        );
      }

      const applySummary = (box) => {
        if (!box) return;
        if (chips.length > 0) {
          box.innerHTML = chips.join(' ');
          box.classList.remove('hidden');
        } else {
          box.classList.add('hidden');
        }
      };

      applySummary(summaryBox);
      applySummary(
        document.getElementById('mobile-notifications-operational-summary'),
      );
    }

    function renderNotificationsList(items = []) {
      const targetContainers = [
        listContainer,
        document.getElementById('mobile-notifications-list-container'),
      ].filter(Boolean);

      if (targetContainers.length === 0) return;

      if (items.length === 0) {
        targetContainers.forEach((box) => {
          box.innerHTML =
            '<div class="py-8 text-center text-xs text-slate-400">No tienes notificaciones en tu buzón.</div>';
        });
        return;
      }

      const html = items.map((item) => buildCardHtml(item)).join('');
      targetContainers.forEach((box) => {
        box.innerHTML = html;
        bindContainerEvents(box);
      });
    }

    function buildCardHtml(item) {
      const isUnread = !item.is_read;
      const bgClass = isUnread ? 'bg-emerald-50/40' : 'bg-white';
      const dotClass = isUnread ? 'bg-emerald-600' : 'bg-slate-300';
      const markBtn = isUnread
        ? `<button type="button" data-read-id="${item.id}" class="text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer">Marcar leída</button>`
        : '';

      return `
        <div data-notification-unread="${isUnread}" data-notif-card="${item.id}" class="p-3.5 transition-colors hover:bg-slate-50 ${bgClass} cursor-pointer">
          <div class="flex items-start gap-2.5">
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}"></span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.title)}</p>
                <span class="font-['Geist_Mono'] text-[9px] uppercase tracking-wider text-slate-400">${escapeHtml(item.category)}</span>
              </div>
              <p class="mt-0.5 text-[11px] text-slate-600 leading-snug line-clamp-2">${escapeHtml(item.message)}</p>
              <div class="mt-2 flex items-center justify-between">
                <button type="button" data-inspect-notif="${item.id}" class="text-[11px] font-semibold text-[#1b4332] hover:underline cursor-pointer">Ver detalles &rarr;</button>
                ${markBtn}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function bindContainerEvents(box) {
      box.querySelectorAll('[data-notif-card]').forEach((card) => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('[data-read-id]')) return;
          const notifId = card.getAttribute('data-notif-card');
          const found = cachedNotifications.find(
            (n) => String(n.id) === String(notifId),
          );
          if (card.getAttribute('data-notification-unread') === 'true') {
            markSingleAsRead(notifId, card);
          }
          openNotificationDetailModal(found);
        });
      });

      box.querySelectorAll('[data-read-id]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const notifId = btn.getAttribute('data-read-id');
          if (!notifId) return;
          const parent = btn.closest('[data-notification-unread]');
          await markSingleAsRead(notifId, parent);
        });
      });
    }

    async function markSingleAsRead(notifId, cardEl) {
      try {
        await fetch(`/api/notifications/${notifId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (cardEl) {
          cardEl.setAttribute('data-notification-unread', 'false');
          cardEl.classList.remove('bg-emerald-50/40');
          cardEl.querySelector('[data-read-id]')?.remove();
        }
        fetchBadgeCountOnly();
      } catch (_e) {
        // Ignorar error individual
      }
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
