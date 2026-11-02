import {
  buildFormRequest,
  confirmAsyncAction,
  fetchHtmlDocument,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from '../private/asyncUi.js';
import { initializeCropForm } from '../private/crops/cropForm.js';

let scrollSpyObserver = null;

const DETAIL_SWAP_SELECTORS = [
  '#resumen',
  '#kpis',
  '#calendario',
  '#agroclima',
  '#suelo',
  '#manejo',
  '#plagas',
  '#insumos',
  '#distribucion',
  '#predios',
  '#relaciones-tecnicas',
  '#private-editorial-panel',
];

const WORKFLOW_CONFIRM_CONFIG = Object.freeze({
  submit_review: {
    title: '¿Enviar este cultivo a revisión técnica?',
    description:
      'El expediente cambiará a estado "En revisión" y quedará disponible para el dictamen del especialista INIFAP.',
    confirmLabel: 'Enviar a revisión',
    variant: 'editorial',
  },
  request_changes: {
    title: '¿Solicitar cambios al autor del cultivo?',
    description:
      'El expediente regresará al autor con tus observaciones para que realice los ajustes necesarios.',
    confirmLabel: 'Solicitar cambios',
    variant: 'warning',
  },
  verify: {
    title: '¿Emitir aval técnico oficial de INIFAP?',
    description:
      'Confirmas que las especificaciones agronómicas han sido cotejadas y cuentan con rigor científico.',
    confirmLabel: 'Verificar expediente',
    variant: 'editorial',
  },
  publish: {
    title: '¿Publicar cultivo en el catálogo público?',
    description:
      'El cultivo será visible para todos los productores, estudiantes y técnicos en la plataforma abierta.',
    confirmLabel: 'Publicar oficialmente',
    variant: 'editorial',
  },
  archive: {
    title: '¿Archivar este expediente de cultivo?',
    description:
      'El cultivo dejará de estar disponible para consulta pública en el catálogo.',
    confirmLabel: 'Archivar cultivo',
    variant: 'danger',
  },
  restore: {
    title: '¿Restaurar cultivo como borrador?',
    description:
      'El cultivo volverá a estar disponible en el panel editorial en etapa de borrador.',
    confirmLabel: 'Restaurar a borrador',
    variant: 'editorial',
  },
});

// ── 1. ScrollSpy ─────────────────────────────────────────────────────────────
const updateActiveScrollSpyLink = (targetId) => {
  const links = document.querySelectorAll('#sub-nav [data-spy-link]');
  links.forEach((link) => {
    const isCurrent = link.dataset.spyLink === targetId;
    if (isCurrent) {
      link.classList.add(
        'text-[#1b4332]',
        'bg-emerald-50',
        'border-emerald-200/80',
        'font-bold',
        'shadow-2xs',
      );
      link.classList.remove(
        'text-muted-foreground',
        'border-transparent',
        'hover:text-foreground',
      );
      link.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    } else {
      link.classList.remove(
        'text-[#1b4332]',
        'bg-emerald-50',
        'border-emerald-200/80',
        'font-bold',
        'shadow-2xs',
      );
      link.classList.add(
        'text-muted-foreground',
        'border-transparent',
        'hover:text-foreground',
      );
    }
  });
};

const initCropScrollSpy = () => {
  if (scrollSpyObserver) {
    scrollSpyObserver.disconnect();
    scrollSpyObserver = null;
  }

  const sections = Array.from(
    document.querySelectorAll(
      '#resumen, #kpis, #calendario, #agroclima, #suelo, #manejo, #plagas, #insumos, #distribucion, #predios, #relaciones-tecnicas',
    ),
  );
  if (sections.length === 0) return;

  scrollSpyObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length > 0) {
        updateActiveScrollSpyLink(visible[0].target.id);
      }
    },
    {
      rootMargin: '-15% 0px -65% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1],
    },
  );

  sections.forEach((section) => scrollSpyObserver.observe(section));
};

