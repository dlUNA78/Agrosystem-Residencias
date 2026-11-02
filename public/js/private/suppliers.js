import { refreshLucideIcons } from './asyncUi.js';
import { initializePrivateSearchBars } from './search-bar.js';
import { initializeSupplierDelete } from './suppliers/supplierDelete.js';
import { initializeSupplierForm } from './suppliers/supplierForm.js';
import { initializeSupplierSearch } from './suppliers/supplierSearch.js';
import { initializeSupplierViewToggle } from './suppliers/supplierViewToggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initializePrivateSearchBars();
  initializeSupplierViewToggle();
  initializeSupplierForm();
  initializeSupplierDelete();
  initializeSupplierSearch();
  refreshLucideIcons();
});
