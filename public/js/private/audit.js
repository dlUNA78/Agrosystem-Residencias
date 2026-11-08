import { refreshLucideIcons } from './asyncUi.js';
import { initializeAuditViewToggle } from './audit/auditViewToggle.js';
import { initializePrivateSearchBars } from './search-bar.js';

const setModalText = (id, text) => {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
};

const valOr = (val, fallback) => val || fallback;

const populateAuditModalFields = (data) => {
  const fields = [
    [
      'audit-detail-subtitle',
      `Evento #${valOr(data.logId, 'N/A')} · Registro #${valOr(data.recordId, 'N/A')}`,
    ],
    [
      'audit-detail-user',
      `${valOr(data.user, 'Sistema')} (${valOr(data.role, 'SISTEMA')})`,
    ],
    ['audit-detail-email', valOr(data.email, 'N/A')],
    ['audit-detail-module', valOr(data.module, 'Sistema')],
    ['audit-detail-table', `Tabla: ${valOr(data.table, 'N/A')}`],
    ['audit-detail-action', valOr(data.action, '---')],
    ['audit-detail-date', valOr(data.date, '---')],
    [
      'audit-detail-old-json',
      valOr(data.oldJson, '// Sin estado previo registrado (null)'),
    ],
    [
      'audit-detail-new-json',
      valOr(data.newJson, '// Sin estado nuevo registrado (null)'),
    ],
  ];
  fields.forEach(([id, text]) => setModalText(id, text));
};

export const initializeAuditExport = () => {
  const btnExport = document.getElementById('btn-export-audit');
  if (!btnExport) return;

  btnExport.addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.set('format', 'csv');
    window.location.assign(url.toString());
  });
};

export const initializeAuditInspector = () => {
  const modal = document.getElementById('modal-audit-detail');
  if (!modal) return;

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  const openModal = (trigger) => {
    populateAuditModalFields(trigger.dataset);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-audit-inspect]');
    if (trigger) {
      openModal(trigger);
    }
  });

  document
    .getElementById('btn-close-audit-detail')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('btn-done-audit-detail')
    ?.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initializePrivateSearchBars();
  initializeAuditViewToggle();
  initializeAuditExport();
  initializeAuditInspector();
  refreshLucideIcons();
});
