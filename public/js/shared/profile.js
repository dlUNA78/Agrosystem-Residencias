(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initAvatarManager();
    initProfileTabs();
    initPasswordValidator();
    initRevokeConfirmation();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  });

  function initAvatarManager() {
    const fileInput = document.getElementById('avatar-file-input');
    const chooseBtn = document.getElementById('btn-choose-avatar');
    const previewImg = document.getElementById('avatar-preview-img');
    const fallbackBox = document.getElementById('avatar-fallback-box');
    const actionsBar = document.getElementById('avatar-actions-bar');
    const cancelBtn = document.getElementById('btn-cancel-avatar');
    const originalSrc = previewImg ? previewImg.getAttribute('src') : null;

    if (!fileInput || !chooseBtn) return;

    chooseBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const maxBytes = 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        alert('La imagen seleccionada supera el límite de 5 MB.');
        fileInput.value = '';
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Solo se permiten imágenes en formato JPG, PNG o WEBP.');
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg) {
          previewImg.src = e.target.result;
          previewImg.classList.remove('hidden');
        }
        if (fallbackBox) {
          fallbackBox.classList.add('hidden');
        }
        if (actionsBar) {
          actionsBar.classList.remove('hidden');
        }
      };
      reader.readAsDataURL(file);
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        fileInput.value = '';
        if (actionsBar) {
          actionsBar.classList.add('hidden');
        }
        if (originalSrc && previewImg) {
          previewImg.src = originalSrc;
          previewImg.classList.remove('hidden');
          if (fallbackBox) fallbackBox.classList.add('hidden');
        } else {
          if (previewImg) previewImg.classList.add('hidden');
          if (fallbackBox) fallbackBox.classList.remove('hidden');
        }
      });
    }
  }

  function initProfileTabs() {
    const tabButtons = document.querySelectorAll('[data-profile-tab]');
    const tabPanels = document.querySelectorAll('[data-profile-panel]');

    if (!tabButtons.length || !tabPanels.length) return;

    const activateTab = (tabName) => {
      tabButtons.forEach((btn) => {
        const isTarget = btn.getAttribute('data-profile-tab') === tabName;
        btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        if (isTarget) {
          btn.classList.add(
            'border-[#1b4332]',
            'text-[#1b4332]',
            'bg-emerald-50/60',
          );
          btn.classList.remove('border-transparent', 'text-slate-500');
        } else {
          btn.classList.remove(
            'border-[#1b4332]',
            'text-[#1b4332]',
            'bg-emerald-50/60',
          );
          btn.classList.add('border-transparent', 'text-slate-500');
        }
      });

      tabPanels.forEach((panel) => {
        const isTarget = panel.getAttribute('data-profile-panel') === tabName;
        panel.classList.toggle('hidden', !isTarget);
        panel.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
      });

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-profile-tab');
        activateTab(target);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', `#tab-${target}`);
        }
      });
    });

    const hash = window.location.hash;
    if (hash && hash.startsWith('#tab-')) {
      const targetFromHash = hash.replace('#tab-', '');
      activateTab(targetFromHash);
    }
  }

  function initPasswordValidator() {
    const form = document.getElementById('profile-password-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      const newPass = document.getElementById('new_password');
      const confirmPass = document.getElementById('confirm_password');
      const errorBox = document.getElementById('password-client-error');

      if (!newPass || !confirmPass) return;

      if (newPass.value.length < 8) {
        e.preventDefault();
        showClientError(
          errorBox,
          'La nueva contraseña debe tener al menos 8 caracteres.',
        );
        newPass.focus();
        return;
      }

      if (newPass.value !== confirmPass.value) {
        e.preventDefault();
        showClientError(errorBox, 'Las contraseñas ingresadas no coinciden.');
        confirmPass.focus();
        return;
      }

      if (errorBox) {
        errorBox.classList.add('hidden');
      }
    });
  }

  function showClientError(box, message) {
    if (!box) {
      alert(message);
      return;
    }
    box.textContent = message;
    box.classList.remove('hidden');
  }

  function initRevokeConfirmation() {
    const revokeForm = document.getElementById('revoke-sessions-form');
    if (!revokeForm) return;

    revokeForm.addEventListener('submit', (e) => {
      const ok = window.confirm(
        '¿Estás seguro de que deseas cerrar todas las demás sesiones activas en otros navegadores o dispositivos?',
      );
      if (!ok) {
        e.preventDefault();
      }
    });
  }
})();
