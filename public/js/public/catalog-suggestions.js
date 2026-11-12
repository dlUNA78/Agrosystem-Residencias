/**
 * Flujo de Colaboración Ciudadana / Científica en Catálogos Públicos
 * (/plagues, /crops, /products)
 */
(function initCatalogSuggestions() {
  const getModal = () => document.getElementById('modal-catalog-suggestion');

  const openModal = () => {
    const modal = getModal();
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };

  const closeModal = () => {
    const modal = getModal();
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  const showSuggestedBannerIfPresent = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('suggested') !== '1') return;

    const banner = document.getElementById('suggestion-success-banner');
    if (banner) {
      banner.classList.remove('hidden');
      banner.classList.add('flex');
    }

    params.delete('suggested');
    const cleanSearch = params.toString();
    const cleanUrl =
      window.location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    window.history.replaceState({}, '', cleanUrl);
  };

  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-open-suggestion-modal]');
    if (openTrigger) {
      event.preventDefault();
      openModal();
      return;
    }

    const closeTrigger = event.target.closest('[data-close-suggestion-modal]');
    if (closeTrigger) {
      event.preventDefault();
      closeModal();
      return;
    }

    const modal = getModal();
    if (modal && event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('DOMContentLoaded', showSuggestedBannerIfPresent);
})();