// ── 2. Modal de Ficha PDF ───────────────────────────────────────────────────
const switchPdfTab = (tabName) => {
  const sheetPane = document.getElementById('crop-pdf-sheet-preview-pane');
  const nativePane = document.getElementById('crop-pdf-native-preview-pane');
  const iframe = document.getElementById('crop-pdf-native-iframe');
  const tabButtons = document.querySelectorAll(
    '#crop-pdf-preview-modal [data-pdf-tab]',
  );

  tabButtons.forEach((btn) => {
    const active = btn.dataset.pdfTab === tabName;
    btn.classList.toggle('bg-card', active);
    btn.classList.toggle('text-[#1b4332]', active);
    btn.classList.toggle('font-bold', active);
    btn.classList.toggle('shadow-2xs', active);
    btn.classList.toggle('text-muted-foreground', !active);
    btn.classList.toggle('font-semibold', !active);
  });

  if (tabName === 'native') {
    sheetPane?.classList.add('hidden');
    nativePane?.classList.remove('hidden');
    if (iframe && !iframe.getAttribute('src')) {
      const url = iframe.getAttribute('data-pdf-url');
      if (url) iframe.setAttribute('src', url);
    }
  } else {
    nativePane?.classList.add('hidden');
    sheetPane?.classList.remove('hidden');
  }
};

const openCropPdfModal = () => {
  const modal = document.getElementById('crop-pdf-preview-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
  switchPdfTab('sheet');
};

const closeCropPdfModal = () => {
  const modal = document.getElementById('crop-pdf-preview-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
};

const handlePdfPrintAction = (btn) => {
  const printUrl = btn?.dataset.pdfPrintUrl;
  const printFrame = document.getElementById('crop-pdf-hidden-print-frame');

  if (printFrame && printUrl) {
    printFrame.src = printUrl;
    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch {
        window.print();
      }
    };
  } else {
    window.print();
  }
};

const initCropPdfModal = () => {
  const openBtn = document.getElementById('btn-open-crop-pdf-modal');
  const closeBtn = document.getElementById('crop-pdf-preview-close-btn');
  const modal = document.getElementById('crop-pdf-preview-modal');
  const printBtn = document.getElementById('crop-pdf-print-action-btn');

  openBtn?.addEventListener('click', openCropPdfModal);
  closeBtn?.addEventListener('click', closeCropPdfModal);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeCropPdfModal();
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      modal &&
      !modal.classList.contains('hidden')
    ) {
      closeCropPdfModal();
    }
  });

  modal
    ?.querySelectorAll('[data-pdf-tab]')
    .forEach((btn) =>
      btn.addEventListener('click', () => switchPdfTab(btn.dataset.pdfTab)),
    );

  printBtn?.addEventListener('click', () => handlePdfPrintAction(printBtn));
};

// ── 3. Compartir y Copiar Enlace ─────────────────────────────────────────────
const initCropShare = () => {
  const shareBtn = document.getElementById('btn-share-crop');
  if (!shareBtn) return;

  shareBtn.addEventListener('click', async () => {
    const title = shareBtn.dataset.shareTitle || document.title;
    const text =
      shareBtn.dataset.shareText || 'Ficha técnica agronómica INIFAP';
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showAsyncToast('Enlace copiado al portapapeles.', 'success');
    } catch {
      showAsyncToast('No se pudo copiar el enlace automáticamente.', 'error');
    }
  });
};

// ── 4. Mapa interactivo de México ───────────────────────────────────────────
const updateMapLabel = (text) => {
  const labelEl = document.getElementById('crop-map-active-label');
  if (labelEl) labelEl.textContent = text;
};

