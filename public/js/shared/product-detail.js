import {
  buildFormRequest,
  confirmAsyncAction,
  fetchHtmlDocument,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from '../private/asyncUi.js';
import { initializeProductForm } from '../private/products/productForm.js';
import { initProductGalleries } from './product-gallery.js';

let scrollSpyObserver = null;

const DETAIL_SWAP_SELECTORS = [
  '#nav-plagues-count',
  '#nav-crops-count',
  '#private-editorial-panel',
  '#resumen',
  '#ficha-tecnica',
  '#plagas-objetivo',
  '#cultivos-autorizados',
  '#relaciones-tecnicas',
  '#product-pdf-sheet-preview-pane',
];

const WORKFLOW_CONFIRM_CONFIG = Object.freeze({
  submit_review: {
    title: '¿Enviar este producto a revisión técnica?',
    description:
      'El expediente cambiará a estado "En revisión" para ser evaluado por otro especialista INIFAP.',
    confirmLabel: 'Enviar a revisión',
    variant: 'editorial',
  },
  request_changes: {
    title: '¿Solicitar ajustes al autor de la ficha?',
    description:
      'El producto regresará al autor con tus observaciones técnicas para su corrección.',
    confirmLabel: 'Solicitar cambios',
    variant: 'warning',
  },
  verify: {
    title: '¿Emitir dictamen técnico favorable de INIFAP?',
    description:
      'Confirmas que el registro sanitario RSCO, banda NOM-232 y dosis han sido revisados técnicamente.',
    confirmLabel: 'Verificar ficha',
    variant: 'editorial',
  },
  publish: {
    title: '¿Publicar producto en el catálogo oficial?',
    description:
      'La ficha quedará visible en el portal público y habilitada para registros de parcelas.',
    confirmLabel: 'Publicar oficialmente',
    variant: 'editorial',
  },
  archive: {
    title: '¿Archivar este expediente de producto?',
    description:
      'El insumo se retirará de la consulta pública y de nuevos registros de bitácora.',
    confirmLabel: 'Archivar producto',
    variant: 'danger',
  },
  restore: {
    title: '¿Restaurar producto como borrador?',
    description:
      'La ficha volverá al panel privado en etapa de borrador para actualizar su información.',
    confirmLabel: 'Restaurar a borrador',
    variant: 'editorial',
  },
});

const updateActiveScrollSpyLink = (targetId) => {
  const links = document.querySelectorAll('#sub-nav [data-spy-link]');
  links.forEach((link) => {
    const isCurrent = link.dataset.spyLink === targetId;
    link.classList.toggle('text-[#1b4332]', isCurrent);
    link.classList.toggle('bg-emerald-50', isCurrent);
    link.classList.toggle('border-emerald-200/80', isCurrent);
    link.classList.toggle('font-bold', isCurrent);
    link.classList.toggle('shadow-2xs', isCurrent);
    link.classList.toggle('border-transparent', !isCurrent);
    if (isCurrent) {
      link.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  });
};

const initProductScrollSpy = () => {
  scrollSpyObserver?.disconnect();
  scrollSpyObserver = null;

  const sections = Array.from(
    document.querySelectorAll(
      '#resumen, #ficha-tecnica, #plagas-objetivo, #cultivos-autorizados, #relaciones-tecnicas',
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

const switchPdfTab = (tabName) => {
  const sheetPane = document.getElementById('product-pdf-sheet-preview-pane');
  const nativePane = document.getElementById('product-pdf-native-preview-pane');
  const iframe = document.getElementById('product-pdf-native-iframe');
  const tabButtons = document.querySelectorAll(
    '#product-pdf-preview-modal [data-pdf-tab]',
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

  const showNative = tabName === 'native';
  sheetPane?.classList.toggle('hidden', showNative);
  nativePane?.classList.toggle('hidden', !showNative);

  if (showNative && iframe && !iframe.getAttribute('src')) {
    const url = iframe.getAttribute('data-pdf-url');
    if (url) iframe.setAttribute('src', url);
  }
};

const openProductPdfModal = () => {
  const modal = document.getElementById('product-pdf-preview-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.documentElement.classList.add('overflow-hidden');
  switchPdfTab('sheet');
};

const closeProductPdfModal = () => {
  const modal = document.getElementById('product-pdf-preview-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.documentElement.classList.remove('overflow-hidden');
};

const triggerPdfPrint = (printBtn) => {
  const printUrl = printBtn?.dataset.pdfPrintUrl;
  const printFrame = document.getElementById('product-pdf-hidden-print-frame');
  if (!printFrame || !printUrl) {
    window.print();
    return;
  }
  printFrame.src = printUrl;
  printFrame.onload = () => {
    try {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    } catch {
      window.print();
    }
  };
};

const initProductPdfModal = () => {
  const modal = document.getElementById('product-pdf-preview-modal');
  const closeBtn = document.getElementById('product-pdf-preview-close-btn');
  const printBtn = document.getElementById('product-pdf-print-action-btn');

  document.addEventListener('click', (event) => {
    if (
      event.target.closest(
        '#btn-open-product-pdf-modal, #btn-open-product-pdf-hero',
      )
    ) {
      openProductPdfModal();
      return;
    }
    if (event.target === modal) {
      closeProductPdfModal();
    }
  });

  closeBtn?.addEventListener('click', closeProductPdfModal);
  printBtn?.addEventListener('click', () => triggerPdfPrint(printBtn));

  modal
    ?.querySelectorAll('[data-pdf-tab]')
    .forEach((btn) =>
      btn.addEventListener('click', () => switchPdfTab(btn.dataset.pdfTab)),
    );

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      modal &&
      !modal.classList.contains('hidden')
    ) {
      closeProductPdfModal();
    }
  });
};

const initProductShare = () => {
  const shareBtn = document.getElementById('btn-share-product');
  if (!shareBtn) return;

  shareBtn.addEventListener('click', async () => {
    const title = shareBtn.dataset.shareTitle || document.title;
    const text =
      shareBtn.dataset.shareText || 'Ficha técnica fitosanitaria INIFAP';
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

const updateRelationCounter = (fieldset) => {
  const counter = fieldset.querySelector('[data-relation-counter]');
  if (!counter) return;
  counter.textContent = String(
    fieldset.querySelectorAll('input[type="checkbox"]:checked').length,
  );
};

const filterRelationItems = (fieldset, query, onlySelected) => {
  const normalizedQuery = query.toLowerCase().trim();
  let visibleCount = 0;

  fieldset.querySelectorAll('[data-relation-item]').forEach((item) => {
    const text = item.textContent.toLowerCase();
    const checkbox = item.querySelector('input[type="checkbox"]');
    const isVisible =
      (!normalizedQuery || text.includes(normalizedQuery)) &&
      (!onlySelected || checkbox?.checked === true);
    item.classList.toggle('hidden', !isVisible);
    if (isVisible) visibleCount += 1;
  });

  fieldset
    .querySelector('[data-relation-empty]')
    ?.classList.toggle('hidden', visibleCount > 0);
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

  fieldset.addEventListener('change', (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      updateRelationCounter(fieldset);
      if (onlySelected) applyFilters();
    }
  });

  updateRelationCounter(fieldset);
};

const submitProductRelationsAsync = async (form, submitter) => {
  const plaguesCount = form.querySelectorAll(
    'input[name="plague_ids"]:checked',
  ).length;
  const cropsCount = form.querySelectorAll(
    'input[name="crop_ids"]:checked',
  ).length;

  const confirmed = await confirmAsyncAction({
    title: '¿Guardar relaciones técnicas del producto?',
    description: `Se actualizará la vinculación con ${plaguesCount} plaga(s) blanco y ${cropsCount} cultivo(s) autorizado(s).`,
    confirmLabel: 'Guardar relaciones',
    variant: 'editorial',
  });
  if (!confirmed) return;

  await withButtonLoading(submitter, 'Guardando relaciones...', async () => {
    const { url, init } = buildFormRequest(form, submitter);
    const result = await fetchHtmlDocument(url, init);
    if (!result.ok) {
      showAsyncToast(result.errorMessage, 'error');
      return;
    }
    swapFragments(result.doc, DETAIL_SWAP_SELECTORS);
    rehydrateProductDetail();
    showAsyncToast(
      'Relaciones técnicas actualizadas correctamente.',
      'success',
    );
  });
};

const initProductRelationsEditor = () => {
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
    submitProductRelationsAsync(form, submitter);
  });
};

const submitProductWorkflowAsync = async (form, submitter) => {
  if (!form.reportValidity()) return;
  const action = form.querySelector('input[name="action"]')?.value || '';
  const config = WORKFLOW_CONFIRM_CONFIG[action] || {
    title: '¿Confirmar cambio de estado editorial?',
    description: 'Se actualizará la etapa editorial del producto.',
    confirmLabel: 'Confirmar',
    variant: 'editorial',
  };

  if (!(await confirmAsyncAction(config))) return;

  await withButtonLoading(submitter, 'Actualizando...', async () => {
    const { url, init } = buildFormRequest(form, submitter);
    const result = await fetchHtmlDocument(url, init);
    if (!result.ok) {
      showAsyncToast(result.errorMessage, 'error');
      return;
    }
    swapFragments(result.doc, DETAIL_SWAP_SELECTORS);
    rehydrateProductDetail();
    showAsyncToast('Estado editorial actualizado correctamente.', 'success');
  });
};

const initProductWorkflowForms = () => {
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('#private-editorial-panel form');
    if (!form) return;
    event.preventDefault();
    const submitter =
      event.submitter || form.querySelector('button[type="submit"]');
    submitProductWorkflowAsync(form, submitter);
  });
};

const handleProductDeleteDossier = async (deleteBtn) => {
  const id = deleteBtn.dataset.id;
  const name = deleteBtn.dataset.name || 'este producto';
  if (!id) return;

  const confirmed = await confirmAsyncAction({
    title: `¿Eliminar "${name}" permanentemente?`,
    description:
      'Se eliminará la ficha técnica junto con su galería de envases y vinculaciones fitosanitarias. Esta acción es irreversible.',
    confirmLabel: 'Sí, eliminar expediente',
    variant: 'danger',
  });
  if (!confirmed) return;

  await withButtonLoading(deleteBtn, 'Eliminando...', async () => {
    const response = await fetch(
      `/private/products/delete/${encodeURIComponent(id)}`,
      {
        method: 'POST',
        headers: { Accept: 'application/json' },
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      showAsyncToast(
        result.message || 'No se pudo eliminar el expediente.',
        'error',
      );
      return;
    }
    window.location.assign('/private/products');
  });
};

const refreshDetailAfterEdit = async () => {
  const iframe = document.getElementById('product-pdf-native-iframe');
  iframe?.removeAttribute('src');

  const detailResult = await fetchHtmlDocument(window.location.pathname);
  if (!detailResult.ok) return;
  swapFragments(detailResult.doc, DETAIL_SWAP_SELECTORS);
  if (detailResult.doc.title) {
    document.title = detailResult.doc.title;
  }
  rehydrateProductDetail();
};

const initProductInSituActions = () => {
  initializeProductForm({ onAfterSave: refreshDetailAfterEdit });
  document.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('#btn-delete-product-dossier');
    if (deleteBtn) {
      handleProductDeleteDossier(deleteBtn);
    }
  });
};

const syncLucideIcons = () => {
  if (typeof window.lucide?.createIcons === 'function') {
    window.lucide.createIcons();
  }
};

const rehydrateProductDetail = () => {
  initProductScrollSpy();
  initProductGalleries();
  initProductRelationsEditor();
  syncLucideIcons();
};

document.addEventListener('DOMContentLoaded', () => {
  initProductScrollSpy();
  initProductPdfModal();
  initProductShare();
  initProductRelationsEditor();
  initProductWorkflowForms();
  initProductInSituActions();
  syncLucideIcons();
});
