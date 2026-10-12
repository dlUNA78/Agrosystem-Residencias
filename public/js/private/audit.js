import { initializeAuditViewToggle } from './audit/auditViewToggle.js';

export const initializeAuditExport = () => {
  const btnExport = document.getElementById('btn-export-audit');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('format', 'csv');
      window.location.assign(url.toString());
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initializeAuditViewToggle();
  initializeAuditExport();
});
