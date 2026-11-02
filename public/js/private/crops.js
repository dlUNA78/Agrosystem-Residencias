import { initializeCropForm } from './crops/cropForm.js';
import {
  applyCropCatalogDocument,
  initializeCropList,
  refreshCropCatalogView,
} from './crops/cropList.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeCropForm({
    onAfterSave: async ({ isUpdate, doc }) => {
      if (isUpdate) {
        await refreshCropCatalogView(
          window.location.pathname + window.location.search,
          { pushHistory: false, syncInputs: false },
        );
        return;
      }
      applyCropCatalogDocument(doc, '/private/crops', {
        pushHistory: true,
        syncInputs: true,
      });
    },
  });
  initializeCropList();
});
