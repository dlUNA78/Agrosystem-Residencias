import fs from 'node:fs';
import path from 'node:path';
import hbs from 'express-hbs';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { serializeIngredient } from '../../src/services/ingredientQueryService.js';

const createClassList = (initial = '') => {
  const classes = new Set(
    String(initial || '')
      .split(/\s+/)
      .filter(Boolean),
  );
  return {
    add: (...items) => items.forEach((item) => classes.add(item)),
    remove: (...items) => items.forEach((item) => classes.delete(item)),
    contains: (item) => classes.has(item),
    toggle: (item, force) => {
      const shouldAdd =
        force === undefined ? !classes.has(item) : Boolean(force);
      if (shouldAdd) classes.add(item);
      else classes.delete(item);
      return shouldAdd;
    },
    toString: () => Array.from(classes).join(' '),
  };
};

const EXACT_SELECTOR_MATCHERS = new Map([
  [
    'button[type="submit"]',
    (el) => el.tagName === 'BUTTON' && el.type === 'submit',
  ],
  [
    'form[data-delete-ingredient-form]',
    (el) =>
      el.tagName === 'FORM' && el.hasAttribute('data-delete-ingredient-form'),
  ],
  [
    'form[data-workflow-ingredient-form]',
    (el) =>
      el.tagName === 'FORM' && el.hasAttribute('data-workflow-ingredient-form'),
  ],
  [
    '[data-request-archive-ingredient]',
    (el) => el.hasAttribute('data-request-archive-ingredient'),
  ],
  ['[data-ingredients-page]', (el) => el.hasAttribute('data-ingredients-page')],
  ['[data-progress-fill]', (el) => el.hasAttribute('data-progress-fill')],
  [
    ':scope > [data-async-overlay]',
    (el) => el.hasAttribute('data-async-overlay'),
  ],
]);

const matchesInputSelector = (el, trimmed) => {
  const match = /^input\[name="([^"]+)"\](:checked)?$/.exec(trimmed);
  if (!match) return false;
  const [, name, checkedFlag] = match;
  if (el.tagName !== 'INPUT' || el.name !== name) return false;
  return checkedFlag ? Boolean(el.checked) : true;
};

const matchesSimpleSelector = (el, selector) => {
  if (!el || !selector) return false;
  const trimmed = selector.trim();
  if (trimmed.startsWith('#')) return el.id === trimmed.slice(1);
  const exactMatcher = EXACT_SELECTOR_MATCHERS.get(trimmed);
  if (exactMatcher) return exactMatcher(el);
  return matchesInputSelector(el, trimmed);
};

const matchesSelector = (el, selector) => {
  const parts = selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.some((part) => {
    if (part === '#private-editorial-panel form') {
      return (
        el.tagName === 'FORM' && el.parentNode?.id === 'private-editorial-panel'
      );
    }
    return matchesSimpleSelector(el, part);
  });
};

const collectDescendants = (root, out = []) => {
  for (const child of root.children || []) {
    out.push(child);
    collectDescendants(child, out);
  }
  return out;
};

const createFakeElement = (tagName = 'div') => {
  const attributes = new Map();
  const listeners = new Map();
  const classList = createClassList();

  const el = {
    tagName: tagName.toUpperCase(),
    id: '',
    type: '',
    name: '',
    value: '',
    checked: false,
    disabled: false,
    isConnected: true,
    style: {},
    dataset: {},
    children: [],
    parentNode: null,
    textContent: '',
    innerHTML: '',
    classList,
    get className() {
      return el.classList.toString();
    },
    set className(val) {
      el.classList = createClassList(val);
    },
    getAttribute(key) {
      return attributes.has(key) ? attributes.get(key) : null;
    },
    setAttribute(key, val) {
      attributes.set(key, String(val));
      if (key === 'id') el.id = String(val);
    },
    removeAttribute(key) {
      attributes.delete(key);
    },
    hasAttribute(key) {
      return attributes.has(key);
    },
    appendChild(child) {
      child.parentNode = el;
      child.isConnected = true;
      el.children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.forEach((node) => el.appendChild(node));
    },
    remove() {
      if (!el.parentNode) return;
      el.parentNode.children = el.parentNode.children.filter((c) => c !== el);
      el.parentNode = null;
      el.isConnected = false;
    },
    replaceWith(replacement) {
      if (!el.parentNode || !replacement) return;
      const idx = el.parentNode.children.indexOf(el);
      if (idx === -1) return;
      replacement.parentNode = el.parentNode;
      replacement.isConnected = true;
      el.parentNode.children.splice(idx, 1, replacement);
      el.parentNode = null;
      el.isConnected = false;
    },
    focus: jest.fn(),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners.has(type)) return;
      listeners.set(
        type,
        listeners.get(type).filter((entry) => entry !== fn),
      );
    },
    dispatchEvent(event) {
      const list = listeners.get(event.type) || [];
      for (const fn of [...list]) {
        fn(event);
      }
    },
    click() {
      el.dispatchEvent({
        type: 'click',
        target: el,
        preventDefault: jest.fn(),
      });
    },
    querySelector(selector) {
      if (
        selector === '[data-progress-fill]' &&
        el.innerHTML.includes('data-progress-fill')
      ) {
        if (!el._progressFill) {
          el._progressFill = createFakeElement('div');
          el._progressFill.setAttribute('data-progress-fill', '');
        }
        return el._progressFill;
      }
      const pool = selector.startsWith(':scope > ')
        ? el.children
        : collectDescendants(el);
      return pool.find((node) => matchesSelector(node, selector)) || null;
    },
    querySelectorAll(selector) {
      return collectDescendants(el).filter((node) =>
        matchesSelector(node, selector),
      );
    },
    closest(selector) {
      let current = el;
      while (current) {
        if (matchesSelector(current, selector)) return current;
        current = current.parentNode;
      }
      return null;
    },
  };

  return el;
};

