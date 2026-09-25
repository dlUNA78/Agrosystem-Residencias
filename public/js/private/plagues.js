import { initializePlagueForm } from './plagues/plagueForm.js';
import { initializePlagueList } from './plagues/plagueList.js';

document.addEventListener('DOMContentLoaded', () => {
  initializePlagueForm();
  initializePlagueList();
});
