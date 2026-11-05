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

const safeJsonParse = (str) => {
  try {
    return JSON.parse(str || '[]');
  } catch {
    return [];
  }
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

const populateUserEditFields = (data) => {
  setFieldValue('user-nombre', data.name || '');
  setFieldValue('user-email', data.email || '');
  setFieldValue('user-puesto', data.job || '');
  setFieldValue('user-rol', data.role || 'inifap');
  setFieldValue('user-subrole', data.subrole || '');
  setFieldValue('user-estatus', data.status || 'activo');
  setFieldValue('user-telefono', data.phone || '');
  setFieldValue('user-direccion', data.address || '');
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
    window.modalScrollLock?.unlock();
  };

  const openCreateModal = () => {
    formUser.reset();
    formUser.action = '/private/users/create';
    setText('modal-user-title', 'Nuevo Usuario');
    passwordGroup?.classList.remove('hidden');
    if (userPassword) userPassword.required = true;
    modalUser.classList.remove('hidden');
    modalUser.classList.add('flex');
    window.modalScrollLock?.lock();
  };

  const openEditModal = (btn) => {
    const data = btn.dataset;
    formUser.action = `/private/users/edit/${data.id}`;
    setText('modal-user-title', 'Editar Usuario');
    populateUserEditFields(data);
    passwordGroup?.classList.add('hidden');
    if (userPassword) userPassword.required = false;

    modalUser.classList.remove('hidden');
    modalUser.classList.add('flex');
    window.modalScrollLock?.lock();
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
};

const populateUserDetailCard = (data = {}) => {
  const name = data.name || 'Sin nombre';
  setText('view-user-name', name);
  setText('view-user-email', data.email || 'Sin correo');
  setText('view-user-role', (data.role || 'inifap').toUpperCase());
  setText('view-user-subrole', data.subroleName || 'Sin sub-rol');
  setText('view-user-status', data.status || 'activo');
  setText('view-user-job', data.job || 'No especificado');
  setText('view-user-phone', data.phone || 'No registrado');
  setText('view-user-address', data.address || 'No registrada');
  setText('view-user-initial', name.charAt(0).toUpperCase());
};

const initializeUserDetailModal = () => {
  const modalViewUser = document.getElementById('modal-view-user');
  if (!modalViewUser) return;

  const closeViewModal = () => {
    modalViewUser.classList.add('hidden');
    modalViewUser.classList.remove('flex');
    window.modalScrollLock?.unlock();
  };

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-view-user');
    if (!btn) return;
    populateUserDetailCard(btn.dataset);
    modalViewUser.classList.remove('hidden');
    modalViewUser.classList.add('flex');
    window.modalScrollLock?.lock();
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
};

const initializeUserPermissionsModal = () => {
  const modal = document.getElementById('modal-user-permissions');
  const form = document.getElementById('form-user-permissions');
  if (!modal || !form) return;

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    window.modalScrollLock?.unlock();
  };

  const syncCheckboxes = (containerSelector, activeList) => {
    const checkboxes = modal.querySelectorAll(containerSelector);
    checkboxes.forEach((cb) => {
      cb.checked = activeList.includes(cb.value);
    });
  };

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.btn-user-rbac');
    if (!btn) return;
    const data = btn.dataset;

    form.action = `/private/rbac/users/${data.id}/permissions`;
    setText('permissions-user-subtitle', `${data.name} · ${data.email}`);

    const roleSelect = document.getElementById('perm-user-role');
    if (roleSelect) {
      if (data.role === 'admin') {
        roleSelect.value = 'admin';
        roleSelect.disabled = true;
      } else {
        roleSelect.disabled = false;
        roleSelect.value = data.role || 'inifap';
      }
    }

    setFieldValue('perm-user-status', data.status || 'activo');
    setFieldValue('perm-user-subrole', data.subrole || '');

    const allowList = safeJsonParse(data.allow);
    const denyList = safeJsonParse(data.deny);

    syncCheckboxes('.perm-allow-checkbox', allowList);
    syncCheckboxes('.perm-deny-checkbox', denyList);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    window.modalScrollLock?.lock();
  });

  document
    .getElementById('btn-close-modal-permissions')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('btn-cancel-permissions')
    ?.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
};

