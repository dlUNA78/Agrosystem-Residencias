const setupCarouselTouch = (slides, onSwipeLeft, onSwipeRight) => {
  if (!slides) return;
  let startX = 0;
  let startY = 0;

  slides.addEventListener(
    'touchstart',
    (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    },
    { passive: true },
  );

  slides.addEventListener(
    'touchend',
    (e) => {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
        if (deltaX < 0) onSwipeLeft();
        else onSwipeRight();
      }
    },
    { passive: true },
  );
};

const updateCarouselDots = (dotsContainer, currentIndex) => {
  if (!dotsContainer) return;
  Array.from(dotsContainer.children).forEach((dot, index) => {
    dot.className =
      index === currentIndex
        ? 'h-2 w-5 rounded-full bg-white transition-all shadow-xs'
        : 'h-2 w-2 rounded-full bg-white/40 hover:bg-white/70 transition-all';
  });
};

const updateCarouselCounter = (counterEl, currentIndex, total) => {
  if (!counterEl) return;
  counterEl.textContent = `${currentIndex + 1} / ${total}`;
};

const initHeroCarousel = () => {
  const slides = document.getElementById('hero-slides');
  const previousButton = document.getElementById('hero-prev');
  const nextButton = document.getElementById('hero-next');
  const dotsContainer = document.getElementById('hero-dots');
  const counterEl = document.getElementById('hero-counter');
  const items = slides ? Array.from(slides.children) : [];

  if (items.length <= 1) {
    previousButton?.classList.add('hidden');
    nextButton?.classList.add('hidden');
    if (counterEl) counterEl.classList.add('hidden');
    return;
  }

  let currentIndex = 0;
  let timer;

  const render = (nextIndex) => {
    currentIndex = (nextIndex + items.length) % items.length;
    slides.style.transform = `translateX(-${currentIndex * 100}%)`;
    updateCarouselDots(dotsContainer, currentIndex);
    updateCarouselCounter(counterEl, currentIndex, items.length);
    clearInterval(timer);
    timer = setInterval(() => render(currentIndex + 1), 5000);
  };

  items.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className =
      index === 0
        ? 'h-2 w-5 rounded-full bg-white transition-all shadow-xs'
        : 'h-2 w-2 rounded-full bg-white/40 hover:bg-white/70 transition-all';
    dot.setAttribute('aria-label', `Mostrar imagen ${index + 1}`);
    dot.addEventListener('click', () => render(index));
    dotsContainer?.appendChild(dot);
  });

  previousButton?.addEventListener('click', () => render(currentIndex - 1));
  nextButton?.addEventListener('click', () => render(currentIndex + 1));
  setupCarouselTouch(
    slides,
    () => render(currentIndex + 1),
    () => render(currentIndex - 1),
  );
  render(0);
};

const initScrollSpy = () => {
  const navLinks = Array.from(document.querySelectorAll('[data-spy-link]'));
  if (navLinks.length === 0) return;

  const sectionIds = navLinks.map((link) => link.getAttribute('data-spy-link'));
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (sections.length === 0) return;

  const setActiveLink = (currentId) => {
    navLinks.forEach((link) => {
      const targetId = link.getAttribute('data-spy-link');
      const isActive = targetId === currentId;
      link.classList.toggle('text-[#1b4332]', isActive);
      link.classList.toggle('bg-emerald-50', isActive);
      link.classList.toggle('border-emerald-200/80', isActive);
      link.classList.toggle('font-bold', isActive);
      link.classList.toggle('shadow-2xs', isActive);
      if (isActive) {
        link.scrollIntoView({
          behavior: 'smooth',
          inline: 'nearest',
          block: 'nearest',
        });
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveLink(entry.target.id);
        }
      });
    },
    { rootMargin: '-10% 0px -75% 0px', threshold: 0.1 },
  );

  sections.forEach((section) => observer.observe(section));
};

const initCopyScientificName = () => {
  const copyBtn = document.getElementById('copy-scientific-btn');
  const scientificNameEl = document.getElementById('scientific-name');
  const feedbackEl = document.getElementById('copy-feedback');
  if (!copyBtn || !scientificNameEl) return;

  copyBtn.addEventListener('click', async () => {
    const textToCopy = scientificNameEl.textContent?.trim();
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      if (feedbackEl) feedbackEl.textContent = '¡Copiado!';
      setTimeout(() => {
        if (feedbackEl) feedbackEl.textContent = 'Copiar';
      }, 2000);
    } catch {
      if (feedbackEl) feedbackEl.textContent = 'Error';
    }
  });
};

const initShareAndPrint = () => {
  const shareBtn = document.getElementById('share-plague-btn');
  const printBtn = document.getElementById('print-plague-btn');

  printBtn?.addEventListener('click', () => {
    window.print();
  });

  shareBtn?.addEventListener('click', async () => {
    const pageTitle = document.title;
    const pageUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: pageTitle,
          text: `Ficha técnica fitosanitaria de ${pageTitle} en INIFAP Agrosystem`,
          url: pageUrl,
        });
        return;
      } catch {
        // Usuario canceló el share nativo
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(pageUrl);
      const shareLabel = shareBtn.querySelector('span:last-child');
      if (shareLabel) {
        const originalText = shareLabel.textContent;
        shareLabel.textContent = '¡Enlace copiado!';
        setTimeout(() => {
          shareLabel.textContent = originalText;
        }, 2000);
      }
    } catch {
      // Ignorar fallback silencioso
    }
  });
};

const initImageLightbox = () => {
  const modal = document.getElementById('image-lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const closeBtn = document.getElementById('lightbox-close-btn');
  if (!modal || !lightboxImg) return;

  const openLightbox = (src, caption) => {
    lightboxImg.src = src;
    if (lightboxCaption) lightboxCaption.textContent = caption || '';
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  };

  const closeLightbox = () => {
    modal.classList.add('hidden');
    lightboxImg.src = '';
    document.body.classList.remove('overflow-hidden');
  };

  document.querySelectorAll('[data-lightbox-src]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const src = trigger.getAttribute('data-lightbox-src');
      const caption = trigger.getAttribute('data-lightbox-caption') || '';
      if (src) openLightbox(src, caption);
    });
  });

  closeBtn?.addEventListener('click', closeLightbox);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeLightbox();
    }
  });
};

const initImageFallbacks = () => {
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    img.addEventListener('error', () => {
      if (!img.src.includes('/images/test/default.png')) {
        img.src = '/images/test/default.png';
      }
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  initScrollSpy();
  initCopyScientificName();
  initShareAndPrint();
  initImageLightbox();
  initImageFallbacks();
});