const createFakeDocument = () => {
  const listeners = new Map();
  const elementsById = new Map();
  const body = createFakeElement('body');

  const doc = {
    body,
    activeElement: null,
    title: 'Test Document',
    registerById(id, element) {
      element.id = id;
      elementsById.set(id, element);
      return element;
    },
    clear() {
      body.children = [];
      elementsById.clear();
      doc.activeElement = null;
    },
    getElementById(id) {
      if (elementsById.has(id)) return elementsById.get(id);
      return collectDescendants(body).find((node) => node.id === id) || null;
    },
    createElement(tag) {
      return createFakeElement(tag);
    },
    querySelector(selector) {
      return body.querySelector(selector);
    },
    querySelectorAll(selector) {
      return body.querySelectorAll(selector);
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners.has(type)) return;
      listeners.set(
        type,
        listeners.get(type).filter((entry) => entry !== fn),
      );
    },
    dispatchEvent(event) {
      const list = listeners.get(event.type) || [];
      for (const fn of [...list]) {
        fn(event);
      }
    },
    getDialogs() {
      return body.children.filter(
        (node) => node.getAttribute('role') === 'dialog',
      );
    },
  };

  return doc;
};

const attachClobberedActionInput = (form, hiddenActionValue) => {
  const hiddenActionInput = createFakeElement('input');
  hiddenActionInput.type = 'hidden';
  hiddenActionInput.name = 'action';
  hiddenActionInput.value = hiddenActionValue;
  form.appendChild(hiddenActionInput);

  // Simula DOM clobbering real de HTMLFormElement cuando existe <input name="action">
  Object.defineProperty(form, 'action', {
    configurable: true,
    enumerable: true,
    get: () => hiddenActionInput,
    set: () => {
      // En navegadores con propiedad sombreada, asignar form.action no reemplaza el atributo de forma fiable
    },
  });

  return hiddenActionInput;
};

const DEFAULT_CLOBBERED_FORM_OPTIONS = Object.freeze({
  id: '',
  actionAttr: '',
  method: 'POST',
  hiddenActionValue: 'request_archive',
  dataset: {},
  attributes: {},
  extraEntries: [],
  parent: null,
});

const createClobberedForm = (options = {}) => {
  const {
    id,
    actionAttr,
    method,
    hiddenActionValue,
    dataset,
    attributes,
    extraEntries,
    parent,
  } = { ...DEFAULT_CLOBBERED_FORM_OPTIONS, ...options };

  const form = createFakeElement('form');
  form.id = id;
  form.method = method;
  form.enctype = 'application/x-www-form-urlencoded';
  form.setAttribute('action', actionAttr);
  form.setAttribute('method', method);
  Object.assign(form.dataset, dataset);
  Object.entries(attributes).forEach(([k, v]) => form.setAttribute(k, v));

  const hiddenActionInput = attachClobberedActionInput(form, hiddenActionValue);

  const submitBtn = createFakeElement('button');
  submitBtn.type = 'submit';
  submitBtn.innerHTML = '<span>Enviar</span>';
  form.appendChild(submitBtn);

  form.reportValidity = jest.fn(() => true);
  form.reset = jest.fn();
  form._entries = [['action', hiddenActionValue], ...extraEntries];

  parent?.appendChild(form);
  return { form, submitBtn, hiddenActionInput };
};

const getDialogButtons = (dialog) => {
  const buttons = collectDescendants(dialog).filter(
    (node) => node.tagName === 'BUTTON',
  );
  return { cancelBtn: buttons[0], confirmBtn: buttons[1] };
};

const flushMicrotasks = async (turns = 25) => {
  for (let i = 0; i < turns; i += 1) {
    await Promise.resolve();
  }
};

class FakeFormData {
  constructor(form) {
    this._entries = Array.isArray(form?._entries)
      ? form._entries.map(([k, v]) => [String(k), String(v)])
      : [];
  }

  append(key, value) {
    this._entries.push([String(key), String(value)]);
  }

