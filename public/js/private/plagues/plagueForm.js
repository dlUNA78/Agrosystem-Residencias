import { createPlagueCycleEditor } from './plagueCycleEditor.js';
import { createPlagueImageEditor } from './plagueImageEditor.js';

const setInputValue = (form, name, value) => {
  const input = form.querySelector(`[name="${name}"]`);
  if (input) input.value = value || '';
};

export const initializePlagueForm = () => {
  const modal = document.getElementById('modal-plague');
  const form = document.getElementById('plague-form');
  if (!modal || !form) return;

  const title = document.getElementById('modal-plague-title');
  const saveButton = document.getElementById('btn-save-plague');
  const imageEditor = createPlagueImageEditor();
  const cycleEditor = createPlagueCycleEditor();

  const showModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
  };

  const hideModal = () => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    imageEditor.releasePreviewUrls();
    document.body.classList.remove('overflow-hidden');
  };

  const setSaveButtonLabel = (label) => {
    if (!saveButton) return;
    saveButton.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[18px]';
    icon.textContent = 'save';
    saveButton.append(icon, document.createTextNode(label));
  };

  const openCreateModal = () => {
    form.reset();
    form.action = '/private/plagues/create';
    if (title) title.textContent = 'Nueva Plaga';
    setSaveButtonLabel('Guardar plaga');
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
    setInputValue(form, 'category', data.category);
    setInputValue(form, 'region', data.region);
    setInputValue(form, 'risk_level', data.riskLevel);
    setInputValue(form, 'description', data.description);
    setInputValue(form, 'symptoms', data.symptoms);
    setInputValue(form, 'control_methods', data.controlMethods);
    setInputValue(form, 'biological_control', data.biologicalControl);
    cycleEditor.reset(data.biologicalCycle || []);
    form.action = `/private/plagues/update/${id}`;
    if (title) title.textContent = 'Editar Plaga';
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
