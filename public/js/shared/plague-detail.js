import {
  buildFormRequest,
  fetchHtmlDocument,
  showAsyncToast,
  swapFragments,
  withButtonLoading,
} from '../private/asyncUi.js';

let carouselTimer = null;
let scrollSpyObserver = null;

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
  clearInterval(carouselTimer);
  const slides = document.getElementById('hero-slides');
  const previousButton = document.getElementById('hero-prev');
  const nextButton = document.getElementById('hero-next');
  const dotsContainer = document.getElementById('hero-dots');
  const counterEl = document.getElementById('hero-counter');
  const items = slides ? Array.from(slides.children) : [];

  if (dotsContainer) dotsContainer.innerHTML = '';

  if (items.length <= 1) {
    previousButton?.classList.add('hidden');
    nextButton?.classList.add('hidden');
    if (counterEl) counterEl.classList.add('hidden');
    return;
  }

  let currentIndex = 0;

  const render = (nextIndex) => {
    currentIndex = (nextIndex + items.length) % items.length;
    slides.style.transform = `translateX(-${currentIndex * 100}%)`;
    updateCarouselDots(dotsContainer, currentIndex);
    updateCarouselCounter(counterEl, currentIndex, items.length);
    clearInterval(carouselTimer);
    carouselTimer = setInterval(() => render(currentIndex + 1), 5000);
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

const getBestIntersectingEntry = (entries) => {
  const visibleEntries = entries.filter((entry) => entry.isIntersecting);
  if (visibleEntries.length === 0) return null;
  return visibleEntries.sort(
    (a, b) => b.intersectionRatio - a.intersectionRatio,
  )[0];
};

const scrollSubNavToActiveLink = (subNav, link) => {
  if (!subNav || !link || subNav.scrollWidth <= subNav.clientWidth) return;
  const linkLeft = link.offsetLeft;
  const linkWidth = link.offsetWidth;
  const navWidth = subNav.clientWidth;
  const navScrollLeft = subNav.scrollLeft;

  if (
    linkLeft < navScrollLeft ||
    linkLeft + linkWidth > navScrollLeft + navWidth
  ) {
    subNav.scrollLeft = Math.max(0, linkLeft - navWidth / 2 + linkWidth / 2);
  }
};

const initScrollSpy = () => {
  scrollSpyObserver?.disconnect();
  const subNav = document.getElementById('sub-nav');
  const navLinks = Array.from(document.querySelectorAll('[data-spy-link]'));
  if (navLinks.length === 0) return;

  const sectionIds = navLinks.map((link) => link.getAttribute('data-spy-link'));
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if (sections.length === 0) return;

  let activeId = null;

  const setActiveLink = (currentId) => {
    if (activeId === currentId) return;
    activeId = currentId;

    navLinks.forEach((link) => {
      const targetId = link.getAttribute('data-spy-link');
      const isActive = targetId === currentId;
      link.classList.toggle('text-[#1b4332]', isActive);
      link.classList.toggle('bg-emerald-50', isActive);
      link.classList.toggle('border-emerald-200/80', isActive);
      link.classList.toggle('font-bold', isActive);
      link.classList.toggle('shadow-2xs', isActive);
      if (isActive) {
        scrollSubNavToActiveLink(subNav, link);
      }
    });
  };

  scrollSpyObserver = new IntersectionObserver(
    (entries) => {
      const best = getBestIntersectingEntry(entries);
      if (best) {
        setActiveLink(best.target.id);
      }
    },
    { rootMargin: '-15% 0px -60% 0px', threshold: [0, 0.2, 0.5] },
  );

  sections.forEach((section) => scrollSpyObserver.observe(section));
};

const initCopyScientificName = () => {
  document.addEventListener('click', async (event) => {
    const copyBtn = event.target.closest('#copy-scientific-btn');
    if (!copyBtn) return;

    const scientificNameEl = document.getElementById('scientific-name');
    const feedbackEl = document.getElementById('copy-feedback');
    const textToCopy = scientificNameEl?.textContent?.trim();
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

  const EMPTY_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const openLightbox = (src, caption) => {
    lightboxImg.src = src;
    if (lightboxCaption) lightboxCaption.textContent = caption || '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
  };

  const closeLightbox = () => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    lightboxImg.src = EMPTY_PIXEL;
    document.body.classList.remove('overflow-hidden');
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lightbox-src]');
    if (!trigger) return;
    const src = trigger.getAttribute('data-lightbox-src');
    const caption = trigger.getAttribute('data-lightbox-caption') || '';
    if (src) openLightbox(src, caption);
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
  document.querySelectorAll('img').forEach((img) => {
    if (img.dataset.fallbackBound === 'true') return;
    img.dataset.fallbackBound = 'true';
    img.addEventListener('error', () => {
      if (!img.src.includes('/images/test/default.png')) {
        img.src = '/images/test/default.png';
      }
    });
  });
};

const focusCycleStageCard = (stageIndex) => {
  const targetCard = document.querySelector(
    `[data-stage-card="${stageIndex}"]`,
  );
  if (!targetCard) return;

  const topOffset =
    targetCard.getBoundingClientRect().top + window.scrollY - 128;
  window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });

  targetCard.classList.add('ring-2', 'ring-[#1b4332]');
  setTimeout(() => {
    targetCard.classList.remove('ring-2', 'ring-[#1b4332]');
  }, 1800);
};

