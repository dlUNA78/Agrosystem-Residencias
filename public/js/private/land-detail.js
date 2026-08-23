document.addEventListener('DOMContentLoaded', function () {
  // ── Tabs ──
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => {
        b.classList.remove('border-primary', 'text-[#0F2E2E]');
        b.classList.add('border-transparent', 'text-on-surface-variant');
      });
      btn.classList.add('border-primary', 'text-[#0F2E2E]');
      btn.classList.remove('border-transparent', 'text-on-surface-variant');
      tabPanels.forEach((p) => p.classList.add('hidden'));
      const targetPanel = document.getElementById('tab-' + target);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
      }
    });
  });

  // Helper para conmutar pestañas programáticamente
  function switchTab(tabName) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn) btn.click();
  }

  const btnQuickHealthReport = document.getElementById('btn-quick-health-report');
  const btnQuickAppLog = document.getElementById('btn-quick-app-log');

  if (btnQuickHealthReport) {
    btnQuickHealthReport.addEventListener('click', () => {
      switchTab('reportes');
      const openReporteBtn = document.getElementById('btn-open-reporte');
      if (openReporteBtn) openReporteBtn.click();
    });
  }

  if (btnQuickAppLog) {
    btnQuickAppLog.addEventListener('click', () => {
      switchTab('bitacora');
      const openAplicacionBtn = document.getElementById('btn-open-aplicacion');
      if (openAplicacionBtn) openAplicacionBtn.click();
    });
  }

  // ── Botones dentro de la tarjeta de la Etapa Activa ──
  const btnStageHealthReports = document.querySelectorAll('.btn-stage-health-report');
  btnStageHealthReports.forEach((btn) => {
    btn.addEventListener('click', () => {
      const stageName = btn.dataset.stage;
      const cropId = btn.dataset.crop;
      const inputEtapa = document.getElementById('input-reporte-etapa-nombre');
      const inputCrop = document.getElementById('input-reporte-crop-id');
      if (inputEtapa) inputEtapa.value = stageName || '';
      if (inputCrop && cropId) inputCrop.value = cropId;
      const openReporteBtn = document.getElementById('btn-open-reporte');
      if (openReporteBtn) openReporteBtn.click();
    });
  });

  const btnStageAppLogs = document.querySelectorAll('.btn-stage-app-log');
  btnStageAppLogs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const stageName = btn.dataset.stage;
      const cropId = btn.dataset.crop;
      const inputEtapa = document.getElementById('input-aplicacion-etapa-nombre');
      const inputCrop = document.getElementById('input-aplicacion-crop-id');
      if (inputEtapa) inputEtapa.value = stageName || '';
      if (inputCrop && cropId) inputCrop.value = cropId;
      const openAplicacionBtn = document.getElementById('btn-open-aplicacion');
      if (openAplicacionBtn) openAplicacionBtn.click();
    });
  });

  // ── Conmutación de Vistas: Lista de Cultivos vs Detalle del Cultivo ──
  const sectionCropList = document.getElementById('section-crop-list');
  const sectionCropDetail = document.getElementById('section-crop-detail');
  const btnBackToCropList = document.getElementById('btn-back-to-crop-list');
  const focusedCropTitle = document.getElementById('focused-crop-title');
  const detailCropName = document.getElementById('detail-crop-name');
  const detailCropSection = document.getElementById('detail-crop-section');

  const btnSelectCrops = document.querySelectorAll('.btn-select-crop');

  function showCropDetail(cropName, cropSection) {
    if (focusedCropTitle)
      focusedCropTitle.textContent = `${cropName} (${cropSection || 'General'})`;
    if (detailCropName) detailCropName.textContent = cropName;
    if (detailCropSection)
      detailCropSection.textContent = `Área / Lote: ${cropSection || 'General'}`;

    if (sectionCropList) sectionCropList.classList.add('hidden');
    if (sectionCropDetail) sectionCropDetail.classList.remove('hidden');
  }

  function showCropList() {
    if (sectionCropDetail) sectionCropDetail.classList.add('hidden');
    if (sectionCropList) sectionCropList.classList.remove('hidden');
  }

  btnSelectCrops.forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.cropName || 'Cultivo';
      const section = btn.dataset.cropSection || 'General';
      showCropDetail(name, section);
    });
  });

  if (btnBackToCropList) {
    btnBackToCropList.addEventListener('click', showCropList);
  }

  // Auto-enfocar el expediente del cultivo si viene en el query string
  const urlParams = new URLSearchParams(window.location.search);
  const urlCropId = urlParams.get('crop_id');
  if (urlCropId) {
    if (sectionCropList) sectionCropList.classList.add('hidden');
    if (sectionCropDetail) sectionCropDetail.classList.remove('hidden');
  }

  // ── Modales ──
  function makeModal(modalId, openBtns, closeBtns, backdropId) {
    const modal = document.getElementById(modalId);
    const backdrop = document.getElementById(backdropId);
    function open() {
      if (modal) modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      if (modal) modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
    openBtns.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', open);
    });
    closeBtns.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', close);
    });
    if (backdrop) backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  makeModal(
    'modal-reporte',
    ['btn-open-reporte'],
    ['btn-close-reporte', 'btn-cancel-reporte'],
    'modal-reporte-backdrop',
  );
  makeModal(
    'modal-aplicacion',
    ['btn-open-aplicacion'],
    ['btn-close-aplicacion', 'btn-cancel-aplicacion'],
    'modal-aplicacion-backdrop',
  );
  makeModal(
    'modal-edit-land',
    ['btn-open-edit-land'],
    ['btn-close-edit-land', 'btn-cancel-edit-land'],
    'modal-edit-land-backdrop',
  );
  makeModal(
    'modal-nuevo-ciclo',
    ['btn-open-nuevo-ciclo', 'btn-open-nuevo-ciclo-empty'],
    ['btn-close-nuevo-ciclo', 'btn-cancel-nuevo-ciclo'],
    'modal-nuevo-ciclo-backdrop',
  );

  // ── Lógica Dinámica de Opción "Otro" en Modales ──

  // 1. Modal Nuevo Ciclo de Cultivo
  const selectCropId = document.getElementById('select-crop-id');
  const fieldCustomCrop = document.getElementById('field-custom-crop');
  const inputCustomCropName = document.getElementById('input-custom-crop-name');

  if (selectCropId) {
    selectCropId.addEventListener('change', () => {
      if (selectCropId.value === 'otro') {
        fieldCustomCrop.classList.remove('hidden');
        if (inputCustomCropName) inputCustomCropName.required = true;
      } else {
        fieldCustomCrop.classList.add('hidden');
        if (inputCustomCropName) {
          inputCustomCropName.required = false;
          inputCustomCropName.value = '';
        }
      }
    });
  }

  // 2. Modal Reporte de Salud
  const selectPlagueId = document.getElementById('select-plague-id');
  const fieldCustomPlague = document.getElementById('field-custom-plague');
  const inputCustomPlagueName = document.getElementById(
    'input-custom-plague-name',
  );

  if (selectPlagueId) {
    selectPlagueId.addEventListener('change', () => {
      if (selectPlagueId.value === 'otro') {
        fieldCustomPlague.classList.remove('hidden');
        if (inputCustomPlagueName) inputCustomPlagueName.required = true;
      } else {
        fieldCustomPlague.classList.add('hidden');
        if (inputCustomPlagueName) {
          inputCustomPlagueName.required = false;
          inputCustomPlagueName.value = '';
        }
      }
    });
  }

  // 3. Modal Aplicación Química
  const selectProductId = document.getElementById('select-product-id');
  const fieldCustomProduct = document.getElementById('field-custom-product');
  const inputCustomProductName = document.getElementById(
    'input-custom-product-name',
  );
  const inputActiveIngredient = document.getElementById(
    'input-active-ingredient',
  );

  if (selectProductId) {
    selectProductId.addEventListener('change', () => {
      const selectedOption =
        selectProductId.options[selectProductId.selectedIndex];
      const activeIng = selectedOption
        ? selectedOption.getAttribute('data-active-ingredient')
        : '';

      if (selectProductId.value === 'otro') {
        fieldCustomProduct.classList.remove('hidden');
        if (inputCustomProductName) inputCustomProductName.required = true;
        if (inputActiveIngredient) inputActiveIngredient.value = '';
      } else {
        fieldCustomProduct.classList.add('hidden');
        if (inputCustomProductName) {
          inputCustomProductName.required = false;
          inputCustomProductName.value = '';
        }
        if (inputActiveIngredient && activeIng) {
          inputActiveIngredient.value = activeIng;
        }
      }
    });
  }
});