  entries() {
    return this._entries[Symbol.iterator]();
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

const stripHtmlTags = (markup) =>
  String(markup || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractFragmentById = (html, id) => {
  const openPattern = new RegExp(
    `<([a-z0-9-]+)\\b[^>]*\\bid="${id}"[^>]*>`,
    'i',
  );
  const match = openPattern.exec(html);
  if (!match) return null;

  const tag = match[1];
  const start = match.index + match[0].length;
  const tokenRe = new RegExp(`<(\\/)?${tag}\\b[^>]*>`, 'gi');
  tokenRe.lastIndex = start;

  let depth = 1;
  let innerEnd = html.length;
  let token = tokenRe.exec(html);
  while (token) {
    depth += token[1] ? -1 : 1;
    if (depth === 0) {
      innerEnd = token.index;
      break;
    }
    token = tokenRe.exec(html);
  }

  const el = createFakeElement(tag);
  el.id = id;
  el.innerHTML = html.slice(start, innerEnd);
  el.textContent = stripHtmlTags(el.innerHTML);
  return el;
};

const getToastMessages = (doc) => {
  const stack = doc.getElementById('async-toast-stack');
  if (!stack) return [];
  return collectDescendants(stack)
    .filter((node) => node.tagName === 'P')
    .map((node) => node.textContent);
};

const mountIngredientCatalogRegions = (doc) => {
  const kpi = createFakeElement('section');
  kpi.id = 'ingredients-kpi-region';
  kpi.textContent = 'KPI iniciales';

  const counter = createFakeElement('span');
  counter.id = 'ingredients-results-counter';
  counter.textContent = '2 resultado(s)';

  const results = createFakeElement('div');
  results.id = 'ingredients-results-region';
  results.textContent = 'Catálogo inicial activo';

  doc.body.append(kpi, counter, results);
  return { kpi, counter, results };
};

class FakeDOMParser {
  parseFromString(html) {
    const raw = String(html || '');
    return {
      title: '',
      body: { textContent: stripHtmlTags(raw) },
      querySelector: (selector) => {
        if (typeof selector === 'string' && selector.startsWith('#')) {
          return extractFragmentById(raw, selector.slice(1));
        }
        return null;
      },
    };
  }
}

describe('Regresiones de UI: DOM clobbering de form.action, z-index de confirmAsyncAction y doble envío', () => {
  const originals = {
    document: globalThis.document,
    window: globalThis.window,
    fetch: globalThis.fetch,
    FormData: globalThis.FormData,
    DOMParser: globalThis.DOMParser,
    IntersectionObserver: globalThis.IntersectionObserver,
  };

  let asyncUiDoc;
  let ingredientsDoc;
  let plagueDoc;
  let cropDoc;
  let fakeWindow;
  let asyncUi;
  let unhandledRejections = [];
  const onUnhandledRejection = (reason) => {
    unhandledRejections.push(reason);
  };

  beforeAll(async () => {
    fakeWindow = {
      location: {
        origin: 'http://localhost:3101',
        pathname: '/private/ingredients',
        search: '',
        href: 'http://localhost:3101/private/ingredients',
        assign: jest.fn(),
      },
      history: { replaceState: jest.fn() },
      localStorage: { getItem: () => null, setItem: () => {} },
      setTimeout: jest.fn(() => 1),
      clearTimeout: jest.fn(),
      setInterval: jest.fn(() => 1),
      clearInterval: jest.fn(),
      modalScrollLock: { lock: jest.fn(), unlock: jest.fn() },
      lucide: { createIcons: jest.fn() },
    };

    globalThis.window = fakeWindow;
    globalThis.FormData = FakeFormData;
    globalThis.DOMParser = FakeDOMParser;
    globalThis.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    };

    asyncUiDoc = createFakeDocument();
    globalThis.document = asyncUiDoc;
    asyncUi = await import('../../public/js/private/asyncUi.js');

    ingredientsDoc = createFakeDocument();
    globalThis.document = ingredientsDoc;
    await import('../../public/js/private/ingredients.js');
    ingredientsDoc.dispatchEvent({ type: 'DOMContentLoaded' });

    plagueDoc = createFakeDocument();
    globalThis.document = plagueDoc;
    await import('../../public/js/shared/plague-detail.js');
    plagueDoc.dispatchEvent({ type: 'DOMContentLoaded' });

    cropDoc = createFakeDocument();
    globalThis.document = cropDoc;
    await import('../../public/js/shared/crop-detail.js');
    cropDoc.dispatchEvent({ type: 'DOMContentLoaded' });
  });

  afterAll(() => {
    globalThis.document = originals.document;
    globalThis.window = originals.window;
    globalThis.fetch = originals.fetch;
    globalThis.FormData = originals.FormData;
    globalThis.DOMParser = originals.DOMParser;
    globalThis.IntersectionObserver = originals.IntersectionObserver;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    unhandledRejections = [];
    process.on('unhandledRejection', onUnhandledRejection);
    asyncUiDoc.clear();
    ingredientsDoc.clear();
    plagueDoc.clear();
    cropDoc.clear();
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      redirected: false,
      url: '/private/ok',
      json: async () => ({ success: true, message: 'OK' }),
      text: async () => '<html><body>OK</body></html>',
    }));
  });

