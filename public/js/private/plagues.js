import { initializePlagueForm } from './plagues/plagueForm.js';
import {
  applyCatalogDocument,
  initializePlagueList,
  refreshPlagueCatalogView,
} from './plagues/plagueList.js';

document.addEventListener('DOMContentLoaded', () => {
  initializePlagueForm({
    onAfterSave: async ({ isUpdate, doc }) => {
      if (isUpdate) {
        await refreshPlagueCatalogView(
          window.location.pathname + window.location.search,
          { pushHistory: false, syncInputs: false },
        );
        return;
      }
      applyCatalogDocument(doc, '/private/plagues', {
        pushHistory: true,
        syncInputs: true,
      });
    },
  });
  initializePlagueList();
});
