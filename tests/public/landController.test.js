import request from 'supertest';

import app, { closeAppResources } from '../../app.js';

afterAll(closeAppResources);

describe('consulta pública de regiones agrícolas', () => {
  it('muestra información regional sin exponer expedientes privados', async () => {
    const response = await request(app).get('/lands');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Regiones agrícolas');
    expect(response.text).toContain('Información regional');
    expect(response.text).not.toContain('Abrir Expediente');
    expect(response.text).not.toContain('Responsable:');
    expect(response.text).not.toContain('Latitud');
    expect(response.text).not.toContain('Longitud');
  });

  it('mantiene el listado privado protegido para visitantes sin sesión', async () => {
    const response = await request(app).get('/private/lands');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/login');
  });

  it('rechaza mutaciones sobre la ruta pública', async () => {
    const response = await request(app).post('/lands/create').send({
      name: 'Predio que no debe crearse',
    });

    expect(response.status).toBe(403);
  });
});
