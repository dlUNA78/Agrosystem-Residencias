/**
 * Controlador de cliente para filtros y exportaciones en Reportes
 */
document.addEventListener('DOMContentLoaded', () => {
  const periodSelect = document.getElementById('report-period');
  const exportBtn = document.getElementById('btn-export-report');
  const exportMenu = document.getElementById('export-dropdown-menu');

  if (periodSelect) {
    periodSelect.addEventListener('change', (e) => {
      const selectedPeriod = e.target.value;
      const url = new URL(window.location.href);
      url.searchParams.set('period', selectedPeriod);
      url.searchParams.delete('format'); // Limpiar format si existiera
      window.location.href = url.toString();
    });
  }

  if (exportBtn && exportMenu) {
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      if (!exportMenu.classList.contains('hidden')) {
        exportMenu.classList.add('hidden');
      }
    });

    exportMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
});
