document.addEventListener('DOMContentLoaded', () => {
  const slides = document.getElementById('hero-slides');
  const previousButton = document.getElementById('hero-prev');
  const nextButton = document.getElementById('hero-next');
  const dotsContainer = document.getElementById('hero-dots');
  const items = slides ? Array.from(slides.children) : [];

  if (items.length <= 1) {
    previousButton?.classList.add('hidden');
    nextButton?.classList.add('hidden');
    return;
  }

  let currentIndex = 0;
  let timer;

  const render = (nextIndex) => {
    currentIndex = (nextIndex + items.length) % items.length;
    slides.style.transform = `translateX(-${currentIndex * 100}%)`;

    Array.from(dotsContainer?.children || []).forEach((dot, index) => {
      dot.className =
        index === currentIndex
          ? 'h-2 w-5 rounded-full bg-white transition-all'
          : 'h-2 w-2 rounded-full bg-white/40 transition-all';
    });

    clearInterval(timer);
    timer = setInterval(() => render(currentIndex + 1), 5000);
  };

  items.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className =
      index === 0
        ? 'h-2 w-5 rounded-full bg-white transition-all'
        : 'h-2 w-2 rounded-full bg-white/40 transition-all';
    dot.setAttribute('aria-label', `Mostrar imagen ${index + 1}`);
    dot.addEventListener('click', () => render(index));
    dotsContainer?.appendChild(dot);
  });

  previousButton?.addEventListener('click', () => render(currentIndex - 1));
  nextButton?.addEventListener('click', () => render(currentIndex + 1));
  render(0);
});
