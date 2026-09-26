import { initializeSupplierDelete } from './suppliers/supplierDelete.js';
import { initializeSupplierForm } from './suppliers/supplierForm.js';
import { initializeSupplierSearch } from './suppliers/supplierSearch.js';
import { initializeSupplierViewToggle } from './suppliers/supplierViewToggle.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeSupplierViewToggle();
  initializeSupplierForm();
  initializeSupplierDelete();
  initializeSupplierSearch();
});
