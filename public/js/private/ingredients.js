import { initializeIngredientViewToggle } from './ingredients/ingredientViewToggle.js';
import { initializeIngredientModal } from './ingredients/ingredientModal.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeIngredientViewToggle();
  initializeIngredientModal();
});
