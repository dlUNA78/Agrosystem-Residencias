document.querySelectorAll('img[data-fallback-src]').forEach((image) => {
  image.addEventListener('error', () => {
    const fallbackSource = image.dataset.fallbackSrc;
    if (!fallbackSource || image.src.endsWith(fallbackSource)) return;
    image.src = fallbackSource;
  });
});
