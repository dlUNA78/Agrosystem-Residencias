'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // Obtener los ids de las plagas y regiones insertadas
    const plagues = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Plagues";`
    );
    const regions = await queryInterface.sequelize.query(
      `SELECT id, name FROM "Regions";`
    );

    const plaguesRows = plagues[0];
    const regionsRows = regions[0];

    // Helper para buscar ID por nombre
    const getPlagueId = (name) => plaguesRows.find(p => p.name === name)?.id;
    const getRegionId = (name) => regionsRows.find(r => r.name === name)?.id;

    const plagueRegions = [];

    // Pulgón Verde (Alto) - El Bajío, Norte de Tamaulipas, Sonora
    const pulgonVerdeId = getPlagueId("Pulgón Verde");
    if (pulgonVerdeId) {
      const regionNames = ["El Bajío", "Norte de Tamaulipas", "Sonora", "Sinaloa"];
      regionNames.forEach((name, index) => {
        const rId = getRegionId(name);
        if (rId) {
          plagueRegions.push({
            plague_id: pulgonVerdeId,
            region_id: rId,
            risk_level: index === 0 || index === 2 ? "Alto" : (index === 1 ? "Medio" : "Bajo"),
            createdAt: now,
            updatedAt: now
          });
        }
      });
    }

    // Roya Amarilla del Trigo (Alto) - Sonora, Sinaloa, Guanajuato, Jalisco
    const royaAmarillaId = getPlagueId("Roya Amarilla del Trigo");
    if (royaAmarillaId) {
      const regionNames = ["Sonora", "Sinaloa", "Guanajuato", "Jalisco"];
      regionNames.forEach((name, index) => {
        const rId = getRegionId(name);
        if (rId) {
          plagueRegions.push({
            plague_id: royaAmarillaId,
            region_id: rId,
            risk_level: index === 0 ? "Alto" : (index === 1 ? "Medio" : "Bajo"),
            createdAt: now,
            updatedAt: now
          });
        }
      });
    }

    // Gusano Cogollero (Alto) - Veracruz, Tabasco, Chiapas, Oaxaca, Jalisco
    const gusanoCogolleroId = getPlagueId("Gusano Cogollero");
    if (gusanoCogolleroId) {
      const regionNames = ["Veracruz", "Tabasco", "Chiapas", "Oaxaca", "Jalisco"];
      regionNames.forEach((name, index) => {
        const rId = getRegionId(name);
        if (rId) {
          plagueRegions.push({
            plague_id: gusanoCogolleroId,
            region_id: rId,
            risk_level: index < 2 ? "Alto" : (index < 4 ? "Medio" : "Bajo"),
            createdAt: now,
            updatedAt: now
          });
        }
      });
    }

    // Cenicilla Polvorienta (Medio) - Sonora, Sinaloa, Baja California
    const cenicillaId = getPlagueId("Cenicilla Polvorienta");
    if (cenicillaId) {
      const regionNames = ["Sonora", "Sinaloa"];
      regionNames.forEach((name, index) => {
        const rId = getRegionId(name);
        if (rId) {
          plagueRegions.push({
            plague_id: cenicillaId,
            region_id: rId,
            risk_level: index === 0 ? "Medio" : "Bajo",
            createdAt: now,
            updatedAt: now
          });
        }
      });
    }

    if (plagueRegions.length > 0) {
      await queryInterface.bulkInsert('PlagueRegions', plagueRegions);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('PlagueRegions', null, {});
  }
};