  afterEach(async () => {
    await flushMicrotasks(2);
    process.off('unhandledRejection', onUnhandledRejection);
    expect(unhandledRejections).toEqual([]);
  });

  describe('1. asyncUi.js: buildFormRequest ante DOM clobbering y z-index de confirmAsyncAction', () => {
    beforeEach(() => {
      globalThis.document = asyncUiDoc;
    });

    it('buildFormRequest lee getAttribute("action") incluso cuando <input name="action"> sombrea form.action', () => {
      const { form, hiddenActionInput } = createClobberedForm({
        actionAttr: '/private/products/42/workflow',
        method: 'POST',
        hiddenActionValue: 'request_archive',
        extraEntries: [['archive_reason', 'Prohibición regulatoria vigente']],
      });

      expect(form.action).toBe(hiddenActionInput);
      const { url, init } = asyncUi.buildFormRequest(form);

      expect(url).toBe('/private/products/42/workflow');
      expect(init.method).toBe('POST');
      expect(init.body.toString()).toContain('action=request_archive');
    });

    it('confirmAsyncAction renderiza el diálogo con z-[250] y style.zIndex="250" por encima de modales z-100/z-[200]/z-[220]', async () => {
      const promise = asyncUi.confirmAsyncAction({
        title: 'Confirmar operación',
        description: 'Verificar visibilidad por encima de otros modales.',
        confirmLabel: 'Confirmar',
        variant: 'danger',
      });

      const dialogs = asyncUiDoc.getDialogs();
      expect(dialogs).toHaveLength(1);

      const dialog = dialogs[0];
      expect(dialog.className).toContain('z-[250]');
      expect(dialog.className).not.toContain('z-[90]');
      expect(dialog.style.zIndex).toBe('250');
      expect(Number(dialog.style.zIndex)).toBeGreaterThan(220);

      const { confirmBtn } = getDialogButtons(dialog);
      confirmBtn.click();

      await expect(promise).resolves.toBe(true);
      expect(asyncUiDoc.getDialogs()).toHaveLength(0);
    });
  });

  describe('2. ingredients.js: DOM clobbering en modal/workflow/delete y bloqueo de doble envío', () => {
    beforeEach(() => {
      globalThis.document = ingredientsDoc;
    });

    it('openIngredientArchiveModal usa setAttribute("action", ...) para evitar DOM clobbering', () => {
      const modal = createFakeElement('div');
      modal.className = 'fixed inset-0 z-100 hidden';
      ingredientsDoc.registerById('modal-request-archive-ingredient', modal);

      const { form } = createClobberedForm({
        id: 'form-request-archive-ingredient',
        actionAttr: '',
        hiddenActionValue: 'request_archive',
      });
      ingredientsDoc.registerById('form-request-archive-ingredient', form);

      const triggerBtn = createFakeElement('button');
      triggerBtn.setAttribute('data-request-archive-ingredient', '');
      triggerBtn.dataset.id = '88';

      ingredientsDoc.dispatchEvent({
        type: 'click',
        target: triggerBtn,
        preventDefault: jest.fn(),
      });

      expect(form.getAttribute('action')).toBe(
        '/private/ingredients/88/workflow',
      );
      expect(modal.classList.contains('hidden')).toBe(false);
      expect(modal.classList.contains('flex')).toBe(true);
    });

    it('handleRequestArchiveFormSubmit usa getAttribute("action") en fetch al confirmar', async () => {
      const modal = createFakeElement('div');
      modal.className = 'fixed inset-0 z-100 flex';
      ingredientsDoc.registerById('modal-request-archive-ingredient', modal);

      const { form } = createClobberedForm({
        id: 'form-request-archive-ingredient',
        actionAttr: '/private/ingredients/88/workflow',
        hiddenActionValue: 'request_archive',
        extraEntries: [
          ['archive_reason_category', 'cambio_normativo'],
          [
            'archive_reason',
            'Justificación técnica suficiente de más de 20 caracteres',
          ],
        ],
      });
      ingredientsDoc.body.appendChild(form);

      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });

      const dialogs = ingredientsDoc.getDialogs();
      expect(dialogs).toHaveLength(1);
      getDialogButtons(dialogs[0]).confirmBtn.click();
      await flushMicrotasks();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/private/ingredients/88/workflow',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('handleRequestArchiveFormSubmit bloquea clics repetidos antes de confirmAsyncAction y restaura estado al cancelar', async () => {
      const { form, submitBtn } = createClobberedForm({
        id: 'form-request-archive-ingredient',
        actionAttr: '/private/ingredients/91/workflow',
        hiddenActionValue: 'request_archive',
      });
      ingredientsDoc.body.appendChild(form);

      // Primer envío: bloquea formulario y botón inmediatamente
      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });

      expect(form.dataset.submitting).toBe('true');
      expect(submitBtn.disabled).toBe(true);
      expect(ingredientsDoc.getDialogs()).toHaveLength(1);

      // Segundo envío inmediato (doble clic): ignorado sin abrir un segundo modal
      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });

      expect(ingredientsDoc.getDialogs()).toHaveLength(1);

      // Cancelar el modal restaura el formulario y el botón para futuros envíos
      getDialogButtons(ingredientsDoc.getDialogs()[0]).cancelBtn.click();
      await flushMicrotasks();

      expect(form.dataset.submitting).toBeUndefined();
      expect(submitBtn.disabled).toBe(false);
      expect(globalThis.fetch).not.toHaveBeenCalled();

      // Tercer envío tras cancelar vuelve a funcionar normalmente
      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });
      expect(ingredientsDoc.getDialogs()).toHaveLength(1);
      expect(form.dataset.submitting).toBe('true');
      expect(submitBtn.disabled).toBe(true);

      getDialogButtons(ingredientsDoc.getDialogs()[0]).cancelBtn.click();
      await flushMicrotasks();
      expect(form.dataset.submitting).toBeUndefined();
      expect(submitBtn.disabled).toBe(false);
    });

    it('handleWorkflowIngredientSubmit usa getAttribute("action") y bloquea doble modal', async () => {
      const { form, submitBtn } = createClobberedForm({
        actionAttr: '/private/ingredients/55/workflow',
        hiddenActionValue: 'approve_archive',
        dataset: {
          ingredientName: 'Glifosato',
          ingredientAction: 'approve_archive',
        },
        attributes: { 'data-workflow-ingredient-form': '' },
      });
      ingredientsDoc.body.appendChild(form);

      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });
      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });

      expect(ingredientsDoc.getDialogs()).toHaveLength(1);
      expect(submitBtn.disabled).toBe(true);

      getDialogButtons(ingredientsDoc.getDialogs()[0]).confirmBtn.click();
      await flushMicrotasks();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/private/ingredients/55/workflow',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(form.dataset.submitting).toBeUndefined();
      expect(submitBtn.disabled).toBe(false);
    });

    it('handleDeleteIngredientSubmit usa getAttribute("action") y bloquea doble modal', async () => {
      const { form, submitBtn } = createClobberedForm({
        actionAttr: '/private/ingredients/delete/55',
        hiddenActionValue: 'delete',
        dataset: { ingredientName: 'Paraquat' },
        attributes: { 'data-delete-ingredient-form': '' },
      });
      ingredientsDoc.body.appendChild(form);

      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });
      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });

      expect(ingredientsDoc.getDialogs()).toHaveLength(1);
      expect(submitBtn.disabled).toBe(true);

      getDialogButtons(ingredientsDoc.getDialogs()[0]).confirmBtn.click();
      await flushMicrotasks();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/private/ingredients/delete/55',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(form.dataset.submitting).toBeUndefined();
      expect(submitBtn.disabled).toBe(false);
    });
  });

  describe('3. plague-detail.js: formularios editoriales inmunes a DOM clobbering', () => {
    beforeEach(() => {
      globalThis.document = plagueDoc;
    });

    it('confirmEditorialFormSubmission y submitEditorialFormAsync operan sin TypeError cuando existe <input name="action">', async () => {
      const panel = createFakeElement('div');
      panel.id = 'private-editorial-panel';
      plagueDoc.body.appendChild(panel);

      const { form, submitBtn } = createClobberedForm({
        actionAttr: '/private/plagues/15/workflow',
        hiddenActionValue: 'submit_review',
        parent: panel,
      });

      const preventDefault = jest.fn();
      plagueDoc.dispatchEvent({
        type: 'submit',
        target: form,
        submitter: submitBtn,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      const dialogs = plagueDoc.getDialogs();
      expect(dialogs).toHaveLength(1);

      getDialogButtons(dialogs[0]).confirmBtn.click();
      await flushMicrotasks();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/private/plagues/15/workflow',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('detecta formularios /relations vía getAttribute("action") incluso con <input name="action">', async () => {
      const panel = createFakeElement('div');
      panel.id = 'private-editorial-panel';
      plagueDoc.body.appendChild(panel);

      const { form, submitBtn } = createClobberedForm({
        actionAttr: '/private/plagues/15/relations',
        hiddenActionValue: 'save_relations',
        parent: panel,
      });

      plagueDoc.dispatchEvent({
        type: 'submit',
        target: form,
        submitter: submitBtn,
        preventDefault: jest.fn(),
      });

      const dialogs = plagueDoc.getDialogs();
      expect(dialogs).toHaveLength(1);
      const heading = collectDescendants(dialogs[0]).find(
        (node) => node.id === 'confirm-dialog-title',
      );
      expect(heading?.textContent).toContain('relaciones técnicas');

      getDialogButtons(dialogs[0]).confirmBtn.click();
      await flushMicrotasks();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/private/plagues/15/relations',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('4. crop-detail.js: initCropWorkflowForms inmune a DOM clobbering', () => {
    beforeEach(() => {
      globalThis.document = cropDoc;
    });

    it('intercepta y envía formulario workflow con <input name="action"> usando getAttribute("action")', async () => {
      const panel = createFakeElement('div');
      panel.id = 'private-editorial-panel';
      cropDoc.body.appendChild(panel);

      const { form, submitBtn } = createClobberedForm({
        actionAttr: '/private/crops/23/workflow',
        hiddenActionValue: 'submit_review',
        parent: panel,
      });

      const preventDefault = jest.fn();
      cropDoc.dispatchEvent({
        type: 'submit',
        target: form,
        submitter: submitBtn,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      const dialogs = cropDoc.getDialogs();
      expect(dialogs).toHaveLength(1);

      getDialogButtons(dialogs[0]).confirmBtn.click();
      await flushMicrotasks();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/private/crops/23/workflow',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('ignora formularios de /relations dentro de #private-editorial-panel', () => {
      const panel = createFakeElement('div');
      panel.id = 'private-editorial-panel';
      cropDoc.body.appendChild(panel);

      const { form, submitBtn } = createClobberedForm({
        actionAttr: '/private/crops/23/relations',
        hiddenActionValue: 'save_relations',
        parent: panel,
      });

      const preventDefault = jest.fn();
      cropDoc.dispatchEvent({
        type: 'submit',
        target: form,
        submitter: submitBtn,
        preventDefault,
      });

      expect(preventDefault).not.toHaveBeenCalled();
      expect(cropDoc.getDialogs()).toHaveLength(0);
    });
  });

  describe('5. ingredients.js: refresco AJAX en refreshIngredientsRegion y reset tras request_archive', () => {
    beforeEach(() => {
      globalThis.document = ingredientsDoc;
    });

    it('tras confirmar request_archive, inyecta result.doc con "Baja en trámite", resetea el formulario y no muestra toast de error', async () => {
      mountIngredientCatalogRegions(ingredientsDoc);

      const modal = createFakeElement('div');
      modal.className = 'fixed inset-0 z-100 flex';
      ingredientsDoc.registerById('modal-request-archive-ingredient', modal);

      const { form } = createClobberedForm({
        id: 'form-request-archive-ingredient',
        actionAttr: '/private/ingredients/88/workflow',
        hiddenActionValue: 'request_archive',
        extraEntries: [
          ['archive_reason_category', 'cambio_normativo'],
          [
            'archive_reason',
            'Justificación técnica suficiente de más de 20 caracteres',
          ],
        ],
      });
      ingredientsDoc.body.appendChild(form);

      const updatedCatalogHtml = `
        <html><body>
          <section id="ingredients-kpi-region">KPI actualizados</section>
          <span id="ingredients-results-counter">2 resultado(s) actualizados</span>
          <div id="ingredients-results-region">
            <div id="ingredients-grid-view">
              <article>
                <span>Glifosato</span>
                <span>Baja en trámite</span>
              </article>
            </div>
          </div>
        </body></html>
      `;

      globalThis.fetch = jest.fn(async (url, init = {}) => {
        if (init.method === 'POST') {
          return {
            ok: true,
            status: 200,
            redirected: false,
            url,
            json: async () => ({
              success: true,
              message: 'Solicitud de baja tramitada.',
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          redirected: false,
          url: 'http://localhost:3101/private/ingredients',
          text: async () => updatedCatalogHtml,
        };
      });

      ingredientsDoc.dispatchEvent({
        type: 'submit',
        target: form,
        preventDefault: jest.fn(),
      });

      const dialogs = ingredientsDoc.getDialogs();
      expect(dialogs).toHaveLength(1);
      getDialogButtons(dialogs[0]).confirmBtn.click();
      await flushMicrotasks();

      expect(globalThis.fetch).toHaveBeenNthCalledWith(
        1,
        '/private/ingredients/88/workflow',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(globalThis.fetch).toHaveBeenNthCalledWith(
        2,
        '/private/ingredients',
        expect.objectContaining({ credentials: 'same-origin' }),
      );

      expect(
        ingredientsDoc.querySelector('#ingredients-results-region')
          ?.textContent,
      ).toContain('Baja en trámite');
      expect(
        ingredientsDoc.querySelector('#ingredients-kpi-region')?.textContent,
      ).toContain('KPI actualizados');
      expect(
        ingredientsDoc.querySelector('#ingredients-results-counter')
          ?.textContent,
      ).toContain('2 resultado(s) actualizados');

      expect(form.reset).toHaveBeenCalledTimes(1);
      expect(modal.classList.contains('hidden')).toBe(true);
      expect(modal.classList.contains('flex')).toBe(false);
      expect(fakeWindow.lucide.createIcons).toHaveBeenCalled();
      expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();

      const toasts = getToastMessages(ingredientsDoc);
      expect(toasts).toContain('Solicitud de baja tramitada.');
      expect(toasts).not.toContain('No se pudo actualizar el catálogo.');
      expect(
        ingredientsDoc
          .querySelector('#ingredients-results-region')
          ?.getAttribute('aria-busy'),
      ).toBeNull();
    });

    it('refreshIngredientsRegion muestra el error de fetchHtmlDocument cuando ok=false y aborted=false sin romper swapFragments ni history', async () => {
      mountIngredientCatalogRegions(ingredientsDoc);

      const pageLink = createFakeElement('a');
      pageLink.setAttribute('data-ingredients-page', '2');
      pageLink.setAttribute('href', '/private/ingredients?page=2');
      ingredientsDoc.body.appendChild(pageLink);

      globalThis.fetch = jest.fn(async () => ({
        ok: false,
        status: 500,
        redirected: false,
        url: 'http://localhost:3101/private/ingredients?page=2',
        text: async () => 'Error temporal en el catálogo químico',
      }));

      ingredientsDoc.dispatchEvent({
        type: 'click',
        target: pageLink,
        preventDefault: jest.fn(),
      });
      await flushMicrotasks();

      const toasts = getToastMessages(ingredientsDoc);
      expect(toasts).toContain('Error temporal en el catálogo químico');
      expect(toasts).not.toContain('No se pudo actualizar el catálogo.');
      expect(
        ingredientsDoc.querySelector('#ingredients-results-region')
          ?.textContent,
      ).toBe('Catálogo inicial activo');
      expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
      expect(
        ingredientsDoc
          .querySelector('#ingredients-results-region')
          ?.getAttribute('aria-busy'),
      ).toBeNull();
    });

    it('refreshIngredientsRegion es silencioso cuando fetchHtmlDocument devuelve aborted=true', async () => {
      mountIngredientCatalogRegions(ingredientsDoc);

      const pageLink = createFakeElement('a');
      pageLink.setAttribute('data-ingredients-page', '3');
      pageLink.setAttribute('href', '/private/ingredients?page=3');
      ingredientsDoc.body.appendChild(pageLink);

      const abortErr = Object.assign(new Error('Aborted'), {
        name: 'AbortError',
      });
      globalThis.fetch = jest.fn(async () => {
        throw abortErr;
      });

      ingredientsDoc.dispatchEvent({
        type: 'click',
        target: pageLink,
        preventDefault: jest.fn(),
      });
      await flushMicrotasks();

      expect(getToastMessages(ingredientsDoc)).toEqual([]);
      expect(
        ingredientsDoc.querySelector('#ingredients-results-region')
          ?.textContent,
      ).toBe('Catálogo inicial activo');
      expect(fakeWindow.history.replaceState).not.toHaveBeenCalled();
      expect(
        ingredientsDoc
          .querySelector('#ingredients-results-region')
          ?.getAttribute('aria-busy'),
      ).toBeNull();
    });

    it('refreshIngredientsRegion actualiza DOM e historial en navegación paginada exitosa', async () => {
      mountIngredientCatalogRegions(ingredientsDoc);

      const pageLink = createFakeElement('a');
      pageLink.setAttribute('data-ingredients-page', '2');
      pageLink.setAttribute('href', '/private/ingredients?page=2');
      ingredientsDoc.body.appendChild(pageLink);

      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        redirected: false,
        url: 'http://localhost:3101/private/ingredients?page=2',
        text: async () =>
          '<div id="ingredients-results-region">Página 2 cargada</div>',
      }));

      ingredientsDoc.dispatchEvent({
        type: 'click',
        target: pageLink,
        preventDefault: jest.fn(),
      });
      await flushMicrotasks();

      expect(
        ingredientsDoc.querySelector('#ingredients-results-region')
          ?.textContent,
      ).toBe('Página 2 cargada');
      expect(fakeWindow.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/private/ingredients?page=2',
      );
      expect(getToastMessages(ingredientsDoc)).toEqual([]);
    });
  });
});

describe('6. Parciales grid.hbs y table.hbs: botones explícitos del flujo dual y principio de 4 ojos', () => {
  const partialTemplates = [
    {
      name: 'grid.hbs',
      render: hbs.handlebars.compile(
        fs.readFileSync(
          path.resolve('src/views/partials/private/ingredients/grid.hbs'),
          'utf8',
        ),
      ),
    },
    {
      name: 'table.hbs',
      render: hbs.handlebars.compile(
        fs.readFileSync(
          path.resolve('src/views/partials/private/ingredients/table.hbs'),
          'utf8',
        ),
      ),
    },
  ];

  const baseIngredient = {
    id: 42,
    name: 'Glifosato',
    chemical_group: 'Glicinas',
    action_type: 'herbicida',
    toxicological_category: 'clase-iii',
  };

  it.each(partialTemplates)(
    '$name renderiza etiqueta visible "Solicitar baja" en estado active para especialistas/admin',
    ({ render }) => {
      const item = serializeIngredient(
        { ...baseIngredient, workflow_status: 'active' },
        { id: 5, role: 'inifap' },
      );
      const html = render({ ingredients: [item], canManage: false });

      expect(html).toMatch(
        /<button\b[^>]*data-request-archive-ingredient[^>]*>[\s\S]*?data-lucide="shield-alert"[\s\S]*?Solicitar baja[\s\S]*?<\/button>/i,
      );
      expect(html).toContain('data-id="42"');
      expect(html).toContain('data-name="Glifosato"');
      expect(html).toContain('title="Solicitar baja justificada"');
      expect(html).toContain('aria-label="Solicitar baja de Glifosato"');
      expect(html).not.toContain('Aprobar baja');
      expect(html).not.toContain('Rechazar baja');
      expect(html).not.toContain('Restaurar');
    },
  );

  it.each(partialTemplates)(
    '$name renderiza "Aprobar baja" y "Rechazar baja" visibles en archive_pending para un segundo evaluador (4 ojos)',
    ({ render }) => {
      const item = serializeIngredient(
        {
          ...baseIngredient,
          workflow_status: 'archive_pending',
          archive_requested_by_user_id: 5,
          archive_reason: 'Restricción regulatoria vigente.',
        },
        { id: 9, role: 'admin' },
      );
      const html = render({ ingredients: [item], canManage: true });

      expect(html).toContain('Baja en trámite');
      expect(html).toMatch(
        /<form\b[^>]*data-workflow-ingredient-form[^>]*data-ingredient-action="approve_archive"[^>]*data-ingredient-name="Glifosato"[^>]*>[\s\S]*?<button\b[^>]*title="Aprobar dictamen de baja \(Dual Approval\)"[^>]*aria-label="Aprobar baja de Glifosato"[^>]*>[\s\S]*?data-lucide="check-circle-2"[\s\S]*?Aprobar baja[\s\S]*?<\/button>[\s\S]*?<\/form>/i,
      );
      expect(html).toMatch(
        /<form\b[^>]*data-workflow-ingredient-form[^>]*data-ingredient-action="reject_archive"[^>]*data-ingredient-name="Glifosato"[^>]*>[\s\S]*?<button\b[^>]*title="Rechazar solicitud de baja"[^>]*aria-label="Rechazar baja de Glifosato"[^>]*>[\s\S]*?data-lucide="x-circle"[\s\S]*?Rechazar baja[\s\S]*?<\/button>[\s\S]*?<\/form>/i,
      );
      expect(html).not.toContain('Solicitar baja');
      expect(html).not.toContain('Restaurar');
    },
  );

  it.each(partialTemplates)(
    '$name oculta "Aprobar baja" y "Rechazar baja" al mismo solicitante en archive_pending (regla 4 ojos)',
    ({ render }) => {
      const item = serializeIngredient(
        {
          ...baseIngredient,
          workflow_status: 'archive_pending',
          archive_requested_by_user_id: 5,
          archive_reason: 'Restricción regulatoria vigente.',
        },
        { id: 5, role: 'inifap' },
      );
      const html = render({ ingredients: [item], canManage: false });

      expect(html).toContain('Baja en trámite');
      expect(html).not.toContain('data-ingredient-action="approve_archive"');
      expect(html).not.toContain('data-ingredient-action="reject_archive"');
      expect(html).not.toContain('Aprobar baja');
      expect(html).not.toContain('Rechazar baja');
      expect(html).not.toContain('Solicitar baja');
      expect(html).not.toContain('Restaurar');
    },
  );

  it.each(partialTemplates)(
    '$name renderiza etiqueta visible "Restaurar" en archived solo para admin y la oculta para inifap',
    ({ render }) => {
      const archivedRaw = {
        ...baseIngredient,
        workflow_status: 'archived',
      };

      const adminHtml = render({
        ingredients: [
          serializeIngredient(archivedRaw, { id: 1, role: 'admin' }),
        ],
        canManage: true,
      });
      expect(adminHtml).toContain('Archivado');
      expect(adminHtml).toMatch(
        /<form\b[^>]*data-workflow-ingredient-form[^>]*data-ingredient-action="restore"[^>]*data-ingredient-name="Glifosato"[^>]*>[\s\S]*?<button\b[^>]*title="Restaurar a activo"[^>]*aria-label="Restaurar Glifosato"[^>]*>[\s\S]*?data-lucide="rotate-ccw"[\s\S]*?Restaurar[\s\S]*?<\/button>[\s\S]*?<\/form>/i,
      );
      expect(adminHtml).not.toContain('Solicitar baja');
      expect(adminHtml).not.toContain('Aprobar baja');
      expect(adminHtml).not.toContain('Rechazar baja');

      const inifapHtml = render({
        ingredients: [
          serializeIngredient(archivedRaw, { id: 5, role: 'inifap' }),
        ],
        canManage: false,
      });
      expect(inifapHtml).toContain('Archivado');
      expect(inifapHtml).not.toContain('data-ingredient-action="restore"');
      expect(inifapHtml).not.toContain('Restaurar');
    },
  );
});