const initCropMap = () => {
  const mapSvg = document.getElementById('crop-mexico-map');
  if (!mapSvg) return;

  const defaultText =
    'Pasa el cursor o selecciona una entidad para revisar su estatus de adaptación territorial.';

  mapSvg.addEventListener('mouseover', (event) => {
    const target = event.target.closest('[data-map-label]');
    if (target) {
      updateMapLabel(target.dataset.mapLabel);
    }
  });

  mapSvg.addEventListener('mouseout', (event) => {
    const target = event.target.closest('[data-map-label]');
    if (target) {
      updateMapLabel(defaultText);
    }
  });
};

// ── 5. Editor de Relaciones Técnicas (Privado) ──────────────────────────────
const updateRelationCounter = (fieldset) => {
  const counter = fieldset.querySelector('[data-relation-counter]');
  if (!counter) return;
  const count = fieldset.querySelectorAll(
    'input[type="checkbox"]:checked',
  ).length;
  counter.textContent = String(count);
};

const filterRelationItems = (fieldset, query, onlySelected) => {
  const normalizedQuery = query.toLowerCase().trim();
  const items = fieldset.querySelectorAll('[data-relation-item]');
  let visibleCount = 0;

  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    const checkbox = item.querySelector('input[type="checkbox"]');
    const matchesSearch = !normalizedQuery || text.includes(normalizedQuery);
    const matchesSelected = !onlySelected || checkbox?.checked === true;
    const isVisible = matchesSearch && matchesSelected;

    item.classList.toggle('hidden', !isVisible);
    if (isVisible) visibleCount += 1;
  });

  const emptyMsg = fieldset.querySelector('[data-relation-empty]');
  if (emptyMsg) {
    emptyMsg.classList.toggle('hidden', visibleCount > 0);
  }
};

const setupRelationFieldset = (fieldset) => {
  const searchInput = fieldset.querySelector('[data-relation-search]');
  const onlySelectedBtn = fieldset.querySelector(
    '[data-relation-only-selected]',
  );
  let onlySelected = false;

  const applyFilters = () =>
    filterRelationItems(fieldset, searchInput?.value || '', onlySelected);

  searchInput?.addEventListener('input', applyFilters);

  onlySelectedBtn?.addEventListener('click', () => {
    onlySelected = !onlySelected;
    onlySelectedBtn.classList.toggle('bg-[#1b4332]', onlySelected);
    onlySelectedBtn.classList.toggle('text-white', onlySelected);
    onlySelectedBtn.classList.toggle('bg-white', !onlySelected);
    onlySelectedBtn.classList.toggle('text-muted-foreground', !onlySelected);
    applyFilters();
  });

  fieldset.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      updateRelationCounter(fieldset);
      if (onlySelected) applyFilters();
    }
  });

  updateRelationCounter(fieldset);
};

const countChecked = (form, name) =>
  form.querySelectorAll(`input[name="${name}"]:checked`).length;

const confirmRelationSubmission = (form) => {
  const plagues = countChecked(form, 'plague_ids');
  const products = countChecked(form, 'product_ids');

  return confirmAsyncAction({
    title: '¿Guardar relaciones técnicas del cultivo?',
    description: `Se actualizará la vinculación fitosanitaria con ${plagues} plagas monitoreadas y ${products} agroquímicos autorizados.`,
    confirmLabel: 'Guardar relaciones',
    variant: 'editorial',
  });
};

const submitCropRelationsAsync = async (form, submitter) => {
  if (!form.reportValidity()) return;
  const confirmed = await confirmRelationSubmission(form);
  if (!confirmed) return;

  await withButtonLoading(submitter, 'Guardando relaciones...', async () => {
    const { url, init } = buildFormRequest(form, submitter);
    const result = await fetchHtmlDocument(url, init);

    if (!result.ok) {
      showAsyncToast(result.errorMessage, 'error');
      return;
    }

    swapFragments(result.doc, DETAIL_SWAP_SELECTORS);
    rehydrateCropDetail();
    showAsyncToast('Relaciones técnicas guardadas correctamente.', 'success');
  });
};

