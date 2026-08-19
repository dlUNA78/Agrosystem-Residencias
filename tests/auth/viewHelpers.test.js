import { describe, it, expect } from '@jest/globals';
import hbs from 'express-hbs';
import '../../app.js';

describe('🎨 Pruebas de Helpers Handlebars para Vistas (RBAC)', () => {
  it('1. canAccessPanel debe retornar true si el rol es inifap o admin', () => {
    const canAccessPanel = hbs.handlebars.helpers.canAccessPanel;

    expect(canAccessPanel({ role: 'inifap' })).toBe(true);
    expect(canAccessPanel({ role: 'admin' })).toBe(true);
    expect(canAccessPanel({ role: 'agricultor' })).toBe(false);
    expect(canAccessPanel(null)).toBe(false);
  });

  it('2. hasRole debe evaluar correctamente roles simples o listas separadas por coma', () => {
    const hasRole = hbs.handlebars.helpers.hasRole;

    expect(hasRole({ role: 'admin' }, 'admin')).toBe(true);
    expect(hasRole({ role: 'inifap' }, 'inifap,admin')).toBe(true);
    expect(hasRole({ role: 'admin' }, 'inifap,admin')).toBe(true);
    expect(hasRole({ role: 'agricultor' }, 'inifap,admin')).toBe(false);
    expect(hasRole(null, 'admin')).toBe(false);
  });

  it('3. hasRole debe obtener @root.user cuando se invoca dentro de bucles {{#each}}', () => {
    const hasRole = hbs.handlebars.helpers.hasRole;
    const mockOptions = {
      data: {
        root: {
          user: { role: 'admin' },
        },
      },
    };

    // Invocado dentro de un bucle {{#each}} donde 'user' es undefined en el contexto del elemento
    expect(hasRole(undefined, 'admin', mockOptions)).toBe(true);
    expect(hasRole('admin', mockOptions)).toBe(true);
  });
});
