let activeRequests = 0;
let trickleTimer = null;
let hideTimer = null;

const SPINNER_SVG =
  '<svg class="h-3.5 w-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle><path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path></svg>';

const TOAST_THEMES = {
  success: {
    box: 'border-emerald-200 bg-card text-foreground',
    badge: 'bg-emerald-100 text-emerald-800',
    icon: '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.415 0l-3.25-3.25a1 1 0 111.414-1.42l2.543 2.544 6.543-6.544a1 1 0 011.415 0z" clip-rule="evenodd"/></svg>',
  },
  error: {
    box: 'border-rose-200 bg-card text-foreground',
    badge: 'bg-rose-100 text-rose-700',
    icon: '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7.5a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
  },
  info: {
    box: 'border-sky-200 bg-card text-foreground',
    badge: 'bg-sky-100 text-sky-800',
    icon: '<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-8-3a1 1 0 100-2 1 1 0 000 2zm-.75 2.75a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5z" clip-rule="evenodd"/></svg>',
  },
};

const ensureProgressBar = () => {
  let root = document.getElementById('async-top-progress');
  if (!root) {
    root = document.createElement('div');
    root.id = 'async-top-progress';
    root.setAttribute('aria-hidden', 'true');
    root.className =
      'fixed top-0 left-0 right-0 z-[100] h-1 pointer-events-none opacity-0 transition-opacity duration-200';
    root.innerHTML =
      '<div data-progress-fill class="h-full w-0 bg-gradient-to-r from-[#1b4332] via-emerald-600 to-emerald-400 shadow-xs transition-[width] duration-300 ease-out"></div>';
    document.body.appendChild(root);
  }
  return { root, fill: root.querySelector('[data-progress-fill]') };
};

export const startProgressBar = () => {
  activeRequests += 1;
  if (activeRequests > 1) return;

  const { root, fill } = ensureProgressBar();
  clearTimeout(hideTimer);
  clearInterval(trickleTimer);

  root.classList.remove('opacity-0');
  fill.style.width = '28%';
  let current = 28;

  trickleTimer = window.setInterval(() => {
    if (current < 86) {
      current += Math.max(2, Math.round((90 - current) * 0.18));
      fill.style.width = `${current}%`;
    }
  }, 260);
};

export const finishProgressBar = () => {
  activeRequests = Math.max(0, activeRequests - 1);
  if (activeRequests > 0) return;

  const { root, fill } = ensureProgressBar();
  clearInterval(trickleTimer);
  fill.style.width = '100%';

  hideTimer = window.setTimeout(() => {
    root.classList.add('opacity-0');
    window.setTimeout(() => {
      if (activeRequests === 0) fill.style.width = '0%';
    }, 220);
  }, 180);
};

const ensureToastStack = () => {
  let stack = document.getElementById('async-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'async-toast-stack';
    stack.className =
      "fixed bottom-5 right-5 z-[100] flex max-w-sm flex-col gap-2.5 pointer-events-none font-['Geist']";
    document.body.appendChild(stack);
  }
  return stack;
};

export const showAsyncToast = (message, variant = 'success') => {
  if (!message) return;
  const stack = ensureToastStack();
  const theme = TOAST_THEMES[variant] || TOAST_THEMES.info;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = `pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-lg transition-all duration-200 ${theme.box}`;

  const iconBadge = document.createElement('span');
  iconBadge.className = `mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${theme.badge}`;
  iconBadge.innerHTML = theme.icon;

  const text = document.createElement('p');
  text.className = 'flex-1 text-xs font-semibold leading-relaxed';
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar notificación');
  closeBtn.className =
    'rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer';
  closeBtn.textContent = '✕';

  const dismiss = () => {
    toast.classList.add('opacity-0', 'translate-y-1');
    window.setTimeout(() => toast.remove(), 180);
  };

  closeBtn.addEventListener('click', dismiss);
  toast.append(iconBadge, text, closeBtn);
  stack.appendChild(toast);
  window.setTimeout(dismiss, 4000);
};

const lockButton = (button, loadingText) => {
  if (!button) return () => {};
  const originalHtml = button.innerHTML;
  const wasDisabled = button.disabled;

  button.dataset.asyncBusy = 'true';
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('opacity-80', 'cursor-wait');

  const label = document.createElement('span');
  label.textContent = loadingText || 'Procesando...';
  button.innerHTML = SPINNER_SVG;
  button.appendChild(label);

  return () => {
    if (!button.isConnected) return;
    delete button.dataset.asyncBusy;
    button.disabled = wasDisabled;
    button.removeAttribute('aria-busy');
    button.classList.remove('opacity-80', 'cursor-wait');
    button.innerHTML = originalHtml;
  };
};

