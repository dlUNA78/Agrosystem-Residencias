import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import hbs from 'express-hbs';

const VIEW_ROOT = path.resolve('src/views/private/admin/suppliers.hbs');
const PARTIALS_DIR = path.resolve('src/views/partials/private/suppliers');
const CLIENT_JS_DIR = path.resolve('public/js/private/suppliers');
const CLIENT_JS_MAIN = path.resolve('public/js/private/suppliers.js');

const readView = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('pruebas estructurales del módulo privado de proveedores', () => {
  const mainTemplate = readView(VIEW_ROOT);
  const formModalTemplate = readView(path.join(PARTIALS_DIR, 'form-modal.hbs'));
  const tableTemplate = readView(path.join(PARTIALS_DIR, 'table.hbs'));
  const gridTemplate = readView(path.join(PARTIALS_DIR, 'grid.hbs'));
  const deleteModalTemplate = readView(
    path.join(PARTIALS_DIR, 'delete-modal.hbs'),
  );
  const formCompanyTemplate = readView(
    path.join(PARTIALS_DIR, 'form-company.hbs'),
  );
  const formContactTemplate = readView(
    path.join(PARTIALS_DIR, 'form-contact.hbs'),
  );
  const formLocationTemplate = readView(
    path.join(PARTIALS_DIR, 'form-location.hbs'),
  );
  const formCommercialTemplate = readView(
    path.join(PARTIALS_DIR, 'form-commercial.hbs'),
  );

  const allTemplates = [
    { name: 'suppliers.hbs', content: mainTemplate },
    { name: 'table.hbs', content: tableTemplate },
    { name: 'grid.hbs', content: gridTemplate },
    { name: 'form-modal.hbs', content: formModalTemplate },
    { name: 'delete-modal.hbs', content: deleteModalTemplate },
    { name: 'form-company.hbs', content: formCompanyTemplate },
    { name: 'form-contact.hbs', content: formContactTemplate },
    { name: 'form-location.hbs', content: formLocationTemplate },
    { name: 'form-commercial.hbs', content: formCommercialTemplate },
  ];

  describe('inclusión correcta de parciales y compilación', () => {
    it('la vista principal incluye todos los parciales requeridos', () => {
      expect(mainTemplate).toContain('{{> private/search-bar}}');
      expect(mainTemplate).toContain('{{> private/suppliers/table}}');
      expect(mainTemplate).toContain('{{> private/suppliers/grid}}');
      expect(mainTemplate).toContain('{{> private/suppliers/form-modal}}');
      expect(mainTemplate).toContain('{{> private/suppliers/delete-modal}}');
    });

    it('el modal de formulario incluye las 4 secciones modulares', () => {
      expect(formModalTemplate).toContain(
        '{{> private/suppliers/form-company}}',
      );
      expect(formModalTemplate).toContain(
        '{{> private/suppliers/form-contact}}',
      );
      expect(formModalTemplate).toContain(
        '{{> private/suppliers/form-location}}',
      );
      expect(formModalTemplate).toContain(
        '{{> private/suppliers/form-commercial}}',
      );
    });

    it('todas las plantillas y parciales compilan sin errores de sintaxis en Handlebars', () => {
      allTemplates.forEach(({ content }) => {
        expect(() => hbs.handlebars.compile(content)).not.toThrow();
        expect(content.length).toBeGreaterThan(0);
      });
    });

    it('ningún parcial supera las 500 líneas recomendadas en RULES.MD', () => {
      allTemplates.forEach(({ content }) => {
        const lineCount = content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('ausencia de scripts y eventos inline', () => {
    it('ningún parcial contiene etiquetas <script>', () => {
      const partialTemplates = allTemplates.filter(
        (t) => t.name !== 'suppliers.hbs',
      );
      partialTemplates.forEach(({ content }) => {
        expect(content).not.toMatch(/<script\b/i);
      });
    });

    it('la vista principal solo incluye la etiqueta <script type="module"> externa', () => {
      const scriptMatches =
        mainTemplate.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
      expect(scriptMatches).toHaveLength(1);
      expect(scriptMatches[0]).toMatch(
        /<script\s+type="module"\s+src="\/js\/private\/suppliers\.js"><\/script>/,
      );
      expect(scriptMatches[0]).not.toMatch(/<script[^>]*>[\s\S]+<\/script>/); // sin código inline
    });

    it('ninguna plantilla o parcial contiene manejadores de eventos inline (onclick, onchange, onerror, etc.)', () => {
      allTemplates.forEach(({ content }) => {
        expect(content).not.toMatch(/\bon[a-z]+\s*=/i);
      });
    });

    it('ninguna plantilla o parcial contiene atributos style estáticos', () => {
      allTemplates.forEach(({ content }) => {
        expect(content).not.toMatch(/\bstyle\s*=\s*["']/i);
      });
    });
  });

  describe('importación e inicialización de todos los módulos JavaScript', () => {
    const mainJs = fs.readFileSync(CLIENT_JS_MAIN, 'utf8');
    const viewToggleJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'supplierViewToggle.js'),
      'utf8',
    );
    const searchJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'supplierSearch.js'),
      'utf8',
    );
    const formJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'supplierForm.js'),
      'utf8',
    );
    const deleteJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'supplierDelete.js'),
      'utf8',
    );

    it('el punto de entrada suppliers.js importa e inicializa todas las funciones en DOMContentLoaded', () => {
      expect(mainJs).toContain(
        "import { initializeSupplierDelete } from './suppliers/supplierDelete.js';",
      );
      expect(mainJs).toContain(
        "import { initializeSupplierForm } from './suppliers/supplierForm.js';",
      );
      expect(mainJs).toContain(
        "import { initializeSupplierSearch } from './suppliers/supplierSearch.js';",
      );
      expect(mainJs).toContain(
        "import { initializeSupplierViewToggle } from './suppliers/supplierViewToggle.js';",
      );
      expect(mainJs).toMatch(
        /document\.addEventListener\(\s*['"]DOMContentLoaded['"]/,
      );
      expect(mainJs).toContain('initializeSupplierViewToggle();');
      expect(mainJs).toContain('initializeSupplierForm();');
      expect(mainJs).toContain('initializeSupplierDelete();');
      expect(mainJs).toContain('initializeSupplierSearch();');
    });

    it('supplierViewToggle.js y supplierSearch.js no usan style.display y utilizan la clase hidden', () => {
      expect(viewToggleJs).not.toContain('.style.display');
      expect(viewToggleJs).toContain("classList.add('hidden')");
      expect(viewToggleJs).toContain("classList.remove('hidden')");

      expect(searchJs).not.toContain('.style.display');
      expect(searchJs).toContain("classList.toggle('hidden'");
    });

    it('supplierForm.js y supplierDelete.js exportan sus inicializadores modulares', () => {
      expect(formJs).toContain('export const initializeSupplierForm =');
      expect(deleteJs).toContain('export const initializeSupplierDelete =');
    });
  });

  describe('conservación de atributos usados para editar y eliminar proveedores', () => {
    const requiredEditDataAttributes = [
      'data-id',
      'data-name',
      'data-commercial-name',
      'data-rfc',
      'data-supply-type',
      'data-contact-name',
      'data-contact-position',
      'data-email',
      'data-alternative-email',
      'data-phone',
      'data-alternative-phone',
      'data-address',
      'data-city',
      'data-state',
      'data-postal-code',
      'data-country',
      'data-supplied-products',
      'data-brands',
      'data-delivery-time',
      'data-minimum-order',
      'data-payment-method',
      'data-status',
    ];

    it('la tabla conserva todos los data attributes requeridos para edición', () => {
      requiredEditDataAttributes.forEach((attr) => {
        expect(tableTemplate).toContain(`${attr}=`);
      });
      expect(tableTemplate).toContain('data-id="{{id}}"');
      expect(tableTemplate).toContain('data-name="{{name}}"');
    });

    it('la cuadrícula conserva todos los data attributes requeridos para edición', () => {
      requiredEditDataAttributes.forEach((attr) => {
        expect(gridTemplate).toContain(`${attr}=`);
      });
      expect(gridTemplate).toContain('data-id="{{id}}"');
      expect(gridTemplate).toContain('data-name="{{name}}"');
    });

    it('los parciales del formulario conservan todos los IDs de campo vinculados con el controlador y JS', () => {
      const allFormContent = `${formCompanyTemplate}\n${formContactTemplate}\n${formLocationTemplate}\n${formCommercialTemplate}`;
      const expectedFieldIds = [
        'supplier-name',
        'supplier-commercial-name',
        'supplier-rfc',
        'supplier-supply-type',
        'supplier-contact-name',
        'supplier-contact-position',
        'supplier-email',
        'supplier-alternative-email',
        'supplier-phone',
        'supplier-alternative-phone',
        'supplier-address',
        'supplier-city',
        'supplier-state',
        'supplier-postal-code',
        'supplier-country',
        'supplier-supplied-products',
        'supplier-brands',
        'supplier-delivery-time',
        'supplier-minimum-order',
        'supplier-payment-method',
        'supplier-status',
      ];

      expectedFieldIds.forEach((fieldId) => {
        expect(allFormContent).toContain(`id="${fieldId}"`);
      });
    });

    it('los modales conservan los IDs de control e interacción', () => {
      expect(formModalTemplate).toContain('id="modal-supplier"');
      expect(formModalTemplate).toContain('id="form-supplier"');
      expect(formModalTemplate).toContain('id="supplier-modal-title"');
      expect(formModalTemplate).toContain('id="btn-close-modal-supplier"');
      expect(formModalTemplate).toContain('id="btn-cancel-modal-supplier"');

      expect(deleteModalTemplate).toContain('id="modal-delete-supplier"');
      expect(deleteModalTemplate).toContain('id="delete-supplier-name"');
      expect(deleteModalTemplate).toContain('id="form-delete-supplier"');
      expect(deleteModalTemplate).toContain('id="btn-close-delete-supplier"');
      expect(deleteModalTemplate).toContain('id="btn-cancel-delete-supplier"');
    });
  });
});
