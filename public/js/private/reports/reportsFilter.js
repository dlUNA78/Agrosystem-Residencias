import {
  fetchHtmlDocument,
  refreshLucideIcons,
  setRegionLoading,
  showAsyncToast,
  swapFragments,
} from '../asyncUi.js';

const buildCurrentReportParams = () => {
  const periodSelect = document.getElementById('report-period');
  const farmSelect = document.getElementById('report-farm');
  const params = new URLSearchParams();
  params.set('period', periodSelect?.value || 'mensual');
  if (farmSelect?.value) {
    params.set('farmId', farmSelect.value);
  }
  return params;
};

const syncExportLinks = (params) => {
  const periodBadge = document.getElementById('reports-period-badge');
  if (periodBadge) {
    periodBadge.textContent = params.get('period') || 'mensual';
  }

  const buildHref = (format, reportType = '') => {
    const next = new URLSearchParams(params);
    next.set('format', format);
    if (reportType) next.set('reportType', reportType);
    return `/private/reports?${next.toString()}`;
  };

  const pdfHref = buildHref('pdf');
  const appsHref = buildHref('csv', 'applications');
  const healthHref = buildHref('csv', 'health');

  document
    .querySelector('[data-export-link="pdf"]')
    ?.setAttribute('href', pdfHref);
  document
    .querySelector('[data-export-link="applications"]')
    ?.setAttribute('href', appsHref);
  document
    .querySelector('[data-export-link="applications-bottom"]')
    ?.setAttribute('href', appsHref);
  document
    .querySelector('[data-export-link="health"]')
    ?.setAttribute('href', healthHref);
  document
    .getElementById('btn-download-report-pdf')
    ?.setAttribute('href', pdfHref);
};

const refreshReportsAsync = async () => {
  const region = document.getElementById('reports-analytics-region');
  const params = buildCurrentReportParams();
  const targetUrl = `/private/reports?${params.toString()}`;

  setRegionLoading(region, true, 'Calculando analítica fitosanitaria...');
  try {
    const result = await fetchHtmlDocument(targetUrl);
    if (!result.ok) {
      if (!result.aborted) {
        showAsyncToast(result.errorMessage, 'error');
      }
      return;
    }

    swapFragments(result.doc, ['#reports-analytics-region']);
    window.history.replaceState({}, '', targetUrl);
    syncExportLinks(params);
  } finally {
    setRegionLoading(region, false);
  }
};

const initializeExportDropdown = () => {
  const exportBtn = document.getElementById('btn-export-report');
  const exportMenu = document.getElementById('export-dropdown-menu');
  if (!exportBtn || !exportMenu) return;

  const closeDropdown = () => {
    exportMenu.classList.add('hidden');
    exportBtn.setAttribute('aria-expanded', 'false');
  };

  exportBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = exportMenu.classList.contains('hidden');
    exportMenu.classList.toggle('hidden', !willOpen);
    exportBtn.setAttribute('aria-expanded', String(willOpen));
  });

  document.addEventListener('click', () => {
    if (!exportMenu.classList.contains('hidden')) {
      closeDropdown();
    }
  });

  exportMenu.addEventListener('click', (event) => {
    event.stopPropagation();
  });
};

const initializePdfPreviewModal = () => {
  const modal = document.getElementById('modal-report-pdf-preview');
  const previewBtn = document.getElementById('btn-preview-report-pdf');
  const closeBtn = document.getElementById('btn-close-report-pdf');
  const iframe = document.getElementById('report-pdf-frame');

  if (!modal || !previewBtn || !iframe) return;

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    iframe.removeAttribute('src');
  };

  previewBtn.addEventListener('click', () => {
    const params = buildCurrentReportParams();
    syncExportLinks(params);
    params.set('format', 'pdf');
    params.set('disposition', 'inline');
    iframe.src = `/private/reports?${params.toString()}`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });

  closeBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('report-period')
    ?.addEventListener('change', refreshReportsAsync);
  document
    .getElementById('report-farm')
    ?.addEventListener('change', refreshReportsAsync);

  initializeExportDropdown();
  initializePdfPreviewModal();
  refreshLucideIcons();
});
