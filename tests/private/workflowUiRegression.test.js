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

class FakeDOMParser {
  parseFromString(html) {
    return {
      title: '',
      body: { textContent: String(html || '') },
      querySelector: () => null,
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
});
