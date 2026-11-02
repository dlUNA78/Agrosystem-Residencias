import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import hbs from 'express-hbs';

const sampleRows = [
  {
    id: 1,
    name: 'Glifosato',
    chemical_group: 'Glicinas',
    action_type: 'herbicida',
    toxicological_category: 'clase-iii',
  },
  {
    id: 2,
    name: 'Paraquat',
    chemical_group: 'Bipiridilios',
    action_type: 'herbicida',
    toxicological_category: 'clase-i',
  },
];

const mockDb = {
  Sequelize: {
    Op: {
      like: Symbol('like'),
      or: Symbol('or'),
      in: Symbol('in'),
    },
    fn: jest.fn((name, arg) => ({ fn: name, arg })),
    col: jest.fn((name) => ({ col: name })),
    where: jest.fn((left, right) => ({ left, right })),
  },
  ActiveIngredient: {
    findAndCountAll: jest.fn().mockResolvedValue({
      count: 2,
      rows: sampleRows,
    }),
    findAll: jest.fn().mockResolvedValue(sampleRows),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  AuditLog: {
    create: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn().mockResolvedValue({
      commit: jest.fn(),
      rollback: jest.fn(),
    }),
  },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { ingredientsPrivate } =
  await import('../../src/controllers/private/ingredientsController.js');

const VIEW_ROOT = path.resolve('src/views/private/catalog/ingredients.hbs');
const PARTIALS_DIR = path.resolve('src/views/partials/private/ingredients');
const CLIENT_JS_DIR = path.resolve('public/js/private/ingredients');
const CLIENT_JS_MAIN = path.resolve('public/js/private/ingredients.js');

const readView = (filePath) => fs.readFileSync(filePath, 'utf8');

describe('módulo privado de ingredientes activos (Geist Design System + BD real)', () => {
  describe('controlador ingredientsPrivate', () => {
    it('renderiza la vista con KPIs reales, RBAC contextual y persistencia de filtros', async () => {
      const req = {
        user: { id: 1, role: 'admin' },
        query: { status: 'restringido', tipo: 'herbicida' },
      };
      const res = {
        render: jest.fn(),
      };

      await ingredientsPrivate(req, res);

      expect(res.render).toHaveBeenCalledTimes(1);
      const [viewPath, renderData] = res.render.mock.calls[0];

      expect(viewPath).toBe('private/catalog/ingredients');
      expect(renderData.pageTitle).toBe('Ingredientes Activos');
      expect(renderData.activePage).toBe('ingredients');
      expect(renderData.searchId).toBe('ingredient-search');
      expect(renderData.ctaBtnId).toBe('btn-add-ingredient');
      expect(renderData.ctaLabel).toBe('Añadir Ingrediente');
      expect(renderData.showViewToggle).toBe(true);
      expect(renderData.canManage).toBe(true);

      expect(renderData.stats).toEqual({
        total: 2,
        approvedCount: 1,
        pendingCount: 0,
        restrictedCount: 1,
        distinctGroups: 2,
      });

      const statusFilter = renderData.searchFilters.find(
        (f) => f.id === 'filter-status',
      );
      expect(statusFilter).toBeDefined();
      expect(
        statusFilter.options.find((opt) => opt.value === 'restringido')
          ?.selected,
      ).toBe(true);
    });

    it('marca modo de solo lectura cuando el usuario tiene rol especialista INIFAP', async () => {
      const res = { render: jest.fn() };
      await ingredientsPrivate({ user: { id: 9, role: 'inifap' } }, res);

      const [, renderData] =
        res.render.mock.calls[res.render.mock.calls.length - 1];
      expect(renderData.canManage).toBe(false);
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

    it('incluye los tres parciales modulares y evita <main> anidado o KPIs estáticos', () => {
      expect(mainTemplate).toContain('{{> private/ingredients/table}}');
      expect(mainTemplate).toContain('{{> private/ingredients/grid}}');
      expect(mainTemplate).toContain('{{> private/ingredients/form-modal}}');
      expect(mainTemplate).not.toMatch(/<main\b/i);
      expect(mainTemplate).toContain('{{stats.total}}');
      expect(mainTemplate).toContain('{{stats.approvedCount}}');
      expect(mainTemplate).toContain('{{stats.pendingCount}}');
      expect(mainTemplate).toContain('{{stats.restrictedCount}}');
    });

    it('renderiza filas y tarjetas dinámicamente con {{#each ingredients}}', () => {
      expect(tableTemplate).toContain('{{#each ingredients}}');
      expect(gridTemplate).toContain('{{#each ingredients}}');
    });

    it('todas las plantillas y parciales compilan sin errores de sintaxis en Handlebars', () => {
      allTemplates.forEach(({ content }) => {
        expect(() => hbs.handlebars.compile(content)).not.toThrow();
        expect(content.length).toBeGreaterThan(0);
      });
    });

    it('ninguna plantilla o parcial supera las 500 líneas', () => {
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
    });

    it('ninguna plantilla o parcial contiene manejadores de eventos inline ni atributos style', () => {
      allTemplates.forEach(({ content }) => {
        expect(content).not.toMatch(/\bon[a-z]+\s*=/i);
        expect(content).not.toMatch(/\bstyle\s*=\s*["']/i);
        expect(content).not.toMatch(/display\s*:\s*none/i);
      });
    });
  });

  describe('estructura de módulos JavaScript y campos del formulario', () => {
    const mainJs = fs.readFileSync(CLIENT_JS_MAIN, 'utf8');
    const viewToggleJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'ingredientViewToggle.js'),
      'utf8',
    );
    const modalJs = fs.readFileSync(
      path.join(CLIENT_JS_DIR, 'ingredientModal.js'),
      'utf8',
    );
    const formModalTemplate = readView(
      path.join(PARTIALS_DIR, 'form-modal.hbs'),
    );
    const tableTemplate = readView(path.join(PARTIALS_DIR, 'table.hbs'));
    const gridTemplate = readView(path.join(PARTIALS_DIR, 'grid.hbs'));

    it('ingredients.js coordina vista, modal y filtrado asíncrono sin usar style.display', () => {
      expect(mainJs).toContain('initializeIngredientViewToggle');
      expect(mainJs).toContain('initializeIngredientModal');
      expect(viewToggleJs).not.toContain('.style.display');
      expect(modalJs).not.toContain('.style.display');
    });

    it('el modal conserva IDs y atributos name requeridos por el backend', () => {
      [
        'id="form-ingredient"',
        'id="ingredient-nombre"',
        'name="name"',
        'id="ingredient-grupo"',
        'name="chemical_group"',
        'id="ingredient-tipo"',
        'name="action_type"',
        'id="ingredient-toxicidad"',
        'name="toxicological_category"',
        'id="btn-close-modal-ingredient"',
        'id="btn-cancel-modal-ingredient"',
      ].forEach((fragment) => {
        expect(formModalTemplate).toContain(fragment);
      });

      expect(tableTemplate).toContain('id="ingredients-table-view"');
      expect(gridTemplate).toContain('id="ingredients-grid-view"');
      expect(gridTemplate).toContain('id="btn-add-ingredient-card"');
    });
  });
});