const initCropRelationsEditor = () => {
  const panel = document.getElementById('relaciones-tecnicas');
  if (!panel) return;

  panel
    .querySelectorAll('[data-relation-group]')
    .forEach(setupRelationFieldset);

  const form = panel.querySelector('form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const submitter =
      event.submitter || form.querySelector('button[type="submit"]');
    submitCropRelationsAsync(form, submitter);
  });
};

// ── 6. Flujo Editorial y Acciones Asíncronas (Privado) ──────────────────────
const submitCropWorkflowAsync = async (form, submitter) => {
  if (!form.reportValidity()) return;
  const action = form.querySelector('input[name="action"]')?.value || '';
  const config = WORKFLOW_CONFIRM_CONFIG[action] || {
    title: '¿Confirmar cambio de estado editorial?',
    description: 'Se actualizará la etapa del cultivo.',
    confirmLabel: 'Confirmar',
    variant: 'editorial',
  };

  const confirmed = await confirmAsyncAction(config);
  if (!confirmed) return;

  await withButtonLoading(submitter, 'Actualizando...', async () => {
    const { url, init } = buildFormRequest(form, submitter);
    const result = await fetchHtmlDocument(url, init);

    if (!result.ok) {
      showAsyncToast(result.errorMessage, 'error');
      return;
    }

    swapFragments(result.doc, DETAIL_SWAP_SELECTORS);
    rehydrateCropDetail();
    showAsyncToast('Estado editorial actualizado.', 'success');
  });
};

const initCropWorkflowForms = () => {
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('#private-editorial-panel form');
    if (!form || form.action.includes('/relations')) return;
    event.preventDefault();
    const submitter =
      event.submitter || form.querySelector('button[type="submit"]');
    submitCropWorkflowAsync(form, submitter);
  });
};

// ── 7. Eliminación y Edición In-situ ─────────────────────────────────────────
const handleCropDeleteDossier = async (deleteBtn) => {
  const id = deleteBtn.dataset.id;
  const name = deleteBtn.dataset.name || 'este cultivo';
  if (!id) return;

  const confirmed = await confirmAsyncAction({
    title: `¿Eliminar "${name}" permanentemente?`,
    description:
      'Se eliminará el expediente agronómico con toda su información técnica, galería fotográfica y relaciones asociadas. Esta acción no se puede deshacer.',
    confirmLabel: 'Sí, eliminar expediente',
    variant: 'danger',
  });
  if (!confirmed) return;

  await withButtonLoading(deleteBtn, 'Eliminando...', async () => {
    const result = await fetchHtmlDocument(
      `/private/crops/delete/${encodeURIComponent(id)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: '',
      },
    );
    if (!result.ok) {
      showAsyncToast(result.errorMessage, 'error');
      return;
    }
    window.location.assign('/private/crops');
  });
};

const refreshDetailAfterEdit = async () => {
  const detailResult = await fetchHtmlDocument(window.location.pathname);
  if (!detailResult.ok) return;
  swapFragments(detailResult.doc, DETAIL_SWAP_SELECTORS);
  if (detailResult.doc.title) {
    document.title = detailResult.doc.title;
  }
  rehydrateCropDetail();
};

const initCropInSituActions = () => {
  initializeCropForm({ onAfterSave: refreshDetailAfterEdit });
  document.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('#btn-delete-crop-dossier');
    if (deleteBtn) {
      handleCropDeleteDossier(deleteBtn);
    }
  });
};

// ── Rehidratación tras swaps parciales ──────────────────────────────────────
const rehydrateCropDetail = () => {
  initCropScrollSpy();
  initCropMap();
  initCropRelationsEditor();
};

document.addEventListener('DOMContentLoaded', () => {
  initCropScrollSpy();
  initCropPdfModal();
  initCropShare();
  initCropMap();
  initCropRelationsEditor();
  initCropWorkflowForms();
  initCropInSituActions();
});
