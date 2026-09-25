const initializeImageFallbacks = () => {
  document.querySelectorAll('.plague-list-image').forEach((image) => {
    image.addEventListener(
      'error',
      () => {
        image.classList.add('hidden');
        const fallback = image.nextElementSibling;
        if (fallback?.classList.contains('plague-image-fallback')) {
          fallback.classList.remove('hidden');
          fallback.classList.add('flex');
        }
      },
      { once: true },
    );
  });
};

const initializeFilters = () => {
  const form = document.getElementById('plague-filter-form');
  document.querySelectorAll('.filter-select').forEach((select) => {
    select.addEventListener('change', () => form?.requestSubmit());
  });
};

const initializeViewToggle = () => {
  const table = document.getElementById('plagues-table-view');
  const grid = document.getElementById('plagues-grid-view');
  const tableButton = document.getElementById('view-table');
  const gridButton = document.getElementById('view-grid');
  if (!tableButton || !gridButton) return;

  const activate = (view) => {
    const showTable = view === 'table';
    table?.classList.toggle('hidden', !showTable);
    grid?.classList.toggle('hidden', showTable);
    tableButton.classList.toggle('bg-[#1b4332]', showTable);
    tableButton.classList.toggle('text-white', showTable);
    tableButton.classList.toggle('text-muted-foreground', !showTable);
    gridButton.classList.toggle('bg-[#1b4332]', !showTable);
    gridButton.classList.toggle('text-white', !showTable);
    gridButton.classList.toggle('text-muted-foreground', showTable);
  };

  const preferredView = window.localStorage.getItem('plagues-private-view');
  activate(preferredView === 'table' ? 'table' : 'grid');
  tableButton.addEventListener('click', () => {
    activate('table');
    window.localStorage.setItem('plagues-private-view', 'table');
  });
  gridButton.addEventListener('click', () => {
    activate('grid');
    window.localStorage.setItem('plagues-private-view', 'grid');
  });
};

const initializeDeleteModal = () => {
  const modal = document.getElementById('modal-delete-plague');
  const backdrop = document.getElementById('modal-delete-plague-backdrop');
  const form = document.getElementById('delete-plague-form');
  const name = document.getElementById('delete-plague-name');
  const cancelButton = document.getElementById('btn-cancel-delete-plague');

  const close = () => {
    if (!modal) return;
    modal.classList.remove('flex');
    modal.classList.add('hidden');
  };
  const open = (button) => {
    if (!modal || !form || !button) return;
    const id = button.dataset.id || '';
    if (!id) {
      console.error('No se encontró el ID de la plaga para eliminar.');
      return;
    }
    if (name) name.textContent = button.dataset.name || 'esta plaga';
    form.action = `/private/plagues/delete/${id}`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  document.querySelectorAll('.btn-delete-plague').forEach((button) => {
    button.addEventListener('click', () => open(button));
  });
  cancelButton?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal?.classList.contains('hidden')) close();
  });
};

const initializeDetailLinks = () => {
  document.querySelectorAll('.btn-view-plague').forEach((button) => {
    button.addEventListener('click', () => {
      const { id } = button.dataset;
      if (!id) {
        console.error('No se encontró el ID de la plaga.');
        return;
      }
      window.location.href = `/private/plagues/${id}`;
    });
  });
};

export const initializePlagueList = () => {
  document
    .getElementById('btn-export-plagues')
    ?.addEventListener('click', () => window.print());
  initializeImageFallbacks();
  initializeFilters();
  initializeViewToggle();
  initializeDeleteModal();
  initializeDetailLinks();
};