const initBiologicalCycleTimeline = () => {
  document.querySelectorAll('[data-stage-share]').forEach((segment) => {
    const share = Number(segment.getAttribute('data-stage-share'));
    if (Number.isFinite(share) && share > 0) {
      segment.style.width = `${share}%`;
    }
  });

  document.querySelectorAll('[data-stage-focus-btn]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = button.getAttribute('data-stage-focus-btn');
      if (index !== null) focusCycleStageCard(index);
    });
  });
};

const normalizeSearchTerm = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const initReadinessProgressBar = () => {
  const bar = document.getElementById('readiness-progress-bar');
  if (!bar) return;

  const complete = Number(bar.getAttribute('data-readiness-complete'));
  const total = Number(bar.getAttribute('data-readiness-total'));
  if (Number.isFinite(complete) && total > 0) {
    const pct = Math.min(100, Math.round((complete / total) * 100));
    bar.style.width = `${pct}%`;
  }
};

const syncRelationRowVisualState = (item) => {
  const checkbox = item.querySelector('input[type="checkbox"]');
  if (!checkbox) return false;

  const checked = checkbox.checked;
  item.classList.toggle('border-emerald-300', checked);
  item.classList.toggle('bg-emerald-50/40', checked);
  item.classList.toggle('border-transparent', !checked);

  const select = item.querySelector('select');
  if (select) {
    select.classList.toggle('opacity-55', !checked);
  }
  return checked;
};

const doesRelationItemMatch = (item, query, onlySelected) => {
  const checkbox = item.querySelector('input[type="checkbox"]');
  const isChecked = Boolean(checkbox && checkbox.checked);
  if (onlySelected && !isChecked) return false;
  if (!query) return true;
  return normalizeSearchTerm(item.textContent).includes(query);
};

const setupRelationGroup = (group) => {
  const items = Array.from(group.querySelectorAll('[data-relation-item]'));
  if (items.length === 0) return;

  const searchInput = group.querySelector('[data-relation-search]');
  const counterEl = group.querySelector('[data-relation-counter]');
  const emptyEl = group.querySelector('[data-relation-empty]');
  const onlySelectedBtn = group.querySelector('[data-relation-only-selected]');
  let onlySelected = false;

  const refresh = () => {
    const query = normalizeSearchTerm(searchInput ? searchInput.value : '');
    let selectedCount = 0;
    let visibleCount = 0;

    items.forEach((item) => {
      if (syncRelationRowVisualState(item)) selectedCount += 1;
      const visible = doesRelationItemMatch(item, query, onlySelected);
      item.classList.toggle('hidden', !visible);
      if (visible) visibleCount += 1;
    });

    if (counterEl) counterEl.textContent = `${selectedCount} / ${items.length}`;
    if (emptyEl) emptyEl.classList.toggle('hidden', visibleCount > 0);
  };

  searchInput?.addEventListener('input', refresh);
  group.addEventListener('change', refresh);
  onlySelectedBtn?.addEventListener('click', () => {
    onlySelected = !onlySelected;
    onlySelectedBtn.classList.toggle('border-[#1b4332]', onlySelected);
    onlySelectedBtn.classList.toggle('bg-[#1b4332]', onlySelected);
    onlySelectedBtn.classList.toggle('text-white', onlySelected);
    onlySelectedBtn.classList.toggle('bg-white', !onlySelected);
    onlySelectedBtn.classList.toggle('text-muted-foreground', !onlySelected);
    refresh();
  });

  refresh();
};

const initPrivateRelationEditor = () => {
  document
    .querySelectorAll('[data-relation-group]')
    .forEach(setupRelationGroup);
};

const rehydrateDetailFragments = () => {
  initHeroCarousel();
  initScrollSpy();
  initImageFallbacks();
  initReadinessProgressBar();
  initPrivateRelationEditor();
};

const submitEditorialFormAsync = (form, submitter) => {
  const isRelations = form.action.includes('/relations');
  const loadingLabel = isRelations
    ? 'Guardando relaciones...'
    : 'Actualizando estado...';

  withButtonLoading(submitter, loadingLabel, async () => {
    const { url, init } = buildFormRequest(form, submitter);
    const result = await fetchHtmlDocument(url, init);

    if (!result.ok) {
      showAsyncToast(result.errorMessage, 'error');
      return;
    }

    swapFragments(result.doc, [
      '#private-editorial-panel',
      '#resumen',
      '#productos',
      '#distribucion',
    ]);
    rehydrateDetailFragments();
    showAsyncToast(
      isRelations
        ? 'Relaciones técnicas guardadas correctamente.'
        : 'Estado editorial actualizado.',
      'success',
    );
  });
};

const initPrivateEditorialForms = () => {
  document.addEventListener('submit', (event) => {
    const form = event.target.closest('#private-editorial-panel form');
    if (!form) return;
    event.preventDefault();
    const submitter =
      event.submitter || form.querySelector('button[type="submit"]');
    submitEditorialFormAsync(form, submitter);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  initScrollSpy();
  initCopyScientificName();
  initShareAndPrint();
  initImageLightbox();
  initImageFallbacks();
  initBiologicalCycleTimeline();
  initReadinessProgressBar();
  initPrivateRelationEditor();
  initPrivateEditorialForms();
});