export const isButtonBusy = (button) => button?.dataset.asyncBusy === 'true';

export const withButtonLoading = async (button, loadingText, task) => {
  if (isButtonBusy(button)) return null;
  const unlock = lockButton(button, loadingText);
  try {
    return await task();
  } finally {
    unlock();
  }
};

export const setRegionLoading = (
  container,
  isLoading,
  label = 'Actualizando vista...',
) => {
  if (!container) return;
  const existing = container.querySelector(':scope > [data-async-overlay]');

  if (!isLoading) {
    existing?.remove();
    container.removeAttribute('aria-busy');
    return;
  }

  container.classList.add('relative');
  container.setAttribute('aria-busy', 'true');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.setAttribute('data-async-overlay', 'true');
  overlay.className =
    'absolute inset-0 z-20 flex items-start justify-center rounded-2xl bg-background/60 pt-14 backdrop-blur-[1px] transition-opacity';

  const pill = document.createElement('div');
  pill.className =
    'inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-[#1b4332] shadow-md';
  pill.innerHTML = SPINNER_SVG;

  const text = document.createElement('span');
  text.textContent = label;
  pill.appendChild(text);
  overlay.appendChild(pill);
  container.appendChild(overlay);
};

const extractErrorMessage = (rawBody, status) => {
  const trimmed = String(rawBody || '').trim();
  if (!trimmed) {
    return `No se pudo completar la operación (HTTP ${status}).`;
  }
  if (!trimmed.startsWith('<')) {
    return trimmed.slice(0, 320);
  }
  const parsed = new DOMParser().parseFromString(trimmed, 'text/html');
  const bodyText = parsed.body?.textContent?.replace(/\s+/g, ' ').trim();
  return bodyText
    ? bodyText.slice(0, 320)
    : `Error del servidor (HTTP ${status}).`;
};

const buildMultipartBody = (form, submitter) => {
  const formData = new FormData(form);
  if (submitter?.name) {
    formData.append(submitter.name, submitter.value);
  }
  return formData;
};

const buildUrlEncodedBody = (form, submitter) => {
  const params = new URLSearchParams(new FormData(form));
  if (submitter?.name) {
    params.append(submitter.name, submitter.value);
  }
  return params;
};

export const buildFormRequest = (form, submitter = null) => {
  const method = (form.method || 'GET').toUpperCase();
  const action = form.getAttribute('action') || window.location.pathname;

  if (method === 'GET') {
    const url = new URL(action, window.location.origin);
    url.search = buildUrlEncodedBody(form, submitter).toString();
    return { url: url.pathname + url.search, init: { method: 'GET' } };
  }

  const isMultipart = form.enctype === 'multipart/form-data';
  const body = isMultipart
    ? buildMultipartBody(form, submitter)
    : buildUrlEncodedBody(form, submitter);

  return {
    url: action,
    init: {
      method,
      body,
      headers: { 'X-Requested-With': 'fetch' },
    },
  };
};

const isLoginRedirect = (response) => {
  if (!response.redirected || !response.url) return false;
  try {
    return new URL(response.url).pathname.startsWith('/auth/login');
  } catch {
    return false;
  }
};

export const fetchHtmlDocument = async (url, init = {}) => {
  startProgressBar();
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...init,
    });

    if (isLoginRedirect(response)) {
      window.location.href = response.url;
      return { ok: false, aborted: true, status: 401, errorMessage: '' };
    }

    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        aborted: false,
        status: response.status,
        errorMessage: extractErrorMessage(text, response.status),
      };
    }

    const doc = new DOMParser().parseFromString(text, 'text/html');
    return {
      ok: true,
      aborted: false,
      doc,
      finalUrl: response.url || url,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, aborted: true, status: 0, errorMessage: '' };
    }
    return {
      ok: false,
      aborted: false,
      status: 0,
      errorMessage: 'Error de conexión. Verifica tu red e inténtalo de nuevo.',
    };
  } finally {
    finishProgressBar();
  }
};

export const refreshLucideIcons = () => {
  if (typeof window.lucide !== 'undefined') {
    window.lucide.createIcons();
  }
};

export const swapFragments = (doc, selectors = []) => {
  if (!doc) return;
  selectors.forEach((selector) => {
    const incoming = doc.querySelector(selector);
    const current = document.querySelector(selector);
    if (incoming && current) {
      current.replaceWith(incoming);
    }
  });
  refreshLucideIcons();
};
