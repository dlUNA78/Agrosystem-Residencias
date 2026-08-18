import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';
import request from 'supertest';
import app from '../../app.js';

let response;

Given('que soy un visitante anónimo en la plataforma', function () {
  // Visitante sin autenticación previa
});

When('busco {string} en el catálogo de plagas', async function (searchTerm) {
  response = await request(app).get(
    `/api/plagues?search=${encodeURIComponent(searchTerm)}`,
  );
});

Then(
  'el sistema debe devolverme una lista con al menos un resultado que coincida',
  function () {
    assert.strictEqual(response.status, 200, 'El status debe ser 200 OK');
    assert(
      response.body && Array.isArray(response.body.plagues),
      'Debe devolver un objeto JSON con el campo "plagues"',
    );
  },
);

Then(
  'la respuesta no debe contener información interna de los administradores.',
  function () {
    if (response.body.plagues && response.body.plagues.length > 0) {
      response.body.plagues.forEach((p) => {
        assert.strictEqual(p.password, undefined, 'No debe exponer passwords');
        assert.strictEqual(
          p.admin_notes,
          undefined,
          'No debe exponer admin_notes',
        );
        assert.strictEqual(
          p.secret_key,
          undefined,
          'No debe exponer secret_key',
        );
      });
    }
  },
);
