import { confirmAsyncAction, refreshLucideIcons } from './asyncUi.js';
import { initializePrivateSearchBars } from './search-bar.js';

const VIEW_STORAGE_KEY = 'agrosystem:users:view';
const ACTIVE_BTN_CLASSES = ['bg-[#1b4332]', 'text-white', 'shadow-2xs'];
const INACTIVE_BTN_CLASSES = ['text-slate-600', 'hover:text-slate-900'];

const setFieldValue = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.value = value;
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const readSavedView = () => {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || 'grid';
  } catch {
    return 'grid';
  }
};

const writeSavedView = (mode) => {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
};

const initializeUsersViewToggle = () => {
  const tableView = document.getElementById('users-table-view');
  const gridView = document.getElementById('users-grid-view');
  const btnTable = document.getElementById('view-table');
  const btnGrid = document.getElementById('view-grid');

  if (!tableView || !gridView || !btnTable || !btnGrid) return;

  const applyView = () => {
    const isTable = readSavedView() === 'table';
    tableView.classList.toggle('hidden', !isTable);
    gridView.classList.toggle('hidden', isTable);

    btnTable.classList.toggle('bg-[#1b4332]', isTable);
    btnTable.classList.toggle('text-white', isTable);
    btnTable.classList.toggle('shadow-2xs', isTable);
    ACTIVE_BTN_CLASSES.forEach((cls) =>
      btnGrid.classList.toggle(cls, !isTable),
    );
    INACTIVE_BTN_CLASSES.forEach((cls) => {
      btnTable.classList.toggle(cls, !isTable);
      btnGrid.classList.toggle(cls, isTable);
    });
  };

  btnGrid.addEventListener('click', () => {
    writeSavedView('grid');
    applyView();
  });

  btnTable.addEventListener('click', () => {
    writeSavedView('table');
    applyView();
  });

  applyView();
};

const initializeUserFormModal = () => {
  const modalUser = document.getElementById('modal-user');
  const formUser = document.getElementById('form-user');
  const passwordGroup = document.getElementById('password-group');
  const userPassword = document.getElementById('user-password');

  if (!modalUser || !formUser) return;

  const closeModal = () => {
    modalUser.classList.add('hidden');
    modalUser.classList.remove('flex');
  };

  const openCreateModal = () => {
    formUser.reset();
    formUser.action = '/private/users/create';
    setText('modal-user-title', 'Nuevo Usuario');
    passwordGroup?.classList.remove('hidden');
    if (userPassword) userPassword.required = true;
    modalUser.classList.remove('hidden');
    modalUser.classList.add('flex');
  };

  const openEditModal = (btn) => {
    const data = btn.dataset;
    formUser.action = `/private/users/edit/${data.id}`;
    setText('modal-user-title', 'Editar Usuario');
    setFieldValue('user-nombre', data.name || '');
    setFieldValue('user-email', data.email || '');
    setFieldValue('user-puesto', data.job || '');
    setFieldValue('user-rol', data.role || 'inifap');
    setFieldValue('user-estatus', data.status || 'activo');
    setFieldValue('user-telefono', data.phone || '');
    setFieldValue('user-direccion', data.address || '');

    passwordGroup?.classList.add('hidden');
    if (userPassword) userPassword.required = false;

    modalUser.classList.remove('hidden');
    modalUser.classList.add('flex');
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('#btn-add-user, #btn-add-user-card')) {
      openCreateModal();
      return;
    }
    const editBtn = event.target.closest('.btn-edit-user');
    if (editBtn) {
      openEditModal(editBtn);
    }
  });

  document
    .getElementById('btn-close-modal-user')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('btn-cancel-user')
    ?.addEventListener('click', closeModal);

  modalUser.addEventListener('click', (event) => {
    if (event.target === modalUser) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalUser.classList.contains('hidden')) {
      closeModal();
    }
  });
};

const initializeUserDetailModal = () => {
  const modalViewUser = document.getElementById('modal-view-user');
  if (!modalViewUser) return;

  const closeViewModal = () => {
    modalViewUser.classList.add('hidden');
    modalViewUser.classList.remove('flex');
  };

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-view-user');
    if (!btn) return;
    const data = btn.dataset;
    const name = data.name || 'Sin nombre';
    setText('view-user-name', name);
    setText('view-user-email', data.email || 'Sin correo');
    setText('view-user-role', (data.role || 'inifap').toUpperCase());
    setText('view-user-status', data.status || 'activo');
    setText('view-user-job', data.job || 'No especificado');
    setText('view-user-phone', data.phone || 'No registrado');
    setText('view-user-address', data.address || 'No registrada');
    setText('view-user-initial', name.charAt(0).toUpperCase());

    modalViewUser.classList.remove('hidden');
    modalViewUser.classList.add('flex');
  });

  document
    .getElementById('btn-close-modal-view-user')
    ?.addEventListener('click', closeViewModal);
  document
    .getElementById('btn-done-view-user')
    ?.addEventListener('click', closeViewModal);

  modalViewUser.addEventListener('click', (event) => {
    if (event.target === modalViewUser) closeViewModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalViewUser.classList.contains('hidden')) {
      closeViewModal();
    }
  });
};

const initializeUserDeleteConfirmation = () => {
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('.delete-user-form');
    if (!form || form.dataset.confirmed === 'true') return;

    event.preventDefault();
    const userName = form.dataset.userName || 'este usuario';
    const accepted = await confirmAsyncAction({
      title: '¿Eliminar cuenta de usuario?',
      description: `Se eliminará permanentemente el acceso de ${userName}. Esta acción quedará registrada en auditoría.`,
      confirmLabel: 'Sí, eliminar usuario',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });

    if (accepted) {
      form.dataset.confirmed = 'true';
      form.submit();
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initializePrivateSearchBars();
  initializeUsersViewToggle();
  initializeUserFormModal();
  initializeUserDetailModal();
  initializeUserDeleteConfirmation();
  refreshLucideIcons();
});