const initializeRoleModals = () => {
  const modal = document.getElementById('modal-role');
  const form = document.getElementById('form-role');
  if (!modal || !form) return;

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    window.modalScrollLock?.unlock();
  };

  const openCreateRole = () => {
    form.reset();
    form.action = '/private/rbac/roles/create';
    setText('modal-role-title', 'Nuevo Sub-rol RBAC');
    modal.querySelectorAll('.role-perm-checkbox').forEach((cb) => {
      cb.checked = false;
    });
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    window.modalScrollLock?.lock();
  };

  const openEditRole = (btn) => {
    const data = btn.dataset;
    form.action = `/private/rbac/roles/edit/${data.id}`;
    setText('modal-role-title', `Editar Sub-rol: ${data.name}`);
    setFieldValue('role-nombre', data.name || '');
    setFieldValue('role-descripcion', data.description || '');
    setFieldValue('role-base', data.baseRole || 'inifap');
    setFieldValue('role-badge-color', data.badgeColor || 'purple');

    const perms = safeJsonParse(data.permissions);
    modal.querySelectorAll('.role-perm-checkbox').forEach((cb) => {
      cb.checked = perms.includes(cb.value);
    });

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    window.modalScrollLock?.lock();
  };

  document
    .getElementById('btn-add-role')
    ?.addEventListener('click', openCreateRole);

  document.addEventListener('click', (event) => {
    const editBtn = event.target.closest('.btn-edit-role');
    if (editBtn) openEditRole(editBtn);
  });

  document
    .getElementById('btn-close-modal-role')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('btn-cancel-role')
    ?.addEventListener('click', closeModal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('submit', async (event) => {
    const deleteForm = event.target.closest('.delete-role-form');
    if (!deleteForm || deleteForm.dataset.confirmed === 'true') return;
    event.preventDefault();
    const roleName = deleteForm.dataset.roleName || 'este sub-rol';
    const accepted = await confirmAsyncAction({
      title: '¿Eliminar sub-rol RBAC?',
      description: `Se eliminará la plantilla ${roleName}. Los usuarios asignados volverán a su perfil base.`,
      confirmLabel: 'Sí, eliminar sub-rol',
      variant: 'danger',
    });
    if (accepted) {
      deleteForm.dataset.confirmed = 'true';
      deleteForm.submit();
    }
  });
};

const initializeCodesTab = () => {
  document.addEventListener('click', async (event) => {
    const copyBtn = event.target.closest('.btn-copy-code');
    if (!copyBtn) return;
    const code = copyBtn.dataset.code;
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      const icon = copyBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', 'check');
        refreshLucideIcons();
        setTimeout(() => {
          icon.setAttribute('data-lucide', 'copy');
          refreshLucideIcons();
        }, 1500);
      }
    } catch {
      // fallback silent
    }
  });

  document.addEventListener('submit', async (event) => {
    const revokeForm = event.target.closest('.revoke-code-form');
    if (!revokeForm || revokeForm.dataset.confirmed === 'true') return;
    event.preventDefault();
    const accepted = await confirmAsyncAction({
      title: '¿Revocar código de acceso?',
      description:
        'El token quedará invalidado y ningún usuario podrá canjearlo.',
      confirmLabel: 'Sí, revocar código',
      variant: 'danger',
    });
    if (accepted) {
      revokeForm.dataset.confirmed = 'true';
      revokeForm.submit();
    }
  });
};

const initializeRevealedCodesModal = () => {
  const modal = document.getElementById('modal-revealed-codes');
  const closeBtn = document.getElementById('btn-close-revealed-modal');
  if (!modal) return;

  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  document.body.classList.add('overflow-hidden');

  closeBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  modal.querySelectorAll('.btn-copy-code').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.dataset.copyCode;
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        const span = btn.querySelector('span');
        if (span) {
          const original = span.textContent;
          span.textContent = '¡Copiado!';
          setTimeout(() => {
            span.textContent = original;
          }, 1500);
        }
      } catch {
        // fallback silent
      }
    });
  });
};

const initializeSudoModeModal = () => {
  const modal = document.getElementById('modal-sudo-challenge');
  const triggerBtn = document.getElementById('btn-open-sudo-codes-modal');
  const formCodes = document.getElementById('form-generate-codes');
  const passInput = document.getElementById('sudo-challenge-password');
  const hiddenPassInput = document.getElementById('form-codes-sudo-password');

  if (!modal || !triggerBtn || !formCodes) return;

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (passInput) passInput.value = '';
    window.modalScrollLock?.unlock();
  };

  const openModal = () => {
    if (!formCodes.checkValidity()) {
      formCodes.reportValidity();
      return;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    window.modalScrollLock?.lock();
    setTimeout(() => passInput?.focus(), 50);
  };

  const submitFormWithSudo = () => {
    const password = passInput?.value?.trim() || '';
    if (!password) {
      passInput?.focus();
      passInput?.reportValidity();
      return;
    }
    if (hiddenPassInput) {
      hiddenPassInput.value = password;
    }
    formCodes.submit();
  };

  triggerBtn.addEventListener('click', openModal);
  document
    .getElementById('btn-close-modal-sudo')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('btn-cancel-sudo-modal')
    ?.addEventListener('click', closeModal);
  document
    .getElementById('btn-confirm-sudo-submit')
    ?.addEventListener('click', submitFormWithSudo);

  passInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitFormWithSudo();
    }
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  const togglePassBtn = document.getElementById('btn-toggle-sudo-password');
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPassword = passInput.getAttribute('type') === 'password';
      passInput.setAttribute('type', isPassword ? 'text' : 'password');
      const icon = togglePassBtn.querySelector('i');
      if (icon) {
        icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        refreshLucideIcons();
      }
    });
  }
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
  initializeUserPermissionsModal();
  initializeRoleModals();
  initializeCodesTab();
  initializeRevealedCodesModal();
  initializeSudoModeModal();
  initializeUserDeleteConfirmation();
  refreshLucideIcons();
});
