const setupSingleGallery = (gallery) => {
  if (gallery.dataset.galleryReady === 'true') return;
  gallery.dataset.galleryReady = 'true';

  const mainImage = gallery.querySelector('[data-product-gallery-main]');
  const items = Array.from(
    gallery.querySelectorAll('[data-product-gallery-item]'),
  );
  const counter = gallery.querySelector('[data-product-gallery-counter]');
  let currentIndex = 0;

  const showImage = (index) => {
    if (!items.length || !mainImage) return;
    currentIndex = (index + items.length) % items.length;
    const selected = items[currentIndex];
    mainImage.src = selected.dataset.src;
    mainImage.alt = selected.querySelector('img')?.alt || 'Imagen del producto';
    if (counter) counter.textContent = `${currentIndex + 1} / ${items.length}`;
    items.forEach((item, itemIndex) => {
      const isCurrent = itemIndex === currentIndex;
      item.classList.toggle('border-[#1b4332]', isCurrent);
      item.classList.toggle('ring-2', isCurrent);
      item.classList.toggle('ring-[#1b4332]/20', isCurrent);
      item.classList.toggle('border-border/70', !isCurrent);
      item.setAttribute('aria-current', String(isCurrent));
    });
  };

  mainImage?.addEventListener('error', () => {
    const fallback =
      mainImage.dataset.fallback || '/images/products/default.png';
    if (mainImage.src !== new URL(fallback, window.location.origin).href) {
      mainImage.src = fallback;
    }
  });

  items.forEach((item, index) => {
    item.addEventListener('click', () => showImage(index));
  });

  gallery
    .querySelector('[data-product-gallery-prev]')
    ?.addEventListener('click', () => showImage(currentIndex - 1));
  gallery
    .querySelector('[data-product-gallery-next]')
    ?.addEventListener('click', () => showImage(currentIndex + 1));

  gallery.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (event.key === 'ArrowRight') showImage(currentIndex + 1);
  });

  showImage(0);
};

export const initProductGalleries = () => {
  document
    .querySelectorAll('[data-product-gallery]')
    .forEach(setupSingleGallery);
};

initProductGalleries();
