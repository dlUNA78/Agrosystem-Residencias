import { initializeProductForm } from './products/productForm.js';
import {
  initializeProductList,
  refreshProductCatalogView,
} from './products/productList.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeProductForm({
    onAfterSave: async ({ isUpdate }) => {
      const targetUrl = isUpdate
        ? window.location.pathname + window.location.search
        : '/private/products';
      await refreshProductCatalogView(targetUrl, {
        pushHistory: !isUpdate,
        syncInputs: !isUpdate,
      });
    },
  });
  initializeProductList();
});
