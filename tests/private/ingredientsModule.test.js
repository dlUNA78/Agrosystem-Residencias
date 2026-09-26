import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import hbs from 'express-hbs';
import { ingredientsPrivate } from '../../src/controllers/private/ingredientsController.js';

const VIEW_ROOT = path.resolve('src/views/private/catalog/ingredients.hbs');
const PARTIALS_DIR = path.resolve('src/views/partials/private/ingredients');
const CLIENT_JS_DIR = path.resolve('public/js/private/ingredients');
const CLIENT_JS_MAIN = path.resolve('public/js/private/ingredients.js');

const readView = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('módulo privado de ingredientes activos', () => {
  describe('controlador ingredientsPrivate', () => {
    it('renderiza la vista correcta con los parámetros y filtros requeridos', () => {
      const req = {};
      const res = {
        render: jest.fn(),
      };

      ingredientsPrivate(req, res);

      expect(res.render).toHaveBeenCalledTimes(1);
      const [viewPath, renderData] = res.render.mock.calls[0];

      expect(viewPath).toBe('private/catalog/ingredients');
      expect(renderData.pageTitle).toBe('Ingredientes Activos');
      expect(renderData.activePage).toBe('ingredients');
      expect(renderData.searchId).toBe('ingredient-search');
      expect(renderData.ctaBtnId).toBe('btn-add-ingredient');
      expect(renderData.ctaLabel).toBe('Añadir Ingrediente');
      expect(renderData.showViewToggle).toBe(true);

      const filterIds = renderData.searchFilters.map((f) => f.id);
      expect(filterIds).toContain('filter-tipo');
      expect(filterIds).toContain('filter-toxicidad');
      expect(filterIds).toContain('filter-status');
    });
  });

  describe('pruebas estructurales de plantillas Handlebars', () => {
    const mainTemplate = readView(VIEW_ROOT);
    const tableTemplate = readView(path.join(PARTIALS_DIR, 'table.hbs'));
    const gridTemplate = readView(path.join(PARTIALS_DIR, 'grid.hbs'));
    const formModalTemplate = readView(
      path.join(PARTIALS_DIR, 'form-modal.hbs'),
    );

    const allTemplates = [
      { name: 'ingredients.hbs', content: mainTemplate },
      { name: 'table.hbs', content: tableTemplate },
      { name: 'grid.hbs', content: gridTemplate },
      { name: 'form-modal.hbs', content: formModalTemplate },
    ];

    it('la vista principal incluye la barra de búsqueda y los tres parciales modulares', () => {
      expect(mainTemplate).toContain('{{> private/search-bar}}');
      expect(mainTemplate).toContain('{{> private/ingredients/table}}');
      expect(mainTemplate).toContain('{{> private/ingredients/grid}}');
      expect(mainTemplate).toContain('{{> private/ingredients/form-modal}}');
    });

    it('la vista principal conserva el diseño exterior original y los cuatro indicadores y valores demostrativos', () => {
      expect(mainTemplate).toContain(
        '<main class="min-h-screen flex flex-col">',
      );
      expect(mainTemplate).toContain('<div class="mt-20 p-12 space-y-10">');
      expect(mainTemplate).toContain('>Total</p>');
      expect(mainTemplate).toContain('>312</p>');
      expect(mainTemplate).toContain('>Aprobados</p>');
      expect(mainTemplate).toContain('>278</p>');
      expect(mainTemplate).toContain('>Pendientes</p>');
      expect(mainTemplate).toContain('>21</p>');
      expect(mainTemplate).toContain('>Restringidos</p>');
      expect(mainTemplate).toContain('>13</p>');
    });

    it('todas las plantillas y parciales compilan sin errores de sintaxis en Handlebars', () => {
      allTemplates.forEach(({ content }) => {
        expect(() => hbs.handlebars.compile(content)).not.toThrow();
        expect(content.length).toBeGreaterThan(0);
      });
    });

    it('ninguna plantilla o parcial supera las 500 líneas recomendadas en RULES.MD', () => {
      allTemplates.forEach(({ content }) => {
        const lineCount = content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(500);
      });
    });

    it('ningún parcial contiene etiquetas <script>', () => {
      const partials = allTemplates.filter((t) => t.name !== 'ingredients.hbs');
      partials.forEach(({ content }) => {
        expect(content).not.toMatch(/<script\b/i);
      });
    });

    it('la vista principal sólo incluye la etiqueta de script modular externa', () => {
      const scriptMatches =
        mainTemplate.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
      expect(scriptMatches).toHaveLength(1);
      expect(scriptMatches[0]).toMatch(
        /<script\s+type="module"\s+src="\/js\/private\/ingredients\.js"><\/script>/,
      );
      expect(scriptMatches[0]).not.toMatch(/<script[^>]*>[\s\S]+<\/script>/);
    });

    it('ninguna plantilla o parcial contiene manejadores de eventos inline', () => {
      allTemplates.forEach(({ content }) => {
        expect(content).not.toMatch(/\bon[a-z]+\s*=/i);
      });
    });

    it('ninguna plantilla o parcial contiene atributos style estáticos ni display:none', () => {
      allTemplates.forEach(({ content }) => {
        expect(content).not.toMatch(/\bstyle\s*=\s*["']/i);
        expect(content).not.toMatch(/display\s*:\s*none/i);
      });
    });

    it("los iconos de estado aprobado conservan la clase de relleno visual [font-variation-settings:'FILL'_1]", () => {
      const tableFillMatches =
        tableTemplate.match(/\[font-variation-settings:'FILL'_1\]/g) || [];
      const gridFillMatches =
        gridTemplate.match(/\[font-variation-settings:'FILL'_1\]/g) || [];

      expect(tableFillMatches).toHaveLength(3);
      expect(gridFillMatches).toHaveLength(3);
    });
  });

  describe('estructura e inicialización de módulos JavaScript del cliente', () => {
    const mainJs = fs.readFileSync(CLIENT_JS_MAIN, 'utf8');
    const viewToggleJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'ingredientViewToggle.js'),
      'utf8',
    );
    const modalJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'ingredientModal.js'),
      'utf8',
    );

    it('ingredients.js importa e inicializa la alternancia de vista y el modal en DOMContentLoaded', () => {
      expect(mainJs).toContain(
        "import { initializeIngredientViewToggle } from './ingredients/ingredientViewToggle.js';",
      );
      expect(mainJs).toContain(
        "import { initializeIngredientModal } from './ingredients/ingredientModal.js';",
      );
      expect(mainJs).toMatch(
        /document\.addEventListener\(\s*['"]DOMContentLoaded['"]/,
      );
      expect(mainJs).toContain('initializeIngredientViewToggle();');
      expect(mainJs).toContain('initializeIngredientModal();');
    });

    it('ingredientViewToggle.js no usa style.display y gestiona la visibilidad con hidden', () => {
      expect(viewToggleJs).toContain(
        'export const initializeIngredientViewToggle =',
      );
      expect(viewToggleJs).not.toContain('.style.display');
      expect(viewToggleJs).toContain("classList.add('hidden')");
      expect(viewToggleJs).toContain("classList.remove('hidden')");
    });

    it('ingredientModal.js no usa style.display y gestiona apertura/cierre con clases Tailwind', () => {
      expect(modalJs).toContain('export const initializeIngredientModal =');
      expect(modalJs).not.toContain('.style.display');
      expect(modalJs).toContain("classList.remove('hidden')");
      expect(modalJs).toContain("classList.add('flex')");
      expect(modalJs).toContain("classList.remove('flex')");
      expect(modalJs).toContain("classList.add('hidden')");
    });

    it('el JS cliente no introduce reset() ni cierre mediante Escape en el modal', () => {
      expect(modalJs).not.toContain('.reset()');
      expect(modalJs).not.toContain('reset');
      expect(modalJs).not.toContain('Escape');
      expect(modalJs).not.toContain('keydown');
      expect(mainJs).not.toContain('reset');
      expect(mainJs).not.toContain('Escape');
    });
  });

  describe('conservación de IDs y campos de formulario', () => {
    const formModalTemplate = readView(
      path.join(PARTIALS_DIR, 'form-modal.hbs'),
    );
    const tableTemplate = readView(path.join(PARTIALS_DIR, 'table.hbs'));
    const gridTemplate = readView(path.join(PARTIALS_DIR, 'grid.hbs'));

    it('el modal conserva el ID del formulario y todos los campos requeridos', () => {
      const requiredFieldIds = [
        'form-ingredient',
        'ingredient-nombre',
        'ingredient-iupac',
        'ingredient-grupo',
        'ingredient-mecanismo',
        'ingredient-tipo',
        'ingredient-toxicidad',
        'ingredient-estatus',
        'btn-close-modal-ingredient',
        'btn-cancel-modal-ingredient',
      ];

      requiredFieldIds.forEach((id) => {
        expect(formModalTemplate).toContain(`id="${id}"`);
      });
    });

    it('las vistas conservan los contenedores para tabla, cuadrícula y botón de añadir en tarjeta', () => {
      expect(tableTemplate).toContain('id="ingredients-table-view"');
      expect(gridTemplate).toContain('id="ingredients-grid-view"');
      expect(gridTemplate).toContain('id="btn-add-ingredient-card"');
    });
  });
});
