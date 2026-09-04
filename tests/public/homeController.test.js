import request from 'supertest';
import app, { closeAppResources } from '../../app.js';

afterAll(closeAppResources);

describe('🧪 Suite de Pruebas Públicas - Módulo Home Index', () => {
  it('GET / debe retornar 200 OK y la vista del inicio institucional', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('AgroSystem INIFAP');
    expect(response.text).toContain(
      'SISTEMA NACIONAL DE VIGILANCIA FITOSANITARIA',
    );
  });

  it('GET / debe contener las secciones principales (Hero, Panorama Nacional, Boletín, Ciclo Agrícola, Acervo)', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Consulta la sanidad vegetal de México');
    expect(response.text).toContain('Alertas fitosanitarias por entidad');
    expect(response.text).toContain('Avisos publicados esta semana');
    expect(response.text).toContain('Qué se siembra y qué se cosecha ahora');
    expect(response.text).toContain('Índice de la base de datos');
  });
});
