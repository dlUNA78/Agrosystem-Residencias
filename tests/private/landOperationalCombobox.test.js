import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('componente de combobox en modales operativos de terrenos', () => {
  it('incluye inputs de búsqueda predictiva y mensajes de sin resultados para cada selector clave', async () => {
    const templatePath = path.join(
      __dirname,
      '../../src/views/partials/private/lands/operation-modals.hbs',
    );
    const content = await fs.readFile(templatePath, 'utf-8');

    // Combobox de cultivo
    expect(content).toContain('data-combobox-filter="cycle-crop"');
    expect(content).toContain('data-combobox-empty="cycle-crop"');
    expect(content).toContain('id="cycle-crop"');

    // Combobox de plaga
    expect(content).toContain('data-combobox-filter="health-plague"');
    expect(content).toContain('data-combobox-empty="health-plague"');
    expect(content).toContain('id="health-plague"');

    // Combobox de agroquímico
    expect(content).toContain('data-combobox-filter="application-product"');
    expect(content).toContain('data-combobox-empty="application-product"');
    expect(content).toContain('id="application-product"');
  });
});
