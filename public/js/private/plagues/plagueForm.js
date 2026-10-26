import { createPlagueCycleEditor } from './plagueCycleEditor.js';
import { createPlagueImageEditor } from './plagueImageEditor.js';

const setInputValue = (form, name, value) => {
  const input = form.querySelector(`[name="${name}"]`);
  if (input) input.value = value || '';
};

const normalizeCategoryForSelect = (rawCategory) => {
  const map = {
    Insectos: 'Insecto',
    Hongos: 'Hongo',
    Ácaros: 'Ácaro',
  };
  return map[rawCategory] || rawCategory || '';
};

const initModalSectionNav = (modal) => {
  const scrollContainer = document.getElementById('plague-form-scroll');
  const buttons = Array.from(
    modal.querySelectorAll('[data-modal-section-target]'),
  );
  if (!scrollContainer || buttons.length === 0) return () => {};

  const highlightButton = (activeTargetId) => {
    buttons.forEach((btn) => {
      const isActive =
        btn.getAttribute('data-modal-section-target') === activeTargetId;
      btn.classList.toggle('bg-[#e6f0e6]', isActive);
      btn.classList.toggle('text-[#1b4332]', isActive);
      btn.classList.toggle('bg-muted/60', !isActive);
      btn.classList.toggle('text-muted-foreground', !isActive);
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-modal-section-target');
      const section = targetId ? document.getElementById(targetId) : null;
      if (!section) return;
      scrollContainer.scrollTo({
        top: Math.max(0, section.offsetTop - 16),
        behavior: 'smooth',
      });
      highlightButton(targetId);
    });
  });

  return () => {
    scrollContainer.scrollTop = 0;
    highlightButton('form-sec-identidad');
  };
};

export const initializePlagueForm = () => {
  const modal = document.getElementById('modal-plague');
  const form = document.getElementById('plague-form');
  if (!modal || !form) return;

  const title = document.getElementById('modal-plague-title');
  const saveButtonText = document.getElementById('btn-save-plague-text');
  const imageEditor = createPlagueImageEditor();
  const cycleEditor = createPlagueCycleEditor();
  const resetModalScroll = initModalSectionNav(modal);

  const showModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    resetModalScroll();
  };

  const hideModal = () => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    imageEditor.releasePreviewUrls();
    document.body.classList.remove('overflow-hidden');
  };

  const setSaveButtonLabel = (label) => {
    if (saveButtonText) {
      saveButtonText.textContent = label;
    }
  };

  const openCreateModal = () => {
    form.reset();
    form.action = '/private/plagues/create';
    if (title) title.textContent = 'Nueva Plaga';
    setSaveButtonLabel('Guardar borrador');
    imageEditor.reset();
    cycleEditor.reset();
    showModal();
  };

  const openEditModal = (button) => {
    if (!button) return;
    const data = button.dataset;
    const id = data.id || '';
    if (!id) {
      console.error('No se encontró el ID de la plaga.');
      return;
    }

    setInputValue(form, 'name', data.name);
    setInputValue(form, 'scientific_name', data.scientificName);
    setInputValue(form, 'category', normalizeCategoryForSelect(data.category));
    setInputValue(form, 'region', data.region);
    setInputValue(form, 'risk_level', data.riskLevel || 'Bajo');
    setInputValue(form, 'description', data.description);
    setInputValue(form, 'symptoms', data.symptoms);
    setInputValue(form, 'control_methods', data.controlMethods);
    setInputValue(form, 'biological_control', data.biologicalControl);
    cycleEditor.reset(data.biologicalCycle || []);
    form.action = `/private/plagues/update/${id}`;
    if (title) title.textContent = `Editar: ${data.name || 'Plaga'}`;
    setSaveButtonLabel('Guardar cambios');
    imageEditor.load(data);
    showModal();
  };

  document
    .getElementById('btn-add-plague')
    ?.addEventListener('click', openCreateModal);
  document
    .getElementById('btn-add-plague-card')
    ?.addEventListener('click', openCreateModal);
  document.querySelectorAll('.btn-edit-plague').forEach((button) => {
    button.addEventListener('click', () => openEditModal(button));
  });
  document
    .getElementById('modal-plague-close')
    ?.addEventListener('click', hideModal);
  document
    .getElementById('modal-plague-cancel')
    ?.addEventListener('click', hideModal);
  document
    .getElementById('modal-plague-backdrop')
    ?.addEventListener('click', hideModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      hideModal();
    }
  });
};